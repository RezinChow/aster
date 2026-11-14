#!/usr/bin/env python3
"""Read-only AX census helper for the Windows agent-desktop E2E evidence run.

Makes NO state-changing action except `restore` when the window is minimized
(required by the platform skill to observe the window at all).
"""
import json
import subprocess
import sys
import time
from pathlib import Path

EXE = r"C:\Users\admin\.workbuddy\binaries\node\versions\22.22.2-6\node_modules\agent-desktop\bin\agent-desktop-win32-x64.exe"
APP = "Studio.exe"
EV = Path(__file__).resolve().parent
OUT = EV / (sys.argv[1] if len(sys.argv) > 1 else "probe-ax-snapshot.json")


def ax(*args, timeout=90):
    p = subprocess.run([EXE, *args], capture_output=True, text=True,
                       timeout=timeout, encoding="utf-8")
    return json.loads(p.stdout)


wins = ax("list-windows", "--app", APP).get("data") or []
w = wins[0] if wins else None
print("window:", json.dumps(w, ensure_ascii=False), flush=True)
if w and w.get("minimized"):
    ax("restore", "--app", APP)
    time.sleep(1.5)

def snapshot_ready():
    """Cold WebView AX trees need time after restore; poll for content nodes."""
    best = None
    for i in range(14):
        cur = ax("list-windows", "--app", APP).get("data") or []
        if cur and cur[0].get("minimized"):
            ax("restore", "--app", APP)
            time.sleep(1.0)
        s = ax("snapshot", "--app", APP, "--window-id", w["id"], "-i",
               "--compact", "--timeout-ms", "30000")
        best = s
        rc = (s.get("data") or {}).get("ref_count") or 0
        print(f"poll {i}: ref_count={rc} minimized={bool(cur and cur[0].get('minimized'))}",
              flush=True)
        if rc >= 40:
            return s
        time.sleep(1.5)
    return best


s = snapshot_ready()
OUT.write_text(json.dumps(s, ensure_ascii=False, indent=2), encoding="utf-8")

nodes = []


def walk(n, depth=0):
    if not isinstance(n, dict):
        return
    if n.get("name"):
        nodes.append({"role": n.get("role"), "name": n.get("name"),
                      "states": n.get("states"), "value": n.get("value"),
                      "ref_id": n.get("ref_id"), "depth": depth})
    for c in n.get("children") or []:
        walk(c, depth + 1)


walk((s.get("data") or {}).get("tree", {}))
data = s.get("data") or {}
print("complete:", data.get("complete"), "ref_count:", data.get("ref_count"),
      "named_nodes:", len(nodes), flush=True)
for n in nodes:
    if n["role"] in ("switch", "checkbox", "button", "menubutton",
                     "textfield", "combobox", "tab", "menuitem", "option"):
        print(f"{n['role']} | {n['name']} | states={n['states']} | ref={n['ref_id']}",
              flush=True)
