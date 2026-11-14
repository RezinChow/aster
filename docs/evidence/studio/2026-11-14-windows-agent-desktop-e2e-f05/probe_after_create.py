#!/usr/bin/env python3
"""Enumerate AX controls after the custom provider was created."""
import json
from pathlib import Path

import drive
from drive import APP

EV = Path(__file__).resolve().parent
ROLES = ["textfield", "combobox", "button", "menubutton", "radio", "switch"]


def main():
    d = drive.Driver()
    d.case, d.run = "AFTER", 0
    wid = d.window()
    if not wid:
        print("NO WINDOW", flush=True)
        return 1
    out = {"window_id": wid, "roles": {}}
    for role in ROLES:
        r = d.ax("find", "--app", APP, "--window-id", wid, "--role", role)
        data = r.get("data") or {}
        ms = data.get("matches", []) or []
        out["roles"][role] = {
            "total_matches": data.get("total_matches"),
            "matches": [{"name": m.get("name"), "role": m.get("role"),
                         "ref_id": m.get("ref_id"),
                         "states": m.get("states")} for m in ms],
        }
        print(f"--- {role} total={data.get('total_matches')} ---", flush=True)
        for m in ms[:45]:
            if m.get("name"):
                print(f"   name={m.get('name')!r} ref={m.get('ref_id')}",
                      flush=True)
    (EV / "probe-after-create.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("AFTER_DONE", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
