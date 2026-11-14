#!/usr/bin/env python3
"""Strict F01 control with cold restarts.

Confounder to remove: in the earlier single-file HMR control, rsbuild DID
rebuild runtime.tsx (renderer log shows `start building ...` -> `ready built`),
but the already-open Electron window may never have reloaded the new bundle.
A cold restart forces the window to load the aligned bundle from scratch.

Two conditional phases:
  Phase A: align ONLY runtime.tsx to GITLINK + cold restart + F01C x2
  Phase B: (only if A fails) align ALL renderer diffs to GITLINK
           + cold restart + F01C x2

Deliberately does NOT touch src-tauri/*, package.json or scripts/*: that keeps
Cargo.lock --locked consistency and avoids recompiling Rust for a renderer
behaviour question. WIP (reasoning_effort.rs) is untouched (already stashed).

Every file ever checked out is restored to HEAD in `finally`, with a sha256
comparison against the pre-experiment bytes.
"""
import hashlib
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

import drive
import restart_cases
from drive import APP

EV = Path(__file__).resolve().parent
ROOT = Path("D:/code/aster")
SUB = ROOT / "apps/studio"
HEAD = "07ffdfcf56f8a2a21efce49be17ed4aaf3142cbb"
GITLINK = "944864f2775fd75609ea811f28b96e7b96b27552"
SINGLE = "src/renderer/components/app/sidebarShortcuts/runtime.tsx"


def git(*args):
    return subprocess.run(["git", "-C", str(SUB), *args],
                          capture_output=True, text=True, encoding="utf-8")


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else "MISSING"


def renderer_files():
    r = git("diff", "--name-only", HEAD, GITLINK, "--", "src/renderer")
    return [f.strip() for f in r.stdout.splitlines()
            if f.strip() and "node_modules" not in f]


def cold_restart(tag, record):
    """Close the live window, wait for dev-server teardown, relaunch, wait AX."""
    d = drive.Driver()
    d.case, d.run = "BOOT", 0
    pre = d.ax("list-windows", "--app", APP).get("data") or []
    print(f"[{tag}] windows before restart: {len(pre)}", flush=True)
    if pre:
        c = d.ax("close-app", APP, "--force")
        print(f"[{tag}] close-app ok={c.get('ok')}", flush=True)
        for _ in range(60):
            if not (d.ax("list-windows", "--app", APP).get("data") or []):
                break
            time.sleep(1)
    time.sleep(5)  # let studio-dev.mjs kill the rsbuild dev server / free 4318
    restart_cases._launch(tag)
    new, ws = restart_cases.wait_window(d, attempts=600)
    if not new:
        print(f"[{tag}] NO WINDOW after cold restart", flush=True)
        return None
    d.window_id = new["id"]
    ready = restart_cases.wait_content(d)
    print(f"[{tag}] window={new['id']} pid={new['pid']} content_ready={ready}",
          flush=True)
    record.setdefault("restarts", []).append(
        {"tag": tag, "window": new["id"], "pid": new["pid"],
         "content_ready": ready})
    return ready


def run_f01c(phase, record):
    runs = []
    for run in (1, 2):
        rc = subprocess.call(
            [sys.executable, str(EV / "supplement_cases.py"),
             "--case", "F01C", "--run", str(run)], cwd=str(ROOT))
        src = EV / f"supp-F01C-run{run}.json"
        dst = EV / f"f01-control-{phase}-run{run}.json"
        if src.exists():
            shutil.copyfile(src, dst)
        runs.append({"run": run, "exit": rc})
        print(f"[{phase}] F01C run{run} exit={rc}", flush=True)
    all_pass = all(x["exit"] == 0 for x in runs)
    record.setdefault("phases", []).append(
        {"phase": phase, "runs": runs, "all_pass": all_pass})
    return all_pass


def main():
    files = renderer_files()
    record = {
        "control": "conditional two-phase cold-restart F01 control",
        "head": HEAD, "gitlink": GITLINK,
        "renderer_diff_count": len(files),
        "single_file": SINGLE,
        "note": ("renderer log proves HMR rebuilt runtime.tsx in the earlier "
                 "single-file control; cold restart removes the "
                 "'window never reloaded' confounder"),
    }
    originals = {f: sha(SUB / f) for f in files}
    record["original_runtime_sha256"] = originals.get(SINGLE)
    touched = []
    try:
        # ---- Phase A: single file + cold restart ----
        r = git("checkout", GITLINK, "--", SINGLE)
        if r.returncode != 0:
            record["error"] = f"Phase A align failed: {r.stderr.strip()[:300]}"
            (EV / "f01-full-control.json").write_text(
                json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
            return 1
        touched = [SINGLE]
        record["phaseA_aligned_sha256"] = sha(SUB / SINGLE)
        record["phaseA_changed"] = sha(SUB / SINGLE) != originals[SINGLE]
        print(f"Phase A aligned runtime.tsx changed={record['phaseA_changed']}",
              flush=True)
        if not cold_restart("F01-CONTROL-A", record):
            record["error"] = "Phase A cold restart did not reach AX-ready window"
            return 1
        a_pass = run_f01c("A", record)
        print(f"PHASE_A_ALL_PASS: {a_pass}", flush=True)
        record["phaseA_all_pass"] = a_pass

        if a_pass:
            record["conclusion"] = (
                "Single-file alignment + cold restart restores F01. The earlier "
                "single-file HMR control failed because the already-open window "
                "never reloaded the rebuilt bundle. cc0a7bd09 is the direct "
                "root cause of the user-worktree F01 FAIL.")
            record["phaseB_skipped"] = True
            print("Phase B skipped: Phase A already isolates the root cause",
                  flush=True)
        else:
            # ---- Phase B: full renderer alignment + cold restart ----
            record["phaseB_skipped"] = False
            r = git("checkout", GITLINK, "--", *files)
            print(f"Phase B align rc={r.returncode} stderr={r.stderr.strip()[:200]}",
                  flush=True)
            if r.returncode != 0:
                record["error"] = "Phase B align failed"
                return 1
            touched = list(files)
            changed = sum(1 for f in files if sha(SUB / f) != originals[f])
            record["phaseB_files_changed"] = changed
            print(f"Phase B files actually changed: {changed}/{len(files)}",
                  flush=True)
            if not cold_restart("F01-CONTROL-B", record):
                record["error"] = "Phase B cold restart did not reach AX-ready window"
                return 1
            b_pass = run_f01c("B", record)
            print(f"PHASE_B_ALL_PASS: {b_pass}", flush=True)
            record["phaseB_all_pass"] = b_pass
            if b_pass:
                record["conclusion"] = (
                    "Full gitlink renderer alignment + cold restart restores "
                    "F01, but single-file alignment does not: additional "
                    "renderer changes are required. The user-worktree F01 FAIL "
                    "is reproducible, exact root cause not isolated.")
            else:
                record["conclusion"] = (
                    "Neither single-file nor full renderer alignment restores "
                    "F01 under a cold restart. The first-round PASS therefore "
                    "has another cause; the cc0a7bd09 root-cause hypothesis is "
                    "NOT proven. Fail-closed: no coverage claim is made.")

        record["all_pass"] = record.get("phaseA_all_pass") or record.get("phaseB_all_pass")
        print(f"CONTROL_ALL_PASS: {record['all_pass']}", flush=True)
        return 0
    finally:
        if touched:
            r = git("checkout", HEAD, "--", *touched)
            mismatches = [f for f in touched if sha(SUB / f) != originals[f]]
            record["restore_rc"] = r.returncode
            record["restore_mismatches"] = mismatches
            record["restored_runtime_sha256"] = sha(SUB / SINGLE)
            print(f"restore rc={r.returncode} mismatches={len(mismatches)}",
                  flush=True)
        (EV / "f01-full-control.json").write_text(
            json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
