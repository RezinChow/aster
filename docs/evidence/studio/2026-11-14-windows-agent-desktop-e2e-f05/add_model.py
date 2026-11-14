#!/usr/bin/env python3
"""Add the synthetic model from the provider's model-picker window.

Environment precondition. Records AX evidence of the model node before/after.
"""
import json
import time
from pathlib import Path

import drive
from drive import APP

EV = Path(__file__).resolve().parent
MODEL = "e2e-synthetic-1"


def main():
    d = drive.Driver()
    d.case, d.run = "ADDMODEL", 0
    wid = d.window()
    if not wid:
        print("NO WINDOW", flush=True)
        return 1
    rec = {"window_id": wid, "model": MODEL}

    def find(name, exact=False):
        args = ["find", "--app", APP, "--window-id", wid, "--name", name]
        if exact:
            args.append("--exact")
        r = d.ax(*args)
        data = r.get("data") or {}
        return data.get("total_matches"), data.get("matches", []) or []

    total, ms = find(MODEL)
    rec["model_nodes_before"] = {
        "total_matches": total,
        "matches": [{"name": m.get("name"), "role": m.get("role"),
                     "ref_id": m.get("ref_id"), "states": m.get("states")}
                    for m in ms[:10]],
    }
    print(f"MODEL NODES BEFORE total={total}", flush=True)
    for m in ms[:10]:
        print(f"   name={m.get('name')!r} role={m.get('role')} "
              f"ref={m.get('ref_id')} states={m.get('states')}", flush=True)

    # Select all discovered models, then confirm. Prefer the exact model node
    # when it exposes a ref; fall back to the 全选 button.
    clicked_model = False
    for m in ms:
        if m.get("ref_id") and m.get("role") in ("checkbox", "listitem", "row",
                                                  "button", "menuitem", "option"):
            r = d.ax("click", m["ref_id"])
            print(f"MODEL NODE CLICK ok={r.get('ok')} "
                  f"err={((r.get('error') or {}).get('code'))}", flush=True)
            clicked_model = True
            break
    if not clicked_model:
        sel = d.one("全选", "button")
        if not sel:
            print("全选 NOT FOUND", flush=True)
            rec["error"] = "no selection control"
            (EV / "add-model.json").write_text(
                json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")
            return 1
        r = d.ax("click", sel["ref_id"])
        print(f"全选 CLICK ok={r.get('ok')}", flush=True)
    rec["selection_method"] = "model node" if clicked_model else "全选"
    time.sleep(1.0)

    total2, ms2 = find(MODEL)
    rec["model_nodes_after_select"] = {"total_matches": total2}
    print(f"MODEL NODES AFTER SELECT total={total2}", flush=True)

    confirm = d.one("添加所选模型", "button")
    if not confirm:
        print("添加所选模型 NOT FOUND", flush=True)
        rec["error"] = "confirm button missing"
        (EV / "add-model.json").write_text(
            json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")
        return 1
    r = d.ax("click", confirm["ref_id"])
    rec["confirm_click"] = {"ok": r.get("ok"),
                            "error_code": (r.get("error") or {}).get("code")}
    print(f"添加所选模型 CLICK ok={r.get('ok')} "
          f"err={rec['confirm_click']['error_code']}", flush=True)
    time.sleep(2.5)

    t3, m3 = find(MODEL)
    t4, m4 = find("添加所选模型")
    rec["post_confirm"] = {
        "model_total_matches": t3,
        "add_button_total_matches": t4,
        "model_sample": [{"name": x.get("name"), "role": x.get("role")}
                         for x in m3[:6]],
    }
    print(f"POST CONFIRM model_total={t3} add_button_total={t4}", flush=True)
    (EV / "add-model.json").write_text(
        json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")
    print("ADDMODEL_DONE", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
