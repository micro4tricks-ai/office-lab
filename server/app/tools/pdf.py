"""PDF tools that need native programs: Ghostscript, qpdf, OCRmyPDF, pdf2docx."""

import shutil
import sys
from pathlib import Path

from ..errors import ToolError
from ..jobs import run
from ..registry import Job, Opt, ServerTool, register

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"


async def ensure_open(job: Job) -> None:
    """Fails early with a clear message for PDFs that need a password to open."""
    code, _ = await run(["qpdf", "--requires-password", str(job.src)], job.dir, 30)
    if code == 0:
        raise ToolError("password")
    if code not in (2, 3):  # 2 = not encrypted, 3 = encrypted without a user password
        raise ToolError("corrupted")


def _gs(src: Path, out: Path, preset: str, dpi: int | None = None) -> list[str]:
    args = [
        "gs", "-q", "-dSAFER", "-dBATCH", "-dNOPAUSE", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.5",
        f"-dPDFSETTINGS=/{preset}", "-dDetectDuplicateImages=true", "-dCompressFonts=true",
    ]  # fmt: skip
    if dpi:
        args += [
            "-dDownsampleColorImages=true", "-dDownsampleGrayImages=true", "-dDownsampleMonoImages=true",
            f"-dColorImageResolution={dpi}", f"-dGrayImageResolution={dpi}", f"-dMonoImageResolution={dpi * 2}",
            "-dColorImageDownsampleThreshold=1.0", "-dGrayImageDownsampleThreshold=1.0",
        ]  # fmt: skip
    return args + [f"-sOutputFile={out}", str(src)]


async def _shrink(job: Job, preset: str, dpi: int | None, out: Path) -> int:
    code, _ = await run(_gs(job.src, out, preset, dpi), job.dir, job.timeout)
    if code != 0 or not out.exists():
        raise ToolError("corrupted")
    return out.stat().st_size


# Image resolutions tried for a target size, best quality first.
DPIS = (200, 150, 120, 96, 72, 50, 36)


async def compress(job: Job) -> Path:
    await ensure_open(job)
    original = job.src.stat().st_size
    out = job.out("pdf")
    if job.options["mode"] == "target":
        target = job.options["target_mb"] * 1024 * 1024
        # Binary search for the sharpest resolution that fits.
        lo, hi, best = 0, len(DPIS) - 1, None
        while lo <= hi:
            mid = (lo + hi) // 2
            dpi = DPIS[mid]
            trial = job.dir / f"try-{dpi}.pdf"
            if await _shrink(job, "screen" if dpi <= 72 else "ebook", dpi, trial) <= target:
                best, hi = trial, mid - 1
            else:
                lo = mid + 1
        if best is None:
            best = job.dir / f"try-{DPIS[-1]}.pdf"
            if not best.exists():
                await _shrink(job, "screen", DPIS[-1], best)
            job.note = "target-missed"
        best.replace(out)
    else:
        await _shrink(job, job.options["level"], None, out)
    if out.stat().st_size >= original:  # never hand back a bigger file
        shutil.copyfile(job.src, out)
        job.note = "kept-original"
    return out


async def repair(job: Job) -> Path:
    out = job.out("pdf")
    code, err = await run(["qpdf", "--object-streams=generate", str(job.src), str(out)], job.dir, job.timeout)
    if "password" in err.lower():
        raise ToolError("password")
    if code in (0, 3) and out.exists():  # 3 = fixed with warnings: the usual case for a damaged file
        return out
    # qpdf gave up: let Ghostscript rebuild the file from what it can read.
    out.unlink(missing_ok=True)
    code, _ = await run(_gs(job.src, out, "default"), job.dir, job.timeout)
    if code != 0 or not out.exists() or out.stat().st_size == 0:
        raise ToolError("corrupted")
    return out


async def to_word(job: Job) -> Path:
    await ensure_open(job)
    out = job.out("docx")
    code, err = await run([sys.executable, str(SCRIPTS / "pdf_to_docx.py"), str(job.src), str(out)], job.dir, job.timeout)
    if code != 0 or not out.exists():
        raise ToolError("corrupted")
    return out


async def ocr(job: Job) -> Path:
    out = job.out("pdf")
    args = ["ocrmypdf", "-l", job.options["lang"], "--jobs", "1", "--output-type", "pdfa" if job.options["pdfa"] else "pdf",
            "--optimize", "1", "--force-ocr" if job.options["redo"] else "--skip-text"]  # fmt: skip
    if job.options["straighten"]:
        args += ["--rotate-pages", "--deskew"]
    code, _ = await run(args + [str(job.src), str(out)], job.dir, job.timeout)
    # https://ocrmypdf.readthedocs.io/en/latest/advanced.html#return-code-policy
    if code == 8:
        raise ToolError("password")
    if code in (2, 4):
        raise ToolError("corrupted")
    if code != 0 or not out.exists():
        raise ToolError("unknown", f"ocrmypdf exit {code}")
    return out


P = frozenset({"pdf"})

register(ServerTool("compress-pdf-strong", P, compress, ("gs", "qpdf"), {
    "mode": Opt("choice", "level", ("level", "target")),
    "level": Opt("choice", "ebook", ("screen", "ebook", "printer")),
    "target_mb": Opt("float", 2.0, min=0.05, max=500),
}, timeout=300))
register(ServerTool("repair-pdf", P, repair, ("qpdf", "gs")))
register(ServerTool("pdf-to-word", P, to_word, ("qpdf",), timeout=300))
register(ServerTool("ocr-pdf-server", P, ocr, ("ocrmypdf", "qpdf"), {
    "lang": Opt("choice", "ara+eng", ("ara", "eng", "ara+eng")),
    "redo": Opt("bool", False),
    "straighten": Opt("bool", False),
    "pdfa": Opt("bool", False),
}, timeout=600))
