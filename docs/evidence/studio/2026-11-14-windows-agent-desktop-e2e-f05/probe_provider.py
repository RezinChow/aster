#!/usr/bin/env python3
"""Read-only AX reconnaissance: Settings -> 模型服务 -> 添加服务商 form."""
import json
import time
from pathlib import Path

import drive
from drive import APP

EV = Path(__file__).resolve().parent

PAGE_NAMES = [
    "添加服务商", "添加提供商", "模型服务", "模型配置", "服务商",
    "API 地址", "端点 URL", "配置自定义模型", "模型列表", "添加",
    "搜索", "保存", "确定", "取消", "名称", "类型", "自定义",
]
FORM_NAMES = [
    "添加提供商", "提供商名称", "提供商类型", "API 地址", "API Key",
    "端点 URL", "名称", "类型", "保存", "确定", "取消", "添加",
    "自定义", "模型", "地址", "密钥", "服务商", "选择", "更多",
]


def census(d, wid, names):
    out = {}
    for nm in names:
        r = d.ax("find", "--app", APP, "--window-id", wid, "--name", nm)
        data = r.get("data") or {}
        ms = data.get("matches", []) or []
        out[nm] = {
            "ok": r.get("ok"),
            "total_matches": data.get("total_matches"),
            "sample": [{"name": m.get("name"), "role": m.get("role"),
                        "ref_id": m.get("ref_id"),
                        "states": m.get("states"),
                        "description": m.get("description")}
                       for m in ms[:8]],
        }
    return out


def show(tag, res):
    print(f"--- {tag} ---", flush=True)
    for nm, v in res.items():
        if v["total_matches"]:
            roles = [s["role"] for s in v["sample"]]
            print(f"  {nm:<16} total={v['total_matches']:<3} roles={roles}",
                  flush=True)
            for s in v["sample"][:4]:
                print(f"      name={s['name']!r} role={s['role']} "
                      f"ref={s['ref_id']}", flush=True)


def main():
    d = drive.Driver()
    d.case, d.run = "PROBE2", 0
    wid = d.window()
    if not wid:
        print("NO WINDOW", flush=True)
        return 1
    # ensure we are in Settings
    if not d.one("返回应用", "button"):
        c = d.click("设置", "button")
        print(f"settings click ok={c.get('ok')}", flush=True)
        time.sleep(1.5)

    c = d.click("模型服务", "button")
    print(f"模型服务 click ok={c.get('ok')} code={((c.get('error') or {}).get('code'))}",
          flush=True)
    time.sleep(2.0)
    page = census(d, wid, PAGE_NAMES)
    show("provider page", page)

    add = d.one("添加服务商", "button")
    out = {"window_id": wid, "provider_page_click_ok": c.get("ok"),
           "page": page, "note": "read-only AX reconnaissance"}
    if add:
        a = d.ax("click", add["ref_id"])
        print(f"添加服务商 click ok={a.get('ok')} "
              f"code={((a.get('error') or {}).get('code'))}", flush=True)
        time.sleep(1.5)
        form = census(d, wid, FORM_NAMES)
        show("add-provider form", form)
        out["add_click_ok"] = a.get("ok")
        out["form"] = form
        snap = d.ax("snapshot", "-i", "--compact", "--app", APP,
                    "--window-id", wid)
        (EV / "probe-provider-snapshot.json").write_text(
            json.dumps(snap, ensure_ascii=False, indent=2), encoding="utf-8")
        out["snapshot_complete"] = (snap.get("data") or {}).get("complete")
    else:
        print("添加服务商 NOT FOUND", flush=True)
        out["add_click_ok"] = False
        out["form"] = {}

    (EV / "probe-provider.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("PROBE2_DONE", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
