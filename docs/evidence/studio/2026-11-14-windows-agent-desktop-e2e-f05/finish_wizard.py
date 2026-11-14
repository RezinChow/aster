#!/usr/bin/env python3
"""Close the model-addition wizard and navigate back to the workbench."""
import json
import time
from pathlib import Path

import drive
from drive import APP

EV = Path(__file__).resolve().parent
KEYS = ["描述任务", "设置", "选择模型", "工作", "返回应用", "模型服务",
        "完成", "E2E-Local"]


def census(d, wid, tag):
    out = {}
    print(f"--- {tag} ---", flush=True)
    for nm in KEYS:
        r = d.ax("find", "--app", APP, "--window-id", wid, "--name", nm)
        data = r.get("data") or {}
        ms = data.get("matches", []) or []
        out[nm] = {"total_matches": data.get("total_matches"),
                   "sample": [{"name": x.get("name"), "role": x.get("role"),
                               "ref_id": x.get("ref_id")} for x in ms[:5]]}
        print(f"  {nm:<14} total={data.get('total_matches')} "
              f"roles={[x.get('role') for x in ms[:3]]}", flush=True)
    return out


def main():
    d = drive.Driver()
    d.case, d.run = "WIZARD", 0
    wid = d.window()
    if not wid:
        print("NO WINDOW", flush=True)
        return 1
    rec = {"window_id": wid}
    rec["before"] = census(d, wid, "before 完成")

    done = d.one("完成", "button")
    if done:
        r = d.ax("click", done["ref_id"])
        rec["finish_click"] = {"ok": r.get("ok"),
                               "error_code": (r.get("error") or {}).get("code")}
        print(f"完成 CLICK ok={r.get('ok')}", flush=True)
        time.sleep(2.0)
    else:
        rec["finish_click"] = {"ok": False, "why": "not found"}
    rec["after_finish"] = census(d, wid, "after 完成")

    # back to workbench: settings overlay exposes 返回应用 / 工作
    back = d.one("返回应用", "button")
    if back:
        w = d.one("工作", "button")
        if w:
            r = d.ax("click", w["ref_id"])
            rec["work_click"] = r.get("ok")
            print(f"工作 CLICK ok={r.get('ok')}", flush=True)
            time.sleep(1.5)
    rec["after_work"] = census(d, wid, "after 工作")
    (EV / "finish-wizard.json").write_text(
        json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")
    print("WIZARD_DONE", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
