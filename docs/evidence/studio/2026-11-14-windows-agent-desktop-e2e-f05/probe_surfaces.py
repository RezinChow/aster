#!/usr/bin/env python3
"""Probe alternate AX surfaces for the model-selector popup."""
import json
import time
from pathlib import Path

import drive
from drive import APP

EV = Path(__file__).resolve().parent
MODEL = "e2e-synthetic-1"
SURFACES = ["window", "focused", "menu", "menubar", "sheet",
            "popover", "alert", "toolbar"]


def main():
    d = drive.Driver()
    d.case, d.run = "SURF", 0
    wid = d.window()
    if not wid:
        print("NO WINDOW", flush=True)
        return 1
    d.to_workbench()
    time.sleep(0.8)
    m = d.one("选择模型", "menubutton")
    if not m:
        print("SELECTOR NOT FOUND", flush=True)
        return 1
    r = d.ax("click", m["ref_id"])
    print(f"selector click ok={r.get('ok')}", flush=True)
    time.sleep(2.0)

    ws = d.ax("list-windows", "--app", APP).get("data") or []
    print(f"windows after click={len(ws)}", flush=True)
    for w in ws:
        print(f"   {w.get('id')} title={w.get('title')!r}", flush=True)

    out = {"window_id": wid, "selector_click_ok": r.get("ok"),
           "windows_after": [{"id": w.get("id"), "title": w.get("title")}
                             for w in ws], "surfaces": {}}
    for s in SURFACES:
        entry = {}
        for label, args in [
            ("model", ["find", "--app", APP, "--surface", s,
                       "--name", MODEL]),
            ("option", ["find", "--app", APP, "--surface", s,
                        "--role", "option"]),
            ("menuitem", ["find", "--app", APP, "--surface", s,
                          "--role", "menuitem"]),
        ]:
            q = d.ax(*args)
            data = q.get("data") or {}
            ms = data.get("matches", []) or []
            entry[label] = {
                "ok": q.get("ok"),
                "error_code": (q.get("error") or {}).get("code"),
                "total_matches": data.get("total_matches"),
                "named": [x.get("name") for x in ms if x.get("name")][:15],
            }
        out["surfaces"][s] = entry
        print(f"  surface={s:<10} model={entry['model']['total_matches']} "
              f"option={entry['option']['total_matches']} "
              f"menuitem={entry['menuitem']['total_matches']} "
              f"err={entry['model']['error_code']}", flush=True)
        if entry["menuitem"]["named"]:
            print(f"      menuitems={entry['menuitem']['named'][:10]}",
                  flush=True)
    (EV / "probe-surfaces.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("SURF_DONE", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
