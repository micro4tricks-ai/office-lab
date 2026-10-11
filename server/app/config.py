"""Settings, read once from the environment (see deploy/.env.example)."""

import os
import tempfile
from dataclasses import dataclass, field
from pathlib import Path


def _int(name: str, default: int) -> int:
    value = os.environ.get(name, "").strip()  # empty (compose passes "") = default
    return int(value) if value else default


@dataclass
class Settings:
    max_mb: int = field(default_factory=lambda: _int("MAX_MB", 100))
    retention_min: int = field(default_factory=lambda: _int("RETENTION_MIN", 60))
    # Jobs running at once; others wait up to queue_wait_s, then get "busy".
    concurrency: int = field(default_factory=lambda: _int("CONCURRENCY", os.cpu_count() or 2))
    queue_wait_s: int = field(default_factory=lambda: _int("QUEUE_WAIT_S", 60))
    rate_limit: str = field(default_factory=lambda: os.environ.get("RATE_LIMIT", "30/minute"))
    tmp_root: Path = field(
        default_factory=lambda: Path(os.environ.get("TMP_ROOT", tempfile.gettempdir())) / "office-lab-jobs"
    )
    gotenberg_url: str = field(default_factory=lambda: os.environ.get("GOTENBERG_URL", "http://gotenberg:3000"))
    # Other sites allowed to call the API (e.g. the GitHub Pages copy); empty = same origin only.
    cors_origins: list[str] = field(
        default_factory=lambda: [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
    )

    @property
    def max_bytes(self) -> int:
        return self.max_mb * 1024 * 1024


settings = Settings()
