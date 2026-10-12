"""Professional translation with Claude (its own container: it may reach the internet, the converters may not).

    GET  /api/translate/status   → {"pro": true/false}
    POST /api/translate          {texts, source, target, engine: "pro"} → {texts}

Only when ANTHROPIC_API_KEY is set, with a daily character budget so a busy day can't run up the bill.
The free translation runs in the browser (Chrome's translator or OPUS-MT). The page splits documents
into paragraphs and puts the translations back itself, so files never come here — only their text.
"""

import json
import logging
import os
import time
from typing import Annotated, Literal

import httpx
from fastapi import Body, FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

log = logging.getLogger("office-lab.translate")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
MODEL = os.environ.get("TRANSLATE_MODEL", "claude-sonnet-5-5")
DAILY_CHARS = int(os.environ.get("PRO_DAILY_CHARS", "") or 300_000)
RATE = os.environ.get("TRANSLATE_RATE_LIMIT", "") or "120/minute"
MAX_TEXTS = 200
MAX_CHARS = 20_000
LANGS = ("en", "ar", "fr")
NAMES = {"en": "English", "ar": "Arabic (Modern Standard Arabic)", "fr": "French"}

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Office Lab translate", docs_url=None, redoc_url=None, openapi_url=None)
app.state.limiter = limiter

_budget = {"day": "", "used": 0}
_transport: httpx.AsyncBaseTransport | None = None  # tests plug a mock in here


def error(code: str, status: int) -> JSONResponse:
    return JSONResponse({"code": code}, status_code=status)


@app.exception_handler(RateLimitExceeded)
async def rate_limited(_: Request, __: RateLimitExceeded):
    return error("busy", 429)


def budget_left() -> int:
    day = time.strftime("%Y-%m-%d", time.gmtime())
    if _budget["day"] != day:
        _budget.update(day=day, used=0)
    return max(0, DAILY_CHARS - _budget["used"])


@app.get("/api/translate/status")
async def status():
    return {"pro": bool(API_KEY) and budget_left() > 0, "languages": list(LANGS)}


class Job(BaseModel):
    texts: list[Annotated[str, Field(max_length=MAX_CHARS)]] = Field(min_length=1, max_length=MAX_TEXTS)
    source: Literal["auto", "en", "ar", "fr"] = "auto"
    target: Literal["en", "ar", "fr"] = "ar"
    engine: Literal["pro"] = "pro"


PROMPT = (
    "You are a professional translator for office documents. Translate every string in the JSON array "
    "{src} into {tgt}. Keep numbers, dates, codes, e-mail addresses, URLs, product and person names, and "
    "placeholders such as {{name}} or %s unchanged. Keep the tone formal and the meaning exact; do not add or "
    "drop anything. A string that needs no translation is returned as it is. Reply with ONLY a JSON array of "
    "exactly {n} strings, in the same order."
)


async def pro(job: Job) -> list[str]:
    src = "from its own language" if job.source == "auto" else f"from {NAMES[job.source]}"
    body = {
        "model": MODEL,
        "max_tokens": min(32_000, 400 + sum(len(t) for t in job.texts) * 3),
        "system": PROMPT.format(src=src, tgt=NAMES[job.target], n=len(job.texts)),
        "messages": [{"role": "user", "content": json.dumps(job.texts, ensure_ascii=False)}],
    }
    headers = {"x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    async with httpx.AsyncClient(timeout=180, transport=_transport) as c:
        r = await c.post("https://api.anthropic.com/v1/messages", json=body, headers=headers)
    if r.status_code != 200:
        raise RuntimeError(f"anthropic {r.status_code}")
    text = "".join(b.get("text", "") for b in r.json().get("content", []) if b.get("type") == "text").strip()
    if text.startswith("```"):
        text = text.strip("`").split("\n", 1)[-1]
    out = json.loads(text[text.index("[") : text.rindex("]") + 1])
    if not isinstance(out, list) or len(out) != len(job.texts):
        raise RuntimeError("model returned a different number of strings")
    return [str(t) for t in out]


@app.post("/api/translate")
@limiter.limit(lambda: RATE)
async def translate(request: Request, job: Annotated[Job, Body()]):
    chars = sum(len(t) for t in job.texts)
    if chars > MAX_CHARS:
        return error("too-big", 413)
    if job.source == job.target:
        return {"texts": job.texts}
    started = time.monotonic()
    try:
        if not API_KEY:
            return error("not-found", 404)
        if budget_left() < chars:
            return error("busy", 429)
        _budget["used"] += chars
        out = await pro(job)
    except (httpx.HTTPError, RuntimeError, ValueError) as e:
        # The reason only (never the text): it may be someone's contract.
        log.warning("translate %s failed: %s", job.engine, type(e).__name__ if isinstance(e, ValueError) else e)
        return error("busy", 503)
    log.info("translate %s %s→%s %d chars %.1fs", job.engine, job.source, job.target, chars, time.monotonic() - started)
    return {"texts": out}
