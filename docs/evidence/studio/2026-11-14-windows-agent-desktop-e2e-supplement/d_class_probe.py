#!/usr/bin/env python3
"""Read-only AX evidence for the structurally unreachable functions.

Produces observations only. NEVER emits a PASS/FAIL coverage verdict.
"""
import json
from pathlib import Path

import drive
from drive import APP

EV = Path(__file__).resolve().parent

PROBES = {
    "F09_workspace_tabs_role": {"role": "tab"},
    "F09_workspace_tabs_name": {"name": "工作区"},
    "F15_capture_controls": {"names": ["截图", "录屏", "视觉标注", "标注", "屏幕录制", "Screen recording", "Screenshot"]},
    "F06_approval_controls": {"names": ["允许", "拒绝", "批准", "始终允许", "Allow", "Deny", "Approve"]},
    "F12_document_output": {"names": ["保存到文档", "导出文档", "下载文档", "Save to document", "Download"]},
    "F13_dependencies_entry": {"names": ["依赖", "运行时组件", "Dependencies", "组件安装"]},
    "F14_update_channel": {"names": ["检查更新", "更新通道", "Check for updates", "退出守卫"]},
}


def total(d):
    data = d.get("data")
    return (data or {}).get("total_matches") if isinstance(data, dict) else 0


def main():
    d = drive.Driver()
    d.case, d.run = "D-EVIDENCE", 0
    w = d.window()
    if not w:
        print("NO WINDOW")
        return 1
    out = {"window_id": w, "probe_note": "read-only AX observations; no coverage verdict",
           "results": {}}

    for key, spec in PROBES.items():
        if "role" in spec:
            r = d.ax("find", "--app", APP, "--window-id", w, "--role", spec["role"])
            out["results"][key] = {"selector": f"role={spec['role']}",
                                   "total_matches": total(r), "ok": r.get("ok")}
        elif "name" in spec:
            r = d.ax("find", "--app", APP, "--window-id", w, "--name", spec["name"])
            out["results"][key] = {"selector": f"name={spec['name']}",
                                   "total_matches": total(r), "ok": r.get("ok")}
        else:
            hits = {}
            for nm in spec["names"]:
                r = d.ax("find", "--app", APP, "--window-id", w, "--name", nm, "--exact")
                hits[nm] = total(r)
            out["results"][key] = {"names": hits,
                                   "any_hit": any(v > 0 for v in hits.values())}

    (EV / "d-class-ax-evidence.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
