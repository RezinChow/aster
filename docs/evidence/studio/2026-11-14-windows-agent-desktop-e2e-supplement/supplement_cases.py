#!/usr/bin/env python3
"""Supplement E2E cases: F16 a11y/error-state UI subset + F01 root-cause control.

Every observation/action is an agent-desktop CLI call (via drive.Driver).
"""
import argparse
import json
import sys
import time
import uuid
from pathlib import Path

import drive
from drive import APP, COMPOSER

EV = Path(__file__).resolve().parent
VALID_ROLES = {"textfield", "button", "menubutton", "switch", "combobox",
               "checkbox", "statictext", "link", "menuitem", "option", "radio"}
CONTROL_NAMES = ["描述任务", "设置", "新建任务", "更多选项", "选择模型",
                 "连接器", "技能", "自动化", "项目", "最近"]


def total(d):
    data = d.get("data")
    return (data or {}).get("total_matches") if isinstance(data, dict) else 0


def case_F16(d, token):
    """F16 UI subset: AX name/role integrity, state properties, empty-result
    state, focus/panel recovery. NOT a claim of full error/offline/crash E2E."""
    d.to_workbench()

    snap = d.ax("snapshot", "-i", "--compact", "--app", APP,
                "--window-id", d.window_id, "--timeout-ms", "30000")
    d.check("F16 snapshot complete",
            (snap.get("data") or {}).get("complete") is True)

    checked = []
    for nm in CONTROL_NAMES:
        fd = d.ax("find", "--app", APP, "--window-id", d.window_id, "--name", nm)
        for m in ((fd.get("data") or {}).get("matches") or []):
            if m.get("ref_id"):
                checked.append((m.get("name"), m.get("role")))
    d.check("F16 named AX controls enumerated", len(checked) >= 5,
            f"count={len(checked)}")
    bad = [(n, r) for n, r in checked if not n or r not in VALID_ROLES]
    d.check("F16 controls have non-empty name and valid role", len(bad) == 0,
            f"bad={bad[:5]} total={len(checked)}")

    comp = d.one(COMPOSER, "textfield")
    d.check("F16 composer ref available", comp is not None)
    for prop in ("enabled", "focused", "visible"):
        r = d.ax("is", comp["ref_id"], "--property", prop)
        d.check(f"F16 is --property {prop} readable",
                r.get("ok") is True, f"data={r.get('data')}")

    opened = d.click("设置", "button")
    d.check("F16 settings click delivered", opened.get("ok") is True)
    time.sleep(1.2)
    entry = d.one("搜索设置", "button")
    d.check("F16 search entry exists", entry is not None)
    d.click("搜索设置", "button")
    time.sleep(1.0)
    cb = d.one("搜索设置", "combobox")
    d.check("F16 search combobox available", cb is not None)

    query = "ZZZ_NO_SUCH_SETTING_9F3C"
    d.ax("--headed", "type", cb["ref_id"], query)
    time.sleep(1.2)
    v = d.value("搜索设置", "combobox")
    d.check("F16 unmatched query entered", v is not None and query in str(v),
            f"readback={v!r}")
    lb = d.ax("find", "--app", APP, "--window-id", d.window_id,
              "--name", "设置搜索结果")
    d.check("F16 no result listbox for unmatched query", total(lb) == 0,
            f"matches={total(lb)}")
    nav = d.ax("find", "--app", APP, "--window-id", d.window_id,
               "--name", "网络搜索", "--exact")
    d.check("F16 settings navigation intact on empty result", total(nav) > 0,
            f"matches={total(nav)}")

    d.ax("press", "escape", "--app", APP)
    time.sleep(0.6)
    d.click("工作", "button")
    time.sleep(0.9)
    back = d.one(COMPOSER, "textfield")
    d.check("F16 workbench recovered after empty search and escape",
            back is not None)
    d.clear_composer()


def case_F01C(d, token):
    """Root-cause control: F01 on the gitlink renderer (single-file align).
    Evidence only; does NOT overwrite the archived FAIL on the user worktree."""
    drive.case_F01(d, token)


CASES = {"F16": case_F16, "F01C": case_F01C}


def run_one(case, run):
    d = drive.Driver()
    d.case, d.run = case, run
    token = f"SUP{case}{uuid.uuid4().hex[:4].upper()}"
    print(f"=== {case} run {run} token={token} ===", flush=True)
    verdict = "PASS"
    try:
        CASES[case](d, token)
    except AssertionError as e:
        verdict = "FAIL"
        print(f"  ASSERTION FAILED: {e}", flush=True)
    except Exception as e:
        verdict = "ERROR"
        print(f"  ERROR: {type(e).__name__}: {e}", flush=True)
    out = {"case": case, "run": run, "verdict": verdict, "token": token,
           "window_id": d.window_id, "evidence": d.evidence}
    (EV / f"supp-{case}-run{run}.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{case}_L3: {verdict}", flush=True)
    return verdict


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--case", required=True)
    ap.add_argument("--run", type=int, default=1)
    a = ap.parse_args()
    cases = list(CASES) if a.case == "ALL" else [a.case]
    verdicts = [run_one(c, a.run) for c in cases]
    return 0 if all(v == "PASS" for v in verdicts) else 1


if __name__ == "__main__":
    sys.exit(main())
