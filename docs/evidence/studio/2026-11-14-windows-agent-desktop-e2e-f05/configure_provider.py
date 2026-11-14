#!/usr/bin/env python3
"""Configure a custom OpenAI-compatible provider through the REAL GUI.

This is an ENVIRONMENT PRECONDITION, not a coverage case. The F05 verdict is
produced separately by case_F05, whose assertions all come from AX.
"""
import json
import time
from pathlib import Path

import drive
from drive import APP

EV = Path(__file__).resolve().parent
PROVIDER_NAME = "E2E-Local"
BASE_URL = "http://127.0.0.1:4399/v1"
API_KEY = "e2e-local-key"

POST_NAMES = ["E2E-Local", "手动添加模型", "添加模型", "模型 ID", "模型列表",
              "添加服务商", "模型服务", "保存", "确定", "取消", "添加"]


def main():
    d = drive.Driver()
    d.case, d.run = "CONF", 0
    wid = d.window()
    if not wid:
        print("NO WINDOW", flush=True)
        return 1
    rec = {"window_id": wid, "provider_name": PROVIDER_NAME,
           "base_url": BASE_URL, "api_key": API_KEY,
           "note": "GUI environment precondition; synthetic local model service"}

    def find_exact(name, role=None):
        r = d.ax("find", "--app", APP, "--window-id", wid,
                 "--name", name, "--exact")
        ms = (r.get("data") or {}).get("matches", []) or []
        return [m for m in ms if m.get("ref_id")
                and (role is None or m.get("role") == role)]

    def read(ref):
        g = d.ax("get", ref, "--property", "value")
        return (g.get("data") or {}).get("value"), g

    # ---- make sure the "添加自定义提供商" dialog is open ----
    dlg = d.ax("find", "--app", APP, "--window-id", wid,
               "--name", "添加自定义提供商")
    dlg_total = (dlg.get("data") or {}).get("total_matches") or 0
    if not dlg_total:
        if not d.one("返回应用", "button"):
            d.click("设置", "button")
            time.sleep(1.5)
        d.click("模型服务", "button")
        time.sleep(1.5)
        add = d.one("添加服务商", "button")
        if not add:
            print("添加服务商 NOT FOUND", flush=True)
            rec["error"] = "add provider button missing"
            (EV / "configure-provider.json").write_text(
                json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")
            return 1
        d.ax("click", add["ref_id"])
        time.sleep(1.5)
    rec["dialog_already_open"] = bool(dlg_total)

    def fill(label, text, role="textfield"):
        ms = find_exact(label, role)
        if not ms:
            return {"label": label, "ok": False, "why": "control not found"}
        r = d.ax("set-value", ms[0]["ref_id"], text)
        time.sleep(0.6)
        ms2 = find_exact(label, role)
        val = None
        if ms2:
            val, _ = read(ms2[0]["ref_id"])
        out = {"label": label, "expected": text, "readback": val,
               "ok": val == text, "set_ok": r.get("ok"),
               "error_code": (r.get("error") or {}).get("code")}
        print(f"  FILL {label!r} readback={val!r} ok={out['ok']} "
              f"set_ok={out['set_ok']} err={out['error_code']}", flush=True)
        return out

    rec["fields"] = [
        fill("提供商名称", PROVIDER_NAME),
        fill("OpenAI", BASE_URL),
        fill("API 密钥", API_KEY),
    ]

    add_btn = find_exact("添加", "button")
    if not add_btn:
        print("添加 button NOT FOUND", flush=True)
        rec["error"] = "confirm button missing"
        (EV / "configure-provider.json").write_text(
            json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")
        return 1
    clicked = d.ax("click", add_btn[0]["ref_id"])
    rec["confirm_click"] = {"ok": clicked.get("ok"),
                            "error_code": (clicked.get("error") or {}).get("code")}
    print(f"  CONFIRM 添加 ok={rec['confirm_click']['ok']} "
          f"err={rec['confirm_click']['error_code']}", flush=True)
    time.sleep(2.5)

    post = {}
    for nm in POST_NAMES:
        r = d.ax("find", "--app", APP, "--window-id", wid, "--name", nm)
        data = r.get("data") or {}
        ms = data.get("matches", []) or []
        post[nm] = {
            "total_matches": data.get("total_matches"),
            "sample": [{"name": m.get("name"), "role": m.get("role"),
                        "ref_id": m.get("ref_id")} for m in ms[:6]],
        }
        if data.get("total_matches"):
            print(f"  POST {nm:<14} total={data['total_matches']} "
                  f"roles={[m.get('role') for m in ms[:4]]}", flush=True)
    rec["post_create"] = post
    (EV / "configure-provider.json").write_text(
        json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")
    print("CONFIGURE_DONE", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
