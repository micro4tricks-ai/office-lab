"""Errors the web app understands: the codes match `ErrorCode` in web/src/lib/registry/types.ts."""

STATUS = {
    "wrong-type": 415,
    "too-big": 413,
    "password": 422,
    "corrupted": 422,
    "pages": 422,
    "nothing": 422,
    "bad-options": 422,
    "not-found": 404,
    "bad-key": 401,
    "busy": 503,
    "timeout": 504,
    "unknown": 500,
}


class ToolError(Exception):
    def __init__(self, code: str, detail: str = ""):
        super().__init__(detail or code)
        self.code = code if code in STATUS else "unknown"

    @property
    def status(self) -> int:
        return STATUS[self.code]
