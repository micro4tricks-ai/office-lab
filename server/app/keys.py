"""API keys for other programs (scripts, office systems): their own, higher rate limit.

The site itself needs no key. Only SHA-256 hashes are kept, in API_KEYS ("name:hash,name:hash").
Make one with:  docker compose exec api python -m app.keys new "accounting-office"
"""

import hashlib
import secrets
import sys

from fastapi import Request

from .config import settings
from .errors import ToolError

PREFIX = "olab_"


def digest(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def known() -> dict[str, str]:
    """hash → key name, from settings.api_keys."""
    out = {}
    for item in settings.api_keys:
        name, _, h = item.rpartition(":")
        if name and len(h) == 64:
            out[h.lower()] = name
    return out


def given(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip() or None
    return request.headers.get("x-api-key", "").strip() or None


def key_name(request: Request) -> str | None:
    """The name of a valid key sent with the request, None without one; a wrong key is refused."""
    key = given(request)
    if key is None:
        return None
    name = known().get(digest(key))
    if name is None:
        raise ToolError("bad-key")
    return name


def new(name: str) -> tuple[str, str]:
    key = PREFIX + secrets.token_urlsafe(32)
    return key, f"{name}:{digest(key)}"


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] != "new" or not sys.argv[2].replace("-", "").replace("_", "").isalnum():
        sys.exit('usage: python -m app.keys new <name>   (letters, digits, - and _)')
    key, line = new(sys.argv[2])
    print(f"Key (give it to the user once, it is not stored):\n  {key}\n")
    print(f"Add to API_KEYS in deploy/.env (comma-separated), then restart the api service:\n  {line}")
