#!/usr/bin/env python3
"""Find an agent-desktop semantic action that actually opens the model popup."""
import json
import time
from pathlib import Path

import drive
from drive import APP

EV = Path(__file__).resolve().parent
MODEL = "e2e-synthetic-1"


def main():
    d = drive.Driver()
    d.case, d.run = "EXPAND", 0
    wid = d.window()
    if not wid:
        print("NO WINDOW", flush=True)
        return 1
    d.to_workbench()
    time.sleep(0.8)
    out = {"window_id": wid, "attempts": []}

    def state(tag):
        m = d.ax("find", "--app", APP, "--window-id", wid,
                 "--name", MODEL)
        opt = d.ax("find", "--app", APP, "--window-id", wid,
                   "--role", "option")
        mi = d.ax("find", "--app", APP, "--window-id", wid,
                  "--role", "menuitem")
        s = {
            "tag": tag,
            "model_total": (m.get("data") or {}).get("total_matches"),
            "option_total": (opt.get("data") or {}).get("total_matches"),
            "menuitem_total": (mi.get("data") or {}).get("total_matches"),
            "menuitem_names": [x.get("name") for x in
                               ((mi.get("data") or {}).get("matches") or [])
                               if x.get("name")][:12],
        }
        print(f"  {tag:<22} model={s['model_total']} "
              f"option={s['option_total']} menuitem={s['menuitem_total']} "
              f"names={s['menuitem_names'][:6]}", flush=True)
        return s

    out["attempts"].append(state("baseline"))

    m = d.one("选择模型", "menubutton")
    if not m:
        print("SELECTOR NOT FOUND", flush=True)
        return 1
    ref = m["ref_id"]

    attempts = [
        ("click --headed", ["click", "--headed", ref]),
        ("expand", ["expand", ref]),
        ("expand --headed", ["expand", "--headed", ref]),
        ("press space", ["press", "space", "--app", APP, "--window-id", wid]),
    ]
    for tag, args in attempts:
        r = d.ax(*args)
        print(f"ACTION {tag} ok={r.get('ok')} "
              f"err={((r.get('error') or {}).get('code'))}", flush=True)
        time.sleep(1.5)
        d.window()  # restore if a headed action minimized the window
        s = state(tag)
        s["action_ok"] = r.get("ok")
        s["action_error"] = (r.get("error") or {}).get("code")
        out["attempts"].append(s)
        if s["model_total"] or (s["option_total"] or 0) > 0:
            print(f"POPUP OPENED by {tag}", flush=True)
            break

    shot = d.ax("screenshot", str(EV / "screenshots" / "selector-expand.png"),
                "--app", APP, "--window-id", wid)
    out["screenshot_ok"] = shot.get("ok")
    (EV / "probe-expand.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("EXPAND_DONE", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
