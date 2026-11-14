#!/usr/bin/env python3
"""Wait for the cold-boot window, then run the Phase 0 smoke in one resident
process (the launcher is reclaimed if the parent Python exits)."""
import subprocess
import sys
import time
from pathlib import Path

import drive
import restart_cases
from drive import APP

EV = Path(__file__).resolve().parent


def main():
    d = drive.Driver()
    d.case, d.run = "BOOT", 0
    win = None
    for i in range(600):
        ws = d.ax("list-windows", "--app", APP).get("data") or []
        vis = [w for w in ws if w.get("visible") and not w.get("minimized")]
        if vis:
            win = vis[0]
            print(f"WINDOW {win['id']} pid={win['pid']} after {i} polls",
                  flush=True)
            break
        time.sleep(1)
    if not win:
        print("NO WINDOW after 600 polls", flush=True)
        return 1
    d.window_id = win["id"]
    ready = restart_cases.wait_content(d)
    print(f"CONTENT_READY {ready}", flush=True)
    rc = subprocess.call([sys.executable, str(EV / "phase0.py")],
                         cwd=str(EV))
    print(f"PHASE0_RC {rc}", flush=True)
    return 0 if ready and rc == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
