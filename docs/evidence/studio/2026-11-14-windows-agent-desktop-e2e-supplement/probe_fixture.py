#!/usr/bin/env python3
"""Read-only feasibility probe for the repository's local synthetic model server.

Starts model_server.py on an ephemeral 127.0.0.1 port, sends one local
request, then shuts it down cleanly via its stdin protocol. No network
egress, no persistent service, no product state changes.
"""
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

EV = Path(__file__).resolve().parent
ROOT = Path("D:/code/aster/apps/studio/tests/e2e")
SERVER = ROOT / "connectors" / "model_server.py"
BASELINE = ROOT / "capability_baseline.py"
EVENTS = EV / "model-server-events.jsonl"


def main():
    print(f"server script exists   : {SERVER.exists()}  {SERVER}")
    print(f"capability_baseline    : {BASELINE.exists()}  {BASELINE}")
    if not SERVER.exists():
        print("FIXTURE: NOT AVAILABLE (script missing)")
        return 1

    p = subprocess.Popen(
        [sys.executable, str(SERVER), str(EVENTS)],
        cwd=str(SERVER.parent), stdin=subprocess.PIPE,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, encoding="utf-8", bufsize=1)
    try:
        line = p.stdout.readline()
        print(f"startup line           : {line.strip()}")
        if not line:
            err = p.stderr.read(600)
            print(f"stderr                 : {err.strip()}")
            print("FIXTURE: NOT AVAILABLE (no startup line)")
            return 1
        info = json.loads(line)
        port = int(info["port"])
        print(f"bound port             : 127.0.0.1:{port} (loopback, ephemeral)")

        url = f"http://127.0.0.1:{port}/v1/chat/completions"
        body = {"model": "probe", "stream": False,
                "messages": [{"role": "user", "content": "ping"}]}
        req = urllib.request.Request(
            url, data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                payload = r.read(1200).decode("utf-8", "replace")
                print(f"HTTP status            : {r.status}")
                print(f"response (first 500)   : {payload[:500]}")
                ok = r.status == 200 and len(payload) > 0
        except Exception as e:
            print(f"HTTP request failed    : {type(e).__name__}: {str(e)[:200]}")
            ok = False
        print(f"FIXTURE: {'AVAILABLE' if ok else 'NOT USABLE'}")
        return 0 if ok else 1
    finally:
        try:
            if p.poll() is None:
                p.stdin.write("stop\n")
                p.stdin.flush()
                p.wait(timeout=10)
            print(f"server exit code       : {p.returncode}")
        except Exception as e:
            print(f"shutdown warning       : {type(e).__name__}: {e}")
            p.kill()
            p.wait(timeout=5)
        print(f"events file            : {EVENTS.name} "
              f"({EVENTS.stat().st_size if EVENTS.exists() else 0} bytes)")


if __name__ == "__main__":
    raise SystemExit(main())
