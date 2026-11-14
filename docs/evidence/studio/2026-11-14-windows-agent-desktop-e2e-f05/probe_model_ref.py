#!/usr/bin/env python3
"""Last attempt: locate an actionable AX ref for the model row."""
import json
import time
from pathlib import Path

import drive
from drive import APP

EV = Path(__file__).resolve().parent
MODEL = "e2e-synthetic-1"


def main():
    d = drive.Driver()
    d.case, d.run = "MODELREF", 0
    wid = d.window()
    if not wid:
        print("NO WINDOW", flush=True)
        return 1
    d.to_workbench()
    m = d.one("选择模型", "menubutton")
    if not m:
        print("SELECTOR NOT FOUND", flush=True)
        return 1
    if d.one("关闭模型选择", "button") is None:
        d.ax("expand", m["ref_id"])
        time.sleep(1.2)
    print(f"popup_open={d.one('关闭模型选择', 'button') is not None}",
          flush=True)
    out = {"window_id": wid, "popup_open": d.one("关闭模型选择", "button") is not None,
           "selectors": {}}

    for flag in ["--name", "--value", "--text", "--description"]:
        q = d.ax("find", "--app", APP, "--window-id", wid, flag, MODEL)
        data = q.get("data") or {}
        ms = data.get("matches", []) or []
        out["selectors"][flag] = {
            "ok": q.get("ok"),
            "error_code": (q.get("error") or {}).get("code"),
            "total_matches": data.get("total_matches"),
            "matches": [{"name": x.get("name"), "role": x.get("role"),
                         "ref_id": x.get("ref_id"),
                         "states": x.get("states")} for x in ms[:10]],
        }
        print(f"  {flag:<14} total={data.get('total_matches')} "
              f"err={(q.get('error') or {}).get('code')}", flush=True)
        for x in ms[:10]:
            print(f"     role={x.get('role')} name={x.get('name')!r} "
                  f"ref={x.get('ref_id')} states={x.get('states')}",
                  flush=True)

    # every unnamed actionable ref in the popup
    unnamed = []
    for role in ["button", "checkbox", "radio", "switch", "menuitem", "option"]:
        q = d.ax("find", "--app", APP, "--window-id", wid, "--role", role)
        ms = (q.get("data") or {}).get("matches", []) or []
        for x in ms:
            if not x.get("name") and x.get("ref_id"):
                g = d.ax("get", x["ref_id"], "--property", "text")
                unnamed.append({"role": role, "ref_id": x["ref_id"],
                                "text": (g.get("data") or {}).get("value")})
    out["unnamed_actionable"] = unnamed
    print(f"unnamed actionable refs: {len(unnamed)}", flush=True)
    for x in unnamed[:25]:
        print(f"   role={x['role']} ref={x['ref_id']} text={x['text']!r}",
              flush=True)

    (EV / "probe-model-ref.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("MODELREF_DONE", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
