#!/usr/bin/env python3
"""F01 case: one independent run per process; assertions only from agent-desktop AX."""
import argparse
import json
import sys
import uuid
from pathlib import Path

import drive

EV = Path(__file__).resolve().parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", type=int, required=True)
    a = ap.parse_args()
    d = drive.Driver()
    d.case, d.run = "F01-RELEASE", a.run
    token = f"RLF01{a.run}{uuid.uuid4().hex[:4].upper()}"
    print(f"=== F01-RELEASE run {a.run} token={token} ===", flush=True)
    verdict = "PASS"
    error = None
    try:
        drive.case_F01(d, token)
    except AssertionError as e:
        verdict, error = "FAIL", str(e)
        print(f"  ASSERTION FAILED: {e}", flush=True)
    except Exception as e:
        verdict, error = "ERROR", f"{type(e).__name__}: {e}"
        print(f"  ERROR: {error}", flush=True)
    out = {
        "case": "F01-RELEASE",
        "run": a.run,
        "verdict": verdict,
        "token": token,
        "window_id": d.window_id,
        "assertion_count": len(d.evidence),
        "evidence": d.evidence,
        "error": error,
        "scope": "F01 draft round-trip on gitlink-aligned release worktree (944864f2)",
        "assertion_source": "agent-desktop AX only",
    }
    (EV / f"f01-release-run{a.run}.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"F01_RELEASE_L3: {verdict} assertions={len(d.evidence)}", flush=True)
    return 0 if verdict == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
