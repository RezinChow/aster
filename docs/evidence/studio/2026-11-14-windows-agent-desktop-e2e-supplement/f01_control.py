#!/usr/bin/env python3
"""F01 root-cause control experiment.

Temporarily aligns ONLY the single runtime file touched by cc0a7bd09 to the
parent gitlink, lets the rsbuild dev server hot-reload, runs F01 twice, and
ALWAYS restores the original file in `finally`.

This is a causal control, not a rewrite of the archived FAIL: the user's
worktree (07ffdfcf5) still fails F01.
"""
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path

EV = Path(__file__).resolve().parent
ROOT = Path("D:/code/aster")
SUB = ROOT / "apps/studio"
FILE = "src/renderer/components/app/sidebarShortcuts/runtime.tsx"
GITLINK = "944864f2775fd75609ea811f28b96e7b96b27552"


def git(*args):
    return subprocess.run(["git", "-C", str(SUB), *args],
                          capture_output=True, text=True, encoding="utf-8")


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    path = SUB / FILE
    original = sha(path)
    record = {"control": "F01 single-file gitlink alignment",
              "file": FILE, "gitlink": GITLINK,
              "original_sha256": original}
    print(f"original sha256 : {original}", flush=True)
    aligned = False
    try:
        r = git("checkout", GITLINK, "--", FILE)
        print(f"align rc={r.returncode} stderr={r.stderr.strip()[:200]}", flush=True)
        if r.returncode != 0:
            record["error"] = "align checkout failed"
            return 1
        aligned = True
        new = sha(path)
        record["aligned_sha256"] = new
        record["file_changed"] = new != original
        print(f"aligned sha256  : {new} changed={new != original}", flush=True)

        time.sleep(30)
        print("waited 30s for rsbuild HMR", flush=True)

        results = []
        for run in (1, 2):
            rc = subprocess.call(
                [sys.executable, str(EV / "supplement_cases.py"),
                 "--case", "F01C", "--run", str(run)], cwd=str(ROOT))
            results.append({"run": run, "exit": rc})
            print(f"F01C run{run} exit={rc}", flush=True)
        record["runs"] = results
        record["all_pass"] = all(x["exit"] == 0 for x in results)
        print(f"CONTROL_ALL_PASS: {record['all_pass']}", flush=True)
        return 0 if record["all_pass"] else 1
    finally:
        if aligned:
            r = git("checkout", "HEAD", "--", FILE)
            restored = sha(path)
            record["restore_rc"] = r.returncode
            record["restored_sha256"] = restored
            record["restore_matches_original"] = restored == original
            print(f"restore rc={r.returncode} sha256={restored} "
                  f"match={restored == original}", flush=True)
        (EV / "f01-control.json").write_text(
            json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
