#!/usr/bin/env python3
"""Settings-page AX census: confirm F10/F11 control names before Phase 1.

Observation-only probe (click 设置 / click 工作 are navigation, not assertions).
Restores the workbench afterwards.
"""
import json
import subprocess
import time
from pathlib import Path

EV = Path(__file__).resolve().parent
EXE = r"C:\Users\admin\.workbuddy\binaries\node\versions\22.22.2-6\node_modules\agent-desktop\bin\agent-desktop-win32-x64.exe"
APP = "Studio.exe"

NAMES = ["搜索设置", "运行任务时保持系统唤醒", "网络搜索", "返回应用",
         "清除", "设置搜索结果", "设置", "工作", "收起侧边栏", "展开侧边栏"]


def ax(*args, timeout=120):
    p = subprocess.run([EXE, *args], capture_output=True, text=True,
                       timeout=timeout, encoding="utf-8")
    try:
        return json.loads(p.stdout)
    except Exception:
        return {"ok": False, "raw": (p.stdout or "")[:300]}


def total(d):
    data = d.get("data")
    return (data or {}).get("total_matches") if isinstance(data, dict) else 0


def one(name, role=None):
    d = ax("find", "--app", APP, "--name", name)
    for m in ((d.get("data") or {}).get("matches") or []):
        if m.get("ref_id") and (role is None or m.get("role") == role):
            return m
    return None


def main():
    win = ax("list-windows", "--app", APP)
    ws = win.get("data") or []
    if not ws:
        print("NO WINDOW")
        return 1
    wid = ws[0]["id"]
    sb = one("设置", "button")
    print(f"settings_button={'found' if sb else 'MISSING'}")
    if not sb:
        return 1
    c = ax("click", sb["ref_id"])
    print(f"click_settings_ok={c.get('ok')} code={(c.get('error') or {}).get('code')}")
    time.sleep(1.5)

    census = {n: total(ax("find", "--app", APP, "--window-id", wid,
                          "--name", n)) for n in NAMES}
    (EV / "ax-settings-census.json").write_text(
        json.dumps(census, ensure_ascii=False, indent=2), encoding="utf-8")
    print("SETTINGS_CENSUS " + json.dumps(census, ensure_ascii=False))

    back = one("工作", "button") or one("返回应用", "button")
    if back:
        r = ax("click", back["ref_id"])
        print(f"restore_workbench_ok={r.get('ok')}")
    time.sleep(0.8)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
