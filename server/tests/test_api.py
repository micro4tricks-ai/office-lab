"""API behaviour with a fake tool: limits, errors, clean-up. Runs anywhere (no converters needed)."""

import io
import json
import time
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import main
from app.config import settings
from app.errors import ToolError
from app.jobs import check_zip, sweep
from app.registry import TOOLS, Job, Opt, ServerTool
from app.tools.office import check_url


async def _echo(job: Job) -> Path:
    if job.options["fail"]:
        raise ToolError("corrupted")
    out = job.out("txt")
    names = ",".join(p.name for p in job.assets)
    out.write_text(f"{job.src.read_text() if job.src else job.url}|{job.options['n']}|{names}", encoding="utf-8")
    job.note = "kept-original" if job.options["n"] == 7 else None
    return out


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "tmp_root", tmp_path / "jobs")
    monkeypatch.setattr(settings, "max_mb", 1)
    monkeypatch.setattr(settings, "rate_limit", "1000/minute")
    fake = ServerTool("echo", frozenset({"txt"}), _echo, (), {"n": Opt("int", 1, min=0, max=9), "fail": Opt("bool", False)},
                      assets=True)
    url_tool = ServerTool("echo-url", frozenset(), _echo, (), {"n": Opt("int", 1), "fail": Opt("bool", False)})
    monkeypatch.setitem(TOOLS, "echo", fake)
    monkeypatch.setitem(TOOLS, "echo-url", url_tool)
    with TestClient(main.app) as c:
        yield c


def post(c, tool="echo", name="a.txt", body=b"hello", **kw):
    files = {"file": (name, body)} if name else None
    return c.post(f"/api/convert/{tool}", files=files, **kw)


def test_health(client):
    assert client.get("/api/health").json() == {"ok": True}


def test_capabilities_list_only_tools_whose_programs_exist(client, monkeypatch):
    async def no_gotenberg():
        return False

    monkeypatch.setattr(main.gotenberg, "available", no_gotenberg)
    monkeypatch.setattr(main.shutil, "which", lambda name: None)
    tools = client.get("/api/capabilities").json()["tools"]
    assert "echo" in tools and "echo-url" in tools  # needs nothing
    assert "word-to-pdf" not in tools and "pandoc" not in tools and "document-convert" not in tools


def test_converts_and_names_the_download_after_the_upload(client):
    r = post(client, name="تقرير.txt", data={"options": json.dumps({"n": 3})})
    assert r.status_code == 200
    assert r.text == "hello|3|"
    assert "filename*=utf-8''%D8%AA%D9%82%D8%B1%D9%8A%D8%B1.txt" in r.headers["content-disposition"]
    assert "x-office-lab-note" not in r.headers


def test_note_header(client):
    assert post(client, data={"options": '{"n": 7}'}).headers["x-office-lab-note"] == "kept-original"


def test_job_folder_is_removed_after_success_and_failure(client):
    post(client)
    post(client, data={"options": '{"fail": true}'})
    assert list(settings.tmp_root.iterdir()) == []


@pytest.mark.parametrize(
    ("kw", "status", "code"),
    [
        ({"tool": "nope"}, 404, "not-found"),
        ({"name": "a.exe"}, 415, "wrong-type"),
        ({"name": None}, 422, "nothing"),
        ({"body": b""}, 422, "corrupted"),
        ({"body": b"x" * (1024 * 1024 + 1)}, 413, "too-big"),
        ({"data": {"options": '{"n": 99}'}}, 422, "bad-options"),
        ({"data": {"options": '{"n": true}'}}, 422, "bad-options"),
        ({"data": {"options": "[1]"}}, 422, "bad-options"),
        ({"data": {"options": "{oops"}}, 422, "bad-options"),
        ({"data": {"options": '{"fail": true}'}}, 422, "corrupted"),
    ],
)
def test_errors_use_the_web_app_codes(client, kw, status, code):
    r = post(client, **kw)
    assert (r.status_code, r.json()) == (status, {"code": code})


def test_url_tools_take_a_url_instead_of_a_file(client):
    r = client.post("/api/convert/echo-url", data={"url": "https://example.com"})
    assert r.text.startswith("https://example.com|1")
    assert client.post("/api/convert/echo-url").json() == {"code": "nothing"}


def test_assets_are_saved_under_safe_names_only(client):
    ok = client.post("/api/convert/echo", files=[("file", ("i.txt", b"x")), ("assets", ("cairo.woff2", b"f")),
                                                 ("assets", ("paged.js", b"j"))])
    assert ok.text == "x|1|cairo.woff2,paged.js"
    up = client.post("/api/convert/echo", files=[("file", ("i.txt", b"x")), ("assets", ("../../evil.woff2", b"f"))])
    assert up.text == "x|1|evil.woff2"  # the folder part is dropped: it lands inside the job folder
    for bad in ("run.sh", "index.html", "a b.css", "..", "x.html"):
        r = client.post("/api/convert/echo", files=[("file", ("i.txt", b"x")), ("assets", (bad, b"f"))])
        assert r.json() == {"code": "bad-options"}, bad


def test_oversized_body_is_refused_before_reading(client):
    r = client.post("/api/convert/echo", content=b"x", headers={"content-length": str(100 * 1024 * 1024),
                                                                "content-type": "multipart/form-data; boundary=x"})
    assert r.status_code == 413


def test_rate_limit(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit", "2/minute")
    main.limiter.reset()
    codes = [post(client).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_zip_bomb_guard(tmp_path):
    bomb = tmp_path / "b.docx"
    with zipfile.ZipFile(bomb, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("big.xml", b"\0" * (60 * 1024 * 1024))
    with pytest.raises(ToolError) as e:
        check_zip(bomb)
    assert e.value.code == "too-big"
    fine = tmp_path / "f.docx"
    with zipfile.ZipFile(fine, "w") as z:
        z.writestr("word/document.xml", "<w/>")
    check_zip(fine)
    (tmp_path / "not.zip").write_bytes(b"PK\x03\x04broken")
    check_zip(tmp_path / "not.zip")  # not a real zip: left to the converter


def test_sweeper_removes_only_old_jobs(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "tmp_root", tmp_path)
    (tmp_path / "old").mkdir()
    (tmp_path / "new").mkdir()
    assert sweep(now=time.time() + settings.retention_min * 60 - 5) == 0
    import os

    os.utime(tmp_path / "old", (0, 0))
    assert sweep() == 1
    assert [p.name for p in tmp_path.iterdir()] == ["new"]


@pytest.mark.parametrize("url", ["https://example.com", "http://example.com/a?b=c#d", "https://ar.wikipedia.org/wiki/مصر"])
def test_good_urls(url):
    assert check_url(f"  {url} ") == url


@pytest.mark.parametrize("url", ["file:///etc/passwd", "ftp://x.com", "javascript:alert(1)", "https://user@host.com",
                                 "http://", "https://a.com/" + "x" * 2000, "", None])
def test_bad_urls(url):
    with pytest.raises(ToolError):
        check_url(url)


def test_safe_stem():
    assert main.safe_stem("../../etc/passwd.pdf") == "passwd"
    assert main.safe_stem(r"C:\Users\x\تقرير مهم.docx") == "تقرير مهم"
    assert main.safe_stem('a<b>:"c|?*.pdf') == "abc"
    assert main.safe_stem("...") == "document"


def test_every_tool_has_valid_defaults():
    for t in TOOLS.values():
        t.parse_options({})  # defaults pass their own checks
        assert t.timeout > 0


def test_upload_streaming_stops_at_limit(tmp_path):
    import asyncio

    from fastapi import UploadFile

    from app.jobs import save_upload

    up = UploadFile(io.BytesIO(b"x" * 5000), filename="a")
    with pytest.raises(ToolError):
        asyncio.run(save_upload(up, tmp_path / "o", limit=4096))
