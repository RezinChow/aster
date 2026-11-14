#!/usr/bin/env python3
"""Health probe for the local loopback synthetic model fixture.

HTTP here is ENVIRONMENT EVIDENCE ONLY. It never substitutes for an
agent-desktop AX assertion and is not a coverage verdict of any kind.
"""
import json
import urllib.error
import urllib.request
from pathlib import Path

EV = Path(__file__).resolve().parent
BASE = "http://127.0.0.1:4399"
OUT = EV / "fixture-health.txt"
lines = []


def get(path):
    with urllib.request.urlopen(BASE + path, timeout=5) as r:
        return r.status, json.loads(r.read().decode("utf-8"))


def post(path, body):
    req = urllib.request.Request(
        BASE + path, data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=5) as r:
        return r.status, json.loads(r.read().decode("utf-8"))


def post_raw(path, body):
    """SSE is a text/event-stream, not a JSON document."""
    req = urllib.request.Request(
        BASE + path, data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=5) as r:
        return r.status, r.read().decode("utf-8")


try:
    s1, models = get("/v1/models")
    ids = [m["id"] for m in models.get("data", [])]
    lines.append(f"GET /v1/models            : HTTP {s1} ids={ids}")
    s2, chat = post("/v1/chat/completions", {
        "model": "e2e-synthetic-1", "stream": False,
        "messages": [{"role": "user", "content": "ping"}]})
    content = chat["choices"][0]["message"]["content"]
    lines.append(f"POST /v1/chat/completions : HTTP {s2} content={content!r}")
    s3, text = post_raw("/v1/chat/completions", {
        "model": "e2e-synthetic-1", "stream": True,
        "messages": [{"role": "user", "content": "ping"}]})
    sse_ok = "E2E-SYNTHETIC-REPLY" in text and "[DONE]" in text
    lines.append(f"POST (stream=True)        : HTTP {s3} "
                 f"sse_complete={sse_ok} bytes={len(text)}")
    ok = (s1 == 200 and "e2e-synthetic-1" in ids and s2 == 200
          and content == "E2E-SYNTHETIC-REPLY" and s3 == 200 and sse_ok)
    lines.append(f"FIXTURE: {'USABLE' if ok else 'NOT USABLE'}")
except (urllib.error.URLError, OSError, KeyError, ValueError) as e:
    lines.append(f"FIXTURE: NOT USABLE ({type(e).__name__}: {e})")

lines.append("note: synthetic local loopback service, NOT a real LLM; "
             "used only as an environment precondition")
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
