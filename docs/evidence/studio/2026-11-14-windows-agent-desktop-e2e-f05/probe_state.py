#!/usr/bin/env python3
"""Diagnose the current window/page state after provider + model setup."""
import json
from pathlib import Path

import drive
from drive import APP

EV = Path(__file__).resolve().parent
NAMES = ["描述任务", "设置", "选择模型", "工作", "返回应用", "模型服务",
         "模型配置", "E2E-Local", "e2e-synthetic-1", "添加所选模型",
         "跳过", "返回", "新建任务"]


def main():
    d = drive.Driver()
    d.case, d.run = "STATE", 0
    ws = d.ax("list-windows", "--app", APP).get("data") or []
    wid = d.window()
    out = {"window_id": wid,
           "windows": [{"id": w.get("id"), "title": w.get("title"),
                        "pid": w.get("pid"), "visible": w.get("visible")}
                       for w in ws]}
    print(f"windows={len(ws)} active={wid}", flush=True)
    for w in ws:
        print(f"   {w.get('id')} title={w.get('title')!r} pid={w.get('pid')}",
              flush=True)
    for nm in NAMES:
        r = d.ax("find", "--app", APP, "--window-id", wid, "--name", nm)
        data = r.get("data") or {}
        ms = data.get("matches", []) or []
        out.setdefault("names", {})[nm] = {
            "total_matches": data.get("total_matches"),
            "sample": [{"name": x.get("name"), "role": x.get("role"),
                        "ref_id": x.get("ref_id")} for x in ms[:6]],
        }
        print(f"  {nm:<20} total={data.get('total_matches')} "
              f"roles={[x.get('role') for x in ms[:4]]}", flush=True)
    for role in ["menubutton", "button"]:
        r = d.ax("find", "--app", APP, "--window-id", wid, "--role", role)
        ms = [x for x in ((r.get("data") or {}).get("matches", []) or [])
              if x.get("name")]
        print(f"--- named {role}: {len(ms)} ---", flush=True)
        for x in ms[:30]:
            print(f"   {x.get('name')!r} ref={x.get('ref_id')}", flush=True)
        out.setdefault("roles", {})[role] = [
            {"name": x.get("name"), "ref_id": x.get("ref_id")} for x in ms[:40]]
    (EV / "probe-state.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("STATE_DONE", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
