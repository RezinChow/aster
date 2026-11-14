#!/usr/bin/env python3
"""Phase 0 smoke for the 2026-11-14 rerun.

Every observation is an agent-desktop AX command. Writes raw JSON evidence
for S0-S4 and a control census used to confirm that the harness assertions
still match the AX names of the renderer currently in the worktree.
"""
import json
import subprocess
from pathlib import Path

EV = Path(__file__).resolve().parent
EXE = r"C:\Users\admin\.workbuddy\binaries\node\versions\22.22.2-6\node_modules\agent-desktop\bin\agent-desktop-win32-x64.exe"
APP = "Studio.exe"

NAMES = [
    "描述任务", "设置", "搜索设置", "选择模型", "运行任务时保持系统唤醒",
    "收起侧边栏", "展开侧边栏", "更多选项", "授权模式", "新建任务",
    "连接器", "技能", "自动化", "项目", "最近", "网络搜索", "清除",
    "工作", "返回应用", "发送",
]
DIALOG_TOKENS = ["继续", "稍后设置", "跳过", "开始使用", "下一步", "允许"]


def ax(*args, timeout=120):
    p = subprocess.run([EXE, *args], capture_output=True, text=True,
                       timeout=timeout, encoding="utf-8")
    try:
        return json.loads(p.stdout)
    except Exception:
        return {"ok": False, "raw": (p.stdout or "")[:400],
                "stderr": (p.stderr or "")[:200]}


def save(name, obj):
    (EV / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2),
                           encoding="utf-8")


def total(d):
    data = d.get("data")
    return (data or {}).get("total_matches") if isinstance(data, dict) else 0


def main():
    win = ax("list-windows", "--app", APP)
    ws = win.get("data") or []
    if not ws:
        print("S1 FAIL: no Studio window")
        return 1
    w = ws[0]
    wid = w["id"]
    save("phase0-S1-window.json", win)
    print(f"S1 window_id={wid} pid={w.get('pid')} visible={w.get('visible')} "
          f"minimized={w.get('minimized')} bounds={w.get('bounds')}")

    # ---- S0 ----
    s0 = ax("status")
    save("phase0-S0-status.json", s0)
    la = ax("list-apps", "--app", APP)
    save("phase0-S0-list-apps.json", la)
    perms = (s0.get("data") or {}).get("permissions") or {}
    print(f"S0 status_ok={s0.get('ok')} version={(s0.get('data') or {}).get('version')} "
          f"accessibility={(perms.get('accessibility') or {}).get('state')} "
          f"list_apps_ok={la.get('ok')}")

    # ---- S2 ----
    snap = ax("snapshot", "-i", "--compact", "--app", APP,
              "--window-id", wid, "--timeout-ms", "30000")
    save("phase0-S2-snapshot.json", snap)
    comp = ax("find", "--app", APP, "--window-id", wid, "--name", "描述任务")
    save("phase0-S2-find-composer.json", comp)
    sd = snap.get("data") or {}
    print(f"S2 complete={sd.get('complete')} snapshot_id={sd.get('snapshot_id')} "
          f"composer_matches={total(comp)}")

    # ---- S3 ----
    dialogs = {t: total(ax("find", "--app", APP, "--window-id", wid,
                           "--name", t, "--exact")) for t in DIALOG_TOKENS}
    save("phase0-S3-dialogs.json", dialogs)
    print(f"S3 onboarding_tokens={dialogs}")

    # ---- AX control census (compatibility check against harness) ----
    census = {n: total(ax("find", "--app", APP, "--window-id", wid,
                          "--name", n)) for n in NAMES}
    save("ax-census.json", census)
    print("CENSUS " + json.dumps(census, ensure_ascii=False))

    # ---- S4 ----
    shot = EV / "screenshots" / "phase0-S4-main-window.png"
    sc = ax("screenshot", str(shot), "--app", APP, "--window-id", wid)
    save("phase0-S4-screenshot.json", sc)
    scd = sc.get("data") or {}
    print(f"S4 screenshot_ok={sc.get('ok')} format={scd.get('format')} "
          f"size={scd.get('width')}x{scd.get('height')} "
          f"bytes={shot.stat().st_size if shot.exists() else 0} path={shot}")

    ok = (s0.get("ok") is True and la.get("ok") is True
          and w.get("visible") is True and sd.get("complete") is True
          and total(comp) > 0 and all(v == 0 for v in dialogs.values())
          and sc.get("ok") is True and shot.exists() and shot.stat().st_size > 10000)
    print(f"PHASE0_L3: {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
