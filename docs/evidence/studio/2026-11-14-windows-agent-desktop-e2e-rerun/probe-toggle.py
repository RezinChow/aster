#!/usr/bin/env python3
"""One-off probe of AX switch toggle semantics; restores original state."""
import json, subprocess, time
from pathlib import Path
EXE = r"C:/Users/admin/.workbuddy/binaries/node/versions/22.22.2-6/node_modules/agent-desktop/bin/agent-desktop-win32-x64.exe"
APP = "Studio.exe"
EV = Path(".").resolve()
records = []

def ax(*args, timeout=90):
    p = subprocess.run([EXE, *args], capture_output=True, text=True, timeout=timeout, encoding="utf-8")
    return json.loads(p.stdout)

def window():
    ws = ax("list-windows", "--app", APP).get("data") or []
    if not ws:
        return None
    if ws[0].get("minimized"):
        ax("restore", "--app", APP)
        time.sleep(1.0)
    return ws[0]["id"]

def find(name):
    w = window()
    if not w:
        return []
    return (ax("find", "--app", APP, "--window-id", w, "--name", name).get("data") or {}).get("matches", [])

def rec(label, obj):
    records.append({"label": label, "data": obj})
    print(label, json.dumps(obj, ensure_ascii=False)[:900], flush=True)

before = find("\u6536\u8d77\u4fa7\u8fb9\u680f")
rec("sidebar_before", before)
if before:
    ref = before[0]["ref_id"]
    rec("get_checked", ax("get", ref, "--property", "checked"))
    r = ax("toggle", ref)
    rec("toggle_response", {"ok": r.get("ok"), "error": r.get("error"), "data": r.get("data")})
    time.sleep(1.2)
    rec("after_toggle_collapse", find("\u6536\u8d77\u4fa7\u8fb9\u680f"))
    rec("after_toggle_expand", find("\u5c55\u5f00\u4fa7\u8fb9\u680f"))
    cur = find("\u6536\u8d77\u4fa7\u8fb9\u680f") or find("\u5c55\u5f00\u4fa7\u8fb9\u680f")
    if cur:
        rr = ax("toggle", cur[0]["ref_id"])
        rec("restore_response", {"ok": rr.get("ok"), "error": rr.get("error")})
        time.sleep(1.2)
    rec("sidebar_final", find("\u6536\u8d77\u4fa7\u8fb9\u680f") or find("\u5c55\u5f00\u4fa7\u8fb9\u680f"))
else:
    rec("collapsed_before", find("\u5c55\u5f00\u4fa7\u8fb9\u680f"))
(EV / "probe-toggle.json").write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
