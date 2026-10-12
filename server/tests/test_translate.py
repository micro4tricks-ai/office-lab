"""Translation service: limits, engines, budget (engines mocked; no network)."""

import pytest
from fastapi.testclient import TestClient

from app import translate as tr


@pytest.fixture
def client(monkeypatch):
    async def fake_pro(job):
        return [f"[{job.target}] {t}" for t in job.texts]

    monkeypatch.setattr(tr, "pro", fake_pro)
    monkeypatch.setattr(tr, "API_KEY", "sk-test")
    monkeypatch.setattr(tr, "RATE", "10000/minute")
    tr._budget.update(day="", used=0)
    return TestClient(tr.app)


def test_status_without_key(client, monkeypatch):
    monkeypatch.setattr(tr, "API_KEY", "")
    assert client.get("/api/translate/status").json() == {"pro": False, "languages": ["en", "ar", "fr"]}


def test_translation(client):
    r = client.post("/api/translate", json={"texts": ["Hello", "World"], "source": "en", "target": "ar"})
    assert r.json() == {"texts": ["[ar] Hello", "[ar] World"]}


def test_same_language_is_returned_as_is(client):
    assert client.post("/api/translate", json={"texts": ["x"], "source": "ar", "target": "ar"}).json() == {"texts": ["x"]}


def test_pro_needs_a_key(client, monkeypatch):
    monkeypatch.setattr(tr, "API_KEY", "")
    r = client.post("/api/translate", json={"texts": ["Hi"], "engine": "pro"})
    assert r.status_code == 404


def test_pro_daily_budget(client, monkeypatch):
    monkeypatch.setattr(tr, "API_KEY", "sk-test")
    monkeypatch.setattr(tr, "DAILY_CHARS", 10)
    assert client.post("/api/translate", json={"texts": ["12345"], "engine": "pro"}).status_code == 200
    assert client.post("/api/translate", json={"texts": ["12345"], "engine": "pro"}).status_code == 200
    r = client.post("/api/translate", json={"texts": ["1"], "engine": "pro"})
    assert (r.status_code, r.json()) == (429, {"code": "busy"})
    assert client.get("/api/translate/status").json()["pro"] is False


@pytest.mark.parametrize(
    "body",
    [
        {"texts": []},
        {"texts": ["x"] * 201},
        {"texts": ["x"], "target": "de"},
        {"texts": ["x"], "engine": "free"},
        {"texts": "x"},
    ],
)
def test_bad_requests(client, body):
    assert client.post("/api/translate", json=body).status_code == 422


def test_too_much_text(client):
    r = client.post("/api/translate", json={"texts": ["x" * 15_000, "y" * 15_000]})
    assert (r.status_code, r.json()) == (413, {"code": "too-big"})


def test_engine_failure_is_busy_and_text_not_logged(client, monkeypatch, caplog):
    async def broken(job):
        raise RuntimeError("anthropic 500")

    monkeypatch.setattr(tr, "pro", broken)
    r = client.post("/api/translate", json={"texts": ["سري للغاية"]})
    assert (r.status_code, r.json()) == (503, {"code": "busy"})
    assert "سري" not in caplog.text


def test_claude_request_and_reply_parsing(monkeypatch):
    """The real `pro` against a mocked Anthropic API: key header, model, prompt, fenced JSON reply."""
    import asyncio
    import json

    import httpx

    seen = {}

    def handler(request: httpx.Request):
        seen["key"] = request.headers["x-api-key"]
        seen["body"] = json.loads(request.content)
        reply = "```json" + chr(10) + '["مرحبا", "العالم"]' + chr(10) + "```"
        return httpx.Response(200, json={"content": [{"type": "text", "text": reply}]})

    monkeypatch.setattr(tr, "API_KEY", "sk-test")
    monkeypatch.setattr(tr, "_transport", httpx.MockTransport(handler))
    out = asyncio.run(tr.pro(tr.Job(texts=["Hello", "World"], source="en", target="ar")))
    assert out == ["مرحبا", "العالم"]
    assert seen["key"] == "sk-test"
    assert seen["body"]["model"] == tr.MODEL
    assert "exactly 2 strings" in seen["body"]["system"] and "Arabic" in seen["body"]["system"]
    assert json.loads(seen["body"]["messages"][0]["content"]) == ["Hello", "World"]


def test_claude_wrong_count_is_an_error(monkeypatch):
    import asyncio

    import httpx

    monkeypatch.setattr(tr, "API_KEY", "sk-test")
    monkeypatch.setattr(tr, "_transport", httpx.MockTransport(lambda r: httpx.Response(200, json={"content": [{"type": "text", "text": '["one"]'}]})))
    with pytest.raises(RuntimeError):
        asyncio.run(tr.pro(tr.Job(texts=["a", "b"], target="ar")))
