#!/usr/bin/env python3
"""F05 UI-subset case: model selection chain reachability, twice independent.

Every assertion is an agent-desktop AX observation. This case deliberately
does NOT claim a completed model selection: the product renders model rows as
unnamed group/statictext without an actionable ref, so "click model -> read
back selection" cannot be asserted through AX. The functional verdict is
therefore PARTIAL, not PASS toward coverage.
"""
import argparse
import json
import sys
import time
import uuid
from pathlib import Path

import drive
from drive import APP

EV = Path(__file__).resolve().parent
MODEL = "e2e-synthetic-1"
CLOSE = "关闭模型选择"
ENTRIES = ["配置自定义模型", "跳转到服务商设置界面"]


def case_F05(d, token):
    d.to_workbench()
    time.sleep(0.6)

    # Idempotent start: `expand` is a toggle, so close any open popup first.
    if d.one(CLOSE, "button"):
        d.click(CLOSE, "button")
        time.sleep(0.7)
    d.check("F05 popup initially closed", d.one(CLOSE, "button") is None)

    sel = d.one("选择模型", "menubutton")
    d.check("F05 model selector menubutton present", sel is not None)
    r = d.ax("expand", sel["ref_id"])
    d.check("F05 expand action delivered", r.get("ok") is True,
            f"code={((r.get('error') or {}).get('code'))}")
    time.sleep(1.3)
    d.check("F05 model popup opened (AX close control present)",
            d.one(CLOSE, "button") is not None)

    q = d.ax("find", "--app", APP, "--window-id", d.window_id,
             "--name", MODEL)
    data = q.get("data") or {}
    total = data.get("total_matches") or 0
    d.check("F05 configured model visible in selector AX", total >= 1,
            f"total_matches={total} name={MODEL}")

    for nm in ENTRIES:
        d.check(f"F05 chain entry present: {nm}",
                d.one(nm, "button") is not None)

    sel2 = d.one("选择模型", "menubutton")
    d.check("F05 selector still available after popup opens", sel2 is not None)
    g = d.ax("get", sel2["ref_id"], "--property", "text")
    txt = (g.get("data") or {}).get("value")
    d.check("F05 selector AX text readback", txt == "选择模型",
            f"text={txt!r}")

    c = d.click(CLOSE, "button")
    d.check("F05 popup close delivered", c.get("ok") is True,
            f"code={((c.get('error') or {}).get('code'))}")
    time.sleep(0.8)
    d.check("F05 popup closed (independent AX readback)",
            d.one(CLOSE, "button") is None)
    d.check("F05 workbench recovered (composer ref available)",
            d.one(drive.COMPOSER, "textfield") is not None)


def run_one(run):
    d = drive.Driver()
    d.case, d.run = "F05", run
    token = f"E2EF05{uuid.uuid4().hex[:4].upper()}"
    print(f"=== F05 run {run} token={token} ===", flush=True)
    verdict = "PASS"
    try:
        case_F05(d, token)
    except AssertionError as e:
        verdict = "FAIL"
        print(f"  ASSERTION FAILED: {e}", flush=True)
    except Exception as e:
        verdict = "ERROR"
        print(f"  ERROR: {type(e).__name__}: {e}", flush=True)
    out = {"case": "F05", "run": run, "verdict": verdict, "token": token,
           "window_id": d.window_id, "evidence": d.evidence,
           "scope": "UI-subset reachability only; NOT a completed model selection",
           "functional_verdict": "PARTIAL"}
    (EV / f"case-F05-run{run}.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"F05_L3: {verdict}", flush=True)
    return verdict


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", type=int, default=1)
    a = ap.parse_args()
    return 0 if run_one(a.run) == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
