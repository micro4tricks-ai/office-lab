"""Per-job temp folders, upload limits, the zip-bomb guard and running external programs safely."""

import asyncio
import logging
import os
import shutil
import signal
import time
import uuid
import zipfile
from pathlib import Path

from fastapi import UploadFile

from .config import settings
from .errors import ToolError

log = logging.getLogger("office-lab")

# Office files, EPUB and the like are ZIPs: refuse ones that unpack to something huge.
ZIP_MAX_ENTRIES = 10_000
ZIP_MAX_UNPACKED = 1024 * 1024 * 1024
ZIP_MAX_RATIO = 200


def new_job_dir() -> Path:
    settings.tmp_root.mkdir(parents=True, exist_ok=True)
    d = settings.tmp_root / uuid.uuid4().hex
    d.mkdir(mode=0o700)
    return d


def remove(path: Path) -> None:
    shutil.rmtree(path, ignore_errors=True)


def sweep(now: float | None = None) -> int:
    """Deletes job folders older than RETENTION_MIN (left over by crashes or slow clients)."""
    if not settings.tmp_root.exists():
        return 0
    limit = (now or time.time()) - settings.retention_min * 60
    removed = 0
    for d in settings.tmp_root.iterdir():
        try:
            if d.stat().st_mtime < limit:
                remove(d) if d.is_dir() else d.unlink()
                removed += 1
        except FileNotFoundError:
            pass
    return removed


async def sweeper(every_s: int = 300) -> None:
    while True:
        try:
            sweep()
        except OSError as e:  # never let the sweeper die
            log.warning("sweep failed: %s", e)
        await asyncio.sleep(every_s)


async def save_upload(upload: UploadFile, dest: Path, limit: int | None = None) -> int:
    """Copies an upload to `dest` in chunks, stopping as soon as it passes the size limit."""
    limit = settings.max_bytes if limit is None else limit
    size = 0
    with dest.open("wb") as out:
        while chunk := await upload.read(1024 * 1024):
            size += len(chunk)
            if size > limit:
                raise ToolError("too-big")
            out.write(chunk)
    if size == 0:
        raise ToolError("corrupted", "empty file")
    return size


def check_zip(path: Path) -> None:
    """Zip-bomb guard for ZIP-based inputs (DOCX, XLSX, PPTX, ODT, EPUB...)."""
    if not zipfile.is_zipfile(path):
        return
    try:
        with zipfile.ZipFile(path) as z:
            infos = z.infolist()
    except zipfile.BadZipFile as e:
        raise ToolError("corrupted") from e
    if len(infos) > ZIP_MAX_ENTRIES:
        raise ToolError("too-big", "too many entries")
    unpacked = sum(i.file_size for i in infos)
    packed = max(1, sum(i.compress_size for i in infos))
    if unpacked > ZIP_MAX_UNPACKED or (unpacked > 50 * 1024 * 1024 and unpacked / packed > ZIP_MAX_RATIO):
        raise ToolError("too-big", "unpacks too large")


# Only what the tools need; nothing from the API's own environment leaks to them.
_ENV_KEEP = ("PATH", "LANG", "LC_ALL", "HOME", "TMPDIR", "PYTHONPATH", "QT_QPA_PLATFORM", "QTWEBENGINE_CHROMIUM_FLAGS",
             "TESSDATA_PREFIX", "OMP_THREAD_LIMIT", "SYSTEMROOT")


def _env(cwd: Path) -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if k in _ENV_KEEP}
    # Programs that write caches/config (calibre, fontconfig) do it inside the job folder.
    env.update(HOME=str(cwd), TMPDIR=str(cwd), OMP_THREAD_LIMIT="1")
    return env


def _kill(proc: asyncio.subprocess.Process) -> None:
    try:
        if hasattr(os, "killpg"):
            os.killpg(proc.pid, signal.SIGKILL)  # the whole group: some tools spawn helpers
        else:
            proc.kill()
    except ProcessLookupError:
        pass


async def run(args: list[str], cwd: Path, timeout: float) -> tuple[int, str]:
    """Runs a program without a shell, in its own process group, killed at the timeout.

    Returns (exit code, stderr). Never logs output: it can quote the user's file.
    """
    proc = await asyncio.create_subprocess_exec(
        *args,
        cwd=cwd,
        env=_env(cwd),
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
        start_new_session=True,
    )
    try:
        _, err = await asyncio.wait_for(proc.communicate(), timeout)
    except asyncio.TimeoutError:
        _kill(proc)
        await proc.wait()
        raise ToolError("timeout") from None
    except asyncio.CancelledError:  # the client went away
        _kill(proc)
        raise
    return proc.returncode or 0, err.decode("utf-8", "replace")[-4000:]
