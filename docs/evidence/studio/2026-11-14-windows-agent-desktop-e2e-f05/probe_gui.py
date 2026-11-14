#!/usr/bin/env python3
"""Read-only AX reconnaissance of the Settings -> Provider path.

No assertions and no coverage verdict here: it records which named controls
actually exist so the F05 interaction steps can be built against real AX.
"""
import json
import time
from pathlib import Path

import drive
from drive import APP

EV = Path(__file__).resolve().parent

NAMES = [
    "模型服务", "模型配置", "模型", "添加服务商", "添加提供商", "提供商名称",
    "API 地址", "配置自定义模型", "选择模型", "设置", "返回应用",
    "保存", "确定", "取消", "添加", "模型列表", "自定义", "服务商",
    "网络搜索", "连接器", "技能", "自动化",
]


def main():
    d = drive.Driver()
    d.case, d.run = "PROBE", 0
    wid = d.window()
    if not wid:
        print("NO WINDOW", flush=True)
        return 1
    print(f"window={wid}", flush=True)

    clicked = d.click("设置", "button")
    print(f"settings click ok={clicked.get('ok')}", flush=True)
    time.sleep(2.0)

    out = {"window_id": wid, "settings_click_ok": clicked.get("ok"),
           "note": "read-only AX reconnaissance, no verdict", "names": {}}
    for nm in NAMES:
        r = d.ax("find", "--app", APP, "--window-id", wid, "--name", nm)
        data = r.get("data") or {}
        ms = data.get("matches", []) or []
        out["names"][nm] = {
            "ok": r.get("ok"),
            "total_matches": data.get("total_matches"),
            "sample": [{"name": m.get("name"), "role": m.get("role"),
                        "ref_id": m.get("ref_id"),
                        "states": m.get("states")} for m in ms[:8]],
        }
    snap = d.ax("snapshot", "-i", "--compact", "--app", APP,
                "--window-id", wid)
    out["snapshot_complete"] = (snap.get("data") or {}).get("complete")
    out["snapshot_id"] = (snap.get("data") or {}).get("snapshot_id")
    (EV / "probe-gui-snapshot.json").write_text(
        json.dumps(snap, ensure_ascii=False, indent=2), encoding="utf-8")
    (EV / "probe-gui.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    for nm, v in out["names"].items():
        if v["total_matches"]:
            roles = [s["role"] for s in v["sample"]]
            print(f"  {nm:<16} total={v['total_matches']:<3} roles={roles}",
                  flush=True)
    print(f"snapshot_complete={out['snapshot_complete']}", flush=True)
    print("PROBE_DONE", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
