"""Ebooks (calibre) and document formats (pandoc)."""

import re
from pathlib import Path

from ..errors import ToolError
from ..jobs import run
from ..registry import Job, Opt, ServerTool, register

# ---- calibre -------------------------------------------------------------------------------

EBOOK_IN = frozenset({"epub", "mobi", "azw", "azw3", "fb2", "docx", "odt", "rtf", "txt", "pdf"})
EBOOK_OUT = ("epub", "azw3", "mobi", "fb2", "docx", "pdf", "txt")


async def ebook(job: Job) -> Path:
    to = job.options["to"]
    if to == job.ext:
        raise ToolError("bad-options", "same format")
    out = job.out(to)
    args = ["ebook-convert", str(job.src), str(out)]
    if to == "pdf":
        args += ["--paper-size", "a4", "--pdf-page-numbers"]
    if job.ext == "pdf":
        # calibre's header/footer guessing crashes on short PDFs (IndexError in reflow.py).
        args += ["--pdf-header-skip", "0", "--pdf-footer-skip", "0"]
    code, err = await run(args, job.dir, job.timeout)
    if "drm" in err.lower():
        raise ToolError("password", "DRM")
    if code != 0 or not out.exists():
        raise ToolError("corrupted")
    return out


# ---- pandoc --------------------------------------------------------------------------------

READERS = {"md": "markdown", "markdown": "markdown", "txt": "markdown", "docx": "docx", "odt": "odt", "epub": "epub",
           "html": "html", "htm": "html", "tex": "latex", "rst": "rst", "org": "org"}  # fmt: skip
WRITERS = {"docx": "docx", "odt": "odt", "md": "gfm", "html": "html", "epub": "epub3", "tex": "latex", "rst": "rst"}
TEXT_INPUTS = {"md", "markdown", "txt", "html", "htm", "tex", "rst", "org"}
ARABIC = re.compile(r"[؀-ۿ]")
LATIN = re.compile(r"[A-Za-z]")


def looks_arabic(path: Path) -> bool:
    sample = path.read_bytes()[:20000].decode("utf-8", "ignore")
    sample = re.sub(r"<[^>]+>|\\[a-zA-Z]+", "", sample)  # skip markup
    return len(ARABIC.findall(sample)) > len(LATIN.findall(sample))


async def pandoc(job: Job) -> Path:
    to = job.options["to"]
    reader = READERS[job.ext]
    if WRITERS[to] == reader or (to == "md" and reader == "markdown"):
        raise ToolError("bad-options", "same format")
    out = job.out(to)
    # --sandbox: the input can't make pandoc read other files or fetch URLs.
    args = ["pandoc", "--sandbox", "-f", reader, "-t", WRITERS[to], "-o", str(out)]
    if to in ("html", "epub", "tex", "odt", "docx"):
        args.append("--standalone")
    if to == "html":
        args.append("--embed-resources")
    if job.ext in TEXT_INPUTS and looks_arabic(job.src):
        args += ["-M", "dir=rtl", "-M", "lang=ar"]
    if to in ("html", "epub"):
        args += ["-M", f"title={job.stem}"]
    code, _ = await run(args + [str(job.src)], job.dir, job.timeout)
    if code != 0 or not out.exists():
        raise ToolError("corrupted")
    return out


ebook_to = Opt("choice", "epub", EBOOK_OUT)
register(ServerTool("ebook-convert", EBOOK_IN, ebook, ("ebook-convert",), {"to": ebook_to}, timeout=300))
register(ServerTool("epub-to-pdf", frozenset({"epub"}), ebook, ("ebook-convert",), params={"to": "pdf"}, timeout=300))
register(ServerTool("pdf-to-epub", frozenset({"pdf"}), ebook, ("ebook-convert",), params={"to": "epub"}, timeout=300))
register(ServerTool("mobi-to-epub", frozenset({"mobi", "azw", "azw3"}), ebook, ("ebook-convert",), params={"to": "epub"}, timeout=300))

register(ServerTool("document-convert", frozenset(READERS), pandoc, ("pandoc",),
                    {"to": Opt("choice", "docx", tuple(WRITERS))}))
register(ServerTool("latex-to-word", frozenset({"tex"}), pandoc, ("pandoc",), params={"to": "docx"}))
register(ServerTool("word-to-latex", frozenset({"docx", "odt"}), pandoc, ("pandoc",), params={"to": "tex"}))
