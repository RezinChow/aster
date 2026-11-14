#!/usr/bin/env python3
"""Screenshot the workbench immediately after clicking 选择模型."""
import json
import time
from pathlib import Path

import drive
from drive import APP

EV = Path(__file__).resolve().parent


def main():
    d = drive.Driver()
    d.case, d.run = "SHOT", 0
    wid = d.window()
    if not wid:
        print("NO WINDOW", flush=True)
        return 1
    d.to_workbench()
    time.sleep(0.8)
    m = d.one("选择模型", "menubutton")
    print(f"selector ref={m['ref_id'] if m else None}", flush=True)
    if not m:
        return 1
    r = d.ax("click", m["ref_id"])
    print(f"click ok={r.get('ok')}", flush=True)
    time.sleep(1.5)
    shot_path = EV / "screenshots" / "selector-open.png"
    shot = d.ax("screenshot", str(shot_path), "--app", APP,
                "--window-id", wid)
    (EV / "selector-screenshot.json").write_text(
        json.dumps(shot, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"screenshot ok={shot.get('ok')} "
          f"data={json.dumps(shot.get('data'), ensure_ascii=False)[:300]}",
          flush=True)
    print("SHOT_DONE", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
