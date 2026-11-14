#!/usr/bin/env python3
"""Local loopback OpenAI-compatible SYNTHETIC model service for F05 E2E.

IMPORTANT: this is NOT a real LLM and NOT a stub suite. It is only an
environment precondition so Studio's real provider/model plumbing can be
configured and exercised through the real GUI. Every coverage assertion is
made on an `agent-desktop` AX JSON envelope; HTTP traffic here is recorded
as environment evidence only.

Safety properties:
  * binds 127.0.0.1 only, fixed port passed as argv[1] (default 4399)
  * no outbound network access, no filesystem writes outside its evidence dir
  * shuts down cleanly on a line of stdin ("quit"/"exit"/"stop")
  * records every request path + payload to local-llm-events.jsonl
  * supports GET /v1/models, POST /v1/chat/completions (JSON and SSE stream)
"""
import json
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

EV = Path(__file__).resolve().parent
EVENTS = EV / "local-llm-events.jsonl"
PORTFILE = EV / "local-llm-port.txt"
READY = EV / "local-llm-ready.json"
MODEL = "e2e-synthetic-1"
REPLY = "E2E-SYNTHETIC-REPLY"


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def _send(self, code, obj, ctype="application/json"):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _record(self, path, payload):
        with EVENTS.open("a", encoding="utf-8") as f:
            f.write(json.dumps({"path": path, "payload": payload},
                               ensure_ascii=False) + "\n")

    def do_GET(self):
        self._record(self.path, None)
        if self.path.rstrip("/").endswith("/models"):
            self._send(200, {"object": "list", "data": [
                {"id": MODEL, "object": "model", "created": 0,
                 "owned_by": "e2e-fixture"}]})
        else:
            self._send(404, {"error": {"message": "not found", "type": "e2e"}})

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            payload = {"raw": raw.decode("utf-8", "replace")[:500]}
        self._record(self.path, payload)

        if "chat/completions" not in self.path:
            self._send(200, {"ok": True})
            return

        base = {"id": "chatcmpl-e2e", "created": 0, "model": MODEL,
                "system_fingerprint": "e2e-fixture"}
        if payload.get("stream"):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "close")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            chunks = [
                {"choices": [{"index": 0, "delta": {"role": "assistant",
                                                    "content": REPLY},
                              "finish_reason": None}], **base,
                 "object": "chat.completion.chunk"},
                {"choices": [{"index": 0, "delta": {},
                              "finish_reason": "stop"}], **base,
                 "object": "chat.completion.chunk"},
            ]
            for c in chunks:
                self.wfile.write(("data: " + json.dumps(c) + "\n\n").encode())
            self.wfile.write(b"data: [DONE]\n\n")
            self.wfile.flush()
            self.close_connection = True
            return
        else:
            self._send(200, {**base, "object": "chat.completion",
                             "choices": [{"index": 0,
                                          "message": {"role": "assistant",
                                                      "content": REPLY},
                                          "finish_reason": "stop"}],
                             "usage": {"prompt_tokens": 1,
                                       "completion_tokens": 1,
                                       "total_tokens": 2}})

    def do_OPTIONS(self):
        self._send(200, {"ok": True})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4399
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    PORTFILE.write_text(str(port), encoding="utf-8")
    READY.write_text(json.dumps({"port": port, "model": MODEL,
                                 "bound": "127.0.0.1", "reply": REPLY,
                                 "note": "synthetic, not a real LLM"},
                                indent=2), encoding="utf-8")
    print(json.dumps({"port": port, "model": MODEL, "bound": "127.0.0.1"}),
          flush=True)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    # A background shell may give us EOF on stdin immediately. Stay alive until
    # either a stdin "quit" line or the stop-file appears, so teardown is
    # deterministic and never requires killing an unrelated process.
    stop = EV / "local-llm-stop"
    stop.unlink(missing_ok=True)
    quit_flag = threading.Event()

    def watch_stdin():
        for line in sys.stdin:
            if line.strip().lower() in ("quit", "exit", "stop"):
                quit_flag.set()
                return

    threading.Thread(target=watch_stdin, daemon=True).start()
    while not quit_flag.is_set() and not stop.exists():
        time.sleep(0.5)
    srv.shutdown()
    srv.server_close()
    stop.unlink(missing_ok=True)
    PORTFILE.unlink(missing_ok=True)
    print("SHUTDOWN_OK", flush=True)


if __name__ == "__main__":
    main()
