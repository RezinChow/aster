#!/usr/bin/env python3
"""Read-only recon of the workbench model selector after provider setup."""
import json
import time
from pathlib import Path

import drive
from drive import APP

EV = Path(__file__).resolve().parent
MODEL = "e2e-synthetic-1"


def main():
    d = drive.Driver()
    d.case, d.run = "PROBESEL", 0
    wid = d.window()
    if not wid:
        print("NO WINDOW", flush=True)
        return 1
    d.to_workbench()
    time.sleep(1.0)

    m = d.one("选择模型", "menubutton")
    print(f"选择模型 ref={m['ref_id'] if m else None}", flush=True)
    if not m:
        print("SELECTOR NOT FOUND", flush=True)
        return 1
    r = d.ax("click", m["ref_id"])
    print(f"selector click ok={r.get('ok')} "
          f"err={((r.get('error') or {}).get('code'))}", flush=True)
    time.sleep(1.8)

    out = {"window_id": wid, "selector_click_ok": r.get("ok")}
    for nm in [MODEL, "选择模型", "E2E-Local", "配置自定义模型", "搜索模型"]:
        q = d.ax("find", "--app", APP, "--window-id", wid, "--name", nm)
        data = q.get("data") or {}
        ms = data.get("matches", []) or []
        out.setdefault("names", {})[nm] = {
            "total_matches": data.get("total_matches"),
            "matches": [{"name": x.get("name"), "role": x.get("role"),
                         "ref_id": x.get("ref_id"),
                         "states": x.get("states")} for x in ms[:10]],
        }
        print(f"--- {nm} total={data.get('total_matches')} ---", flush=True)
        for x in ms[:10]:
            print(f"   name={x.get('name')!r} role={x.get('role')} "
                  f"ref={x.get('ref_id')} states={x.get('states')}",
                  flush=True)

    for role in ["radio", "checkbox", "menuitem", "option", "menubutton"]:
        q = d.ax("find", "--app", APP, "--window-id", wid, "--role", role)
        data = q.get("data") or {}
        ms = [x for x in (data.get("matches", []) or []) if x.get("name")]
        out.setdefault("roles", {})[role] = [
            {"name": x.get("name"), "ref_id": x.get("ref_id")} for x in ms[:25]]
        print(f"--- role={role} named={len(ms)} ---", flush=True)
        for x in ms[:25]:
            print(f"   {x.get('name')!r} ref={x.get('ref_id')}", flush=True)

    (EV / "probe-selector.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("PROBESEL_DONE", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
