#!/usr/bin/env python3
"""Full-depth AX snapshot of the open model popup; locate the model row subtree."""
import json
from pathlib import Path

import drive
from drive import APP

EV = Path(__file__).resolve().parent
MODEL = "e2e-synthetic-1"


def walk(node, out, depth=0):
    if not isinstance(node, dict):
        return
    name = node.get("name") or ""
    if MODEL in str(name) or MODEL in str(node.get("description") or ""):
        out.append({"depth": depth, "role": node.get("role"),
                    "name": name, "ref_id": node.get("ref_id"),
                    "states": node.get("states"),
                    "actions": node.get("available_actions"),
                    "children_count": node.get("children_count")})
    for key in ("children", "nodes", "items"):
        ch = node.get(key)
        if isinstance(ch, list):
            for c in ch:
                walk(c, out, depth + 1)
        elif isinstance(ch, dict):
            walk(ch, out, depth + 1)


def main():
    d = drive.Driver()
    d.case, d.run = "DEEP", 0
    wid = d.window()
    if not wid:
        print("NO WINDOW", flush=True)
        return 1
    d.to_workbench()
    m = d.one("选择模型", "menubutton")
    if not m:
        print("SELECTOR NOT FOUND", flush=True)
        return 1
    # `expand` is a toggle: only open when the popup is not already open.
    already_open = d.one("关闭模型选择", "button") is not None
    if not already_open:
        r = d.ax("expand", m["ref_id"])
        print(f"expand ok={r.get('ok')}", flush=True)
    else:
        print("popup already open", flush=True)
    print(f"popup_open={d.one('关闭模型选择', 'button') is not None}",
          flush=True)

    snap = d.ax("snapshot", "-i", "--max-depth", "24", "--app", APP,
                "--window-id", wid, timeout=180)
    (EV / "deep-model-popup-snapshot.json").write_text(
        json.dumps(snap, ensure_ascii=False, indent=2), encoding="utf-8")
    data = snap.get("data") or {}
    tree = data.get("tree") or data
    print(f"snapshot ok={snap.get('ok')} complete={data.get('complete')} "
          f"bytes={(EV / 'deep-model-popup-snapshot.json').stat().st_size}",
          flush=True)

    hits = []
    walk(tree, hits)
    print(f"model-named nodes: {len(hits)}", flush=True)
    for h in hits[:20]:
        print(f"   depth={h['depth']} role={h['role']} name={h['name']!r} "
              f"ref={h['ref_id']} actions={h['actions']} "
              f"states={h['states']}", flush=True)

    # count actionable roles with refs anywhere
    actionable = {}

    def count(node):
        if not isinstance(node, dict):
            return
        role = node.get("role")
        if role in ("button", "checkbox", "radio", "menuitem", "option",
                    "listitem", "row", "switch") and node.get("ref_id"):
            actionable[role] = actionable.get(role, 0) + 1
        for key in ("children", "nodes", "items"):
            ch = node.get(key)
            if isinstance(ch, list):
                for c in ch:
                    count(c)
            elif isinstance(ch, dict):
                count(ch)

    count(tree)
    print(f"actionable ref nodes: {actionable}", flush=True)
    (EV / "deep-probe-summary.json").write_text(
        json.dumps({"snapshot_ok": snap.get("ok"),
                    "complete": data.get("complete"),
                    "model_nodes": hits, "actionable": actionable},
                   ensure_ascii=False, indent=2), encoding="utf-8")
    print("DEEP_DONE", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
