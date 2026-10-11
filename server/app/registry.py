"""Server tools. Ids match the web registry (web/src/lib/registry), which shows them to users."""

from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from .errors import ToolError


@dataclass(frozen=True)
class Opt:
    kind: Literal["choice", "int", "float", "bool", "str"]
    default: Any
    choices: tuple[str, ...] = ()
    min: float | None = None
    max: float | None = None
    maxlen: int = 200

    def parse(self, value: Any) -> Any:
        if value is None:
            return self.default
        try:
            if self.kind == "choice":
                v = str(value)
                ok = v in self.choices
            elif self.kind == "bool":
                if not isinstance(value, bool):
                    raise ValueError
                v, ok = value, True
            elif self.kind in ("int", "float"):
                if isinstance(value, bool):
                    raise ValueError
                v = int(value) if self.kind == "int" else float(value)
                ok = (self.min is None or v >= self.min) and (self.max is None or v <= self.max)
            else:
                v = str(value)
                ok = len(v) <= self.maxlen
        except (TypeError, ValueError):
            ok = False
        if not ok:
            raise ToolError("bad-options")
        return v


@dataclass
class Job:
    dir: Path
    src: Path | None  # the uploaded file, saved as input.<ext>; None for URL tools
    ext: str  # lower-case extension of the upload, no dot
    options: dict[str, Any]
    url: str | None = None
    stem: str = "document"  # the upload's name without extension (for titles)
    assets: list[Path] = field(default_factory=list)  # extra files (html-to-pdf only)
    timeout: float = 120
    # Short remark for the result (an i18n `note.*` key in the web app).
    note: str | None = None

    def out(self, ext: str) -> Path:
        return self.dir / f"output.{ext}"


Runner = Callable[[Job], Awaitable[Path]]


@dataclass(frozen=True)
class ServerTool:
    id: str
    accepts: frozenset[str]  # extensions; empty = takes a URL instead of a file
    run: Runner
    # Programs that must be on PATH, or "gotenberg" for the converter container.
    needs: tuple[str, ...] = ()
    options: Mapping[str, Opt] = field(default_factory=dict)
    params: Mapping[str, Any] = field(default_factory=dict)  # fixed options (one runner, several tools)
    timeout: int = 120
    assets: bool = False  # accepts extra files next to the main one

    def parse_options(self, raw: Mapping[str, Any]) -> dict[str, Any]:
        opts = {k: o.parse(raw.get(k)) for k, o in self.options.items()}
        return {**opts, **self.params}


TOOLS: dict[str, ServerTool] = {}


def register(tool: ServerTool) -> ServerTool:
    if tool.id in TOOLS:
        raise ValueError(f"duplicate server tool {tool.id}")
    TOOLS[tool.id] = tool
    return tool
