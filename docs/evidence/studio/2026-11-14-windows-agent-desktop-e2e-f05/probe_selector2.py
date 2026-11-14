#!/usr/bin/env python3
"""Deep AX enumeration of the open model-selector popup."""
import json
import time
from pathlib import Path

import drive
from drive import APP

EV = Path(__file__).resolve().parent
ROLES = ["statictext", "group", "menuitem", "button", "option",
         "listitem", "row", "cell", "tab", "treeitem", "checkbox",
         "radio", "textfield", "combobox", "menubutton", "link"]


def main():
    d = drive.Driver()
    d.case, d.run = "SEL2", 0
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
    time.sleep(2.5)

    out = {"window_id": wid, "selector_click_ok": r.get("ok"), "roles": {}}
    for role in ROLES:
        q = d.ax("find", "--app", APP, "--window-id", wid, "--role", role)
        data = q.get("data") or {}
        ms = data.get("matches", []) or []
        named = [x for x in ms if x.get("name")]
        out["roles"][role] = {
            "total_matches": data.get("total_matches"),
            "named": [{"name": x.get("name"), "ref_id": x.get("ref_id"),
                       "states": x.get("states")} for x in named[:60]],
        }
        print(f"--- {role} total={data.get('total_matches')} named={len(named)} ---",
              flush=True)
        for x in named[:60]:
            print(f"   {x.get('name')!r} ref={x.get('ref_id')}", flush=True)

    snap = d.ax("snapshot", "-i", "--compact", "--app", APP,
                "--window-id", wid)
    (EV / "probe-selector2-snapshot.json").write_text(
        json.dumps(snap, ensure_ascii=False, indent=2), encoding="utf-8")
    (EV / "probe-selector2.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("SEL2_DONE", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
