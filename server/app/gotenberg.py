"""Client for the Gotenberg container (LibreOffice + Chromium), reachable only on the internal network."""

import time
from pathlib import Path

import httpx

from .config import settings
from .errors import ToolError

_health: tuple[float, bool] = (0.0, False)


async def available() -> bool:
    """Cached for 30 s so /api/capabilities stays cheap."""
    global _health
    at, ok = _health
    if time.monotonic() - at < 30:
        return ok
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            ok = (await c.get(f"{settings.gotenberg_url}/health")).status_code == 200
    except httpx.HTTPError:
        ok = False
    _health = (time.monotonic(), ok)
    return ok


async def convert(
    route: str,
    out: Path,
    timeout: float,
    files: list[tuple[str, Path]] = (),  # (name Gotenberg sees, file)
    data: dict[str, str] | None = None,
) -> Path:
    handles = [(name, p.open("rb")) for name, p in files]
    try:
        async with httpx.AsyncClient(timeout=timeout + 5) as c:
            async with c.stream(
                "POST",
                f"{settings.gotenberg_url}{route}",
                files=[("files", (name, fh)) for name, fh in handles],
                data=data or {},
            ) as r:
                if r.status_code != 200:
                    raise _error(r.status_code, (await r.aread()).decode("utf-8", "replace"))
                with out.open("wb") as f:
                    async for chunk in r.aiter_bytes():
                        f.write(chunk)
    except httpx.TimeoutException as e:
        raise ToolError("timeout") from e
    except httpx.HTTPError as e:
        raise ToolError("busy", "converter unavailable") from e
    finally:
        for _, fh in handles:
            fh.close()
    return out


def _error(status: int, body: str) -> ToolError:
    text = body.lower()
    if "password" in text:
        return ToolError("password")
    if status in (503, 504) or "timeout" in text or "deadline" in text:
        return ToolError("timeout")
    if status == 403 or "forbidden" in text or "denied" in text:
        return ToolError("bad-options", "address not allowed")
    if status == 400:
        return ToolError("corrupted")
    return ToolError("unknown", f"gotenberg {status}")
