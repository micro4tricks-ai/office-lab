"""Office Lab API: the conversions a browser can't do (Office → PDF, ebooks, OCRmyPDF, Ghostscript...)."""

import asyncio
import json
import logging
import mimetypes
import re
import shutil
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.background import BackgroundTask

from . import gotenberg, tools  # noqa: F401  (tools: registers every server tool)
from .config import settings
from .errors import ToolError
from .keys import key_name
from .jobs import check_zip, new_job_dir, remove, save_upload, sweeper
from .registry import TOOLS, Job

for _ext, _type in {".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    ".epub": "application/epub+zip", ".azw3": "application/vnd.amazon.ebook",
                    ".mobi": "application/x-mobipocket-ebook", ".fb2": "application/x-fictionbook+xml",
                    ".md": "text/markdown", ".tex": "application/x-tex", ".rst": "text/x-rst",
                    ".odt": "application/vnd.oasis.opendocument.text", ".webp": "image/webp"}.items():
    mimetypes.add_type(_type, _ext)

log = logging.getLogger("office-lab")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

ASSET_TYPES = {"woff2", "woff", "ttf", "otf", "css", "js", "png", "jpg", "jpeg", "gif", "svg", "webp"}
MAX_ASSETS = 40
# Room for the multipart envelope and html-to-pdf's fonts on top of MAX_MB.
BODY_SLACK = 20 * 1024 * 1024


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.slots = asyncio.Semaphore(settings.concurrency)
    task = asyncio.create_task(sweeper())
    yield
    task.cancel()


def rate_key(request: Request) -> str:
    """Requests with a valid API key are counted per key, the rest per IP address."""
    try:
        name = key_name(request)
    except ToolError:
        name = None  # refused in the endpoint
    return f"key:{name}" if name else get_remote_address(request)


def rate_for(key: str) -> str:
    return settings.key_rate_limit if key.startswith("key:") else settings.rate_limit


limiter = Limiter(key_func=rate_key)
app = FastAPI(title="Office Lab API", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
app.state.limiter = limiter
if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition", "X-Office-Lab-Note"],
        max_age=3600,
    )


def error(code: str, status: int | None = None) -> JSONResponse:
    return JSONResponse({"code": code}, status_code=status or ToolError(code).status)


@app.exception_handler(ToolError)
async def tool_error(_: Request, e: ToolError):
    return error(e.code)


@app.exception_handler(RateLimitExceeded)
async def rate_limited(_: Request, __: RateLimitExceeded):
    return error("busy", 429)


@app.middleware("http")
async def body_limit(request: Request, call_next):
    """Refuses oversized uploads before reading them (Caddy also caps the body)."""
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > settings.max_bytes + BODY_SLACK:
        return error("too-big")
    return await call_next(request)


@app.get("/api/health")
async def health():
    return {"ok": True}


async def available() -> list[str]:
    gotenberg_ok = await gotenberg.available()
    return [
        t.id
        for t in TOOLS.values()
        if all(gotenberg_ok if n == "gotenberg" else shutil.which(n) for n in t.needs)
    ]


@app.get("/api/capabilities")
async def capabilities():
    return {"tools": await available(), "maxMB": settings.max_mb}


def ext_of(name: str) -> str:
    return Path(name).suffix.lower().lstrip(".")


def safe_stem(name: str) -> str:
    """The upload's base name for the download: no path, no control or reserved characters."""
    stem = Path(name.replace("\\", "/").split("/")[-1]).stem
    stem = re.sub(r'[\x00-\x1f<>:"/\\|?*]', "", stem).strip(" .")
    return stem[:120] or "document"


@app.post("/api/convert/{tool_id}")
@limiter.limit(rate_for)
async def convert(
    request: Request,
    tool_id: str,
    file: Annotated[UploadFile | None, File()] = None,
    assets: Annotated[list[UploadFile] | None, File()] = None,
    url: Annotated[str | None, Form()] = None,
    options: Annotated[str, Form()] = "{}",
):
    key_name(request)  # a wrong key is refused, not quietly treated as anonymous
    tool = TOOLS.get(tool_id)
    if tool is None:
        raise ToolError("not-found")
    try:
        raw = json.loads(options)
        if not isinstance(raw, dict):
            raise ValueError
    except ValueError:
        raise ToolError("bad-options") from None
    opts = tool.parse_options(raw)

    if tool.accepts:
        if file is None or not file.filename:
            raise ToolError("nothing")
        ext = ext_of(file.filename)
        if ext not in tool.accepts:
            raise ToolError("wrong-type")
    elif not url:
        raise ToolError("nothing")
    if assets and not tool.assets:
        raise ToolError("bad-options")
    if assets and len(assets) > MAX_ASSETS:
        raise ToolError("too-big")

    slots: asyncio.Semaphore = request.app.state.slots
    try:
        await asyncio.wait_for(slots.acquire(), settings.queue_wait_s)
    except asyncio.TimeoutError:
        raise ToolError("busy") from None

    started = time.monotonic()
    job_dir = new_job_dir()
    status, size = "error", 0
    try:
        job = Job(dir=job_dir, src=None, ext="", options=opts, url=url, timeout=tool.timeout)
        if file is not None and tool.accepts:
            job.ext = ext
            job.stem = safe_stem(file.filename)
            job.src = job_dir / f"input.{ext}"  # never the user's name on disk
            size = await save_upload(file, job.src)
            check_zip(job.src)
        if assets:
            (job_dir / "assets").mkdir()
            budget = settings.max_bytes - size
            for a in assets:
                name = Path((a.filename or "").replace("\\", "/")).name
                if ext_of(name) not in ASSET_TYPES or not re.fullmatch(r"[A-Za-z0-9._-]{1,100}", name) or name == "index.html":
                    raise ToolError("bad-options", "asset name")
                dest = job_dir / "assets" / name
                budget -= await save_upload(a, dest, budget)
                job.assets.append(dest)

        out = await tool.run(job)
        status = "ok"
    except BaseException:
        remove(job_dir)
        raise
    finally:
        slots.release()
        # Never the file name or contents: only what's needed to watch the service.
        log.info("convert %s %s %.1fs in=%d", tool_id, status, time.monotonic() - started, size if status == "ok" else -1)

    headers = {"X-Office-Lab-Note": job.note} if job.note else {}
    return FileResponse(
        out,
        media_type=mimetypes.guess_type(out.name)[0] or "application/octet-stream",
        filename=f"{job.stem}{out.suffix}",
        headers=headers,
        background=BackgroundTask(remove, job_dir),
    )
