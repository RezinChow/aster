#!/usr/bin/env python3
"""Inspect the OPEN model popup (opened via `expand`)."""
import json
import time
from pathlib import Path

import drive
from drive import APP

EV = Path(__file__).resolve().parent
MODEL = "e2e-synthetic-1"


def main():
    d = drive.Driver()
    d.case, d.run = "POPUP", 0
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
    r = d.ax("expand", m["ref_id"])
    print(f"expand ok={r.get('ok')} err={((r.get('error') or {}).get('code'))}",
          flush=True)
    time.sleep(1.5)

    out = {"window_id": wid, "expand_ok": r.get("ok")}
    q = d.ax("find", "--app", APP, "--window-id", wid, "--name", MODEL)
    data = q.get("data") or {}
    ms = data.get("matches", []) or []
    out["model_matches"] = [{"name": x.get("name"), "role": x.get("role"),
                             "ref_id": x.get("ref_id"),
                             "states": x.get("states"),
                             "description": x.get("description"),
                             "value": x.get("value")} for x in ms]
    print(f"--- model total={data.get('total_matches')} ---", flush=True)
    for x in ms:
        print(f"   name={x.get('name')!r} role={x.get('role')} "
              f"ref={x.get('ref_id')} states={x.get('states')} "
              f"value={x.get('value')!r}", flush=True)

    for role in ["menuitem", "option", "checkbox", "radio", "button",
                 "statictext", "group"]:
        q = d.ax("find", "--app", APP, "--window-id", wid, "--role", role)
        dd = q.get("data") or {}
        named = [x for x in (dd.get("matches", []) or []) if x.get("name")]
        out.setdefault("roles", {})[role] = [
            {"name": x.get("name"), "ref_id": x.get("ref_id"),
             "states": x.get("states")} for x in named[:40]]
        print(f"--- role={role} total={dd.get('total_matches')} "
              f"named={len(named)} ---", flush=True)
        for x in named[:25]:
            print(f"   {x.get('name')!r} ref={x.get('ref_id')} "
                  f"states={x.get('states')}", flush=True)

    sel = d.one("选择模型", "menubutton")
    if sel:
        for prop in ["text", "value", "title"]:
            g = d.ax("get", sel["ref_id"], "--property", prop)
            out.setdefault("selector_props", {})[prop] = g.get("data")
            print(f"  selector {prop} = {json.dumps(g.get('data'), ensure_ascii=False)[:200]}",
                  flush=True)

    shot = d.ax("screenshot", str(EV / "screenshots" / "model-popup-open.png"),
                "--app", APP, "--window-id", wid)
    out["screenshot_ok"] = shot.get("ok")
    (EV / "probe-popup.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("POPUP_DONE", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
