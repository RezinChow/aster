#!/usr/bin/env python3
"""Cold-start F01 re-verification on the release-aligned worktree.

One long-lived Python process: studio-dev.mjs is Popen'd here and would be
reaped if this process exited before the window appeared. Every GUI
observation/action is an agent-desktop AX command; disk facts are environment
evidence only, never substitutes for UI assertions.
"""
import hashlib
import json
import re
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
EXE_BIN = ROOT / "target/studio/aster/debug/Studio.exe"
RUNTIME = SUB / "src/renderer/components/app/sidebarShortcuts/runtime.tsx"


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else "MISSING"


def git(*args, cwd=ROOT):
    return subprocess.run(["git", "-C", str(cwd), *args],
                          capture_output=True, text=True, encoding="utf-8",
                          errors="replace").stdout.strip()


def exe_info():
    if not EXE_BIN.exists():
        return {"path": str(EXE_BIN), "exists": False}
    return {
        "path": str(EXE_BIN),
        "exists": True,
        "sha256": sha(EXE_BIN),
        "size": EXE_BIN.stat().st_size,
        "mtime": time.strftime("%Y-%m-%d %H:%M:%S",
                               time.localtime(EXE_BIN.stat().st_mtime)),
    }


def versions():
    out = {}
    lock = (ROOT / "Cargo.lock").read_text(encoding="utf-8")
    m = re.search(r'name = "aster-studio"\s*\nversion = "([^"]+)"', lock)
    out["Cargo.lock"] = m.group(1) if m else "MISSING"
    toml = (SUB / "src-tauri/Cargo.toml").read_text(encoding="utf-8")
    m = re.search(r'^version = "([^"]+)"', toml, re.M)
    out["Cargo.toml"] = m.group(1) if m else "MISSING"
    for key, p in (("package.json", SUB / "package.json"),
                   ("tauri.conf.json", SUB / "src-tauri/tauri.conf.json")):
        m = re.search(r'"version"\s*:\s*"([^"]+)"', p.read_text(encoding="utf-8"))
        out[key] = m.group(1) if m else "MISSING"
    return out


def main():
    tree = git("ls-tree", "HEAD", "apps/studio")
    rec = {
        "purpose": "F01 2x independent PASS on gitlink-aligned release worktree",
        "submodule_head": git("rev-parse", "HEAD", cwd=SUB),
        "parent_gitlink": tree.split()[2] if tree else "MISSING",
        "versions": versions(),
        "runtime_sha256_before": sha(RUNTIME),
        "studio_exe_before": exe_info(),
        "assertion_source": "agent-desktop AX only",
        "scope": "F01 draft round-trip; no coverage claim beyond this case",
    }
    print("[META] head=%s gitlink=%s versions=%s" % (
        rec["submodule_head"][:12], rec["parent_gitlink"][:12],
        rec["versions"]), flush=True)
    d = drive.Driver()
    d.case, d.run = "BOOT", 0
    pre = d.ax("list-windows", "--app", APP).get("data") or []
    rec["windows_before"] = len(pre)
    try:
        if pre:
            d.ax("close-app", APP, "--force")
            for _ in range(60):
                if not (d.ax("list-windows", "--app", APP).get("data") or []):
                    break
                time.sleep(1)
            time.sleep(5)
        # Cold start: studio-dev.mjs runs cargo build --locked twice itself.
        # A fresh window is required so the aligned renderer bundle is loaded.
        restart_cases._launch("F01-RELEASE")
        new, ws = restart_cases.wait_window(d, attempts=900)
        if not new:
            rec["error"] = "no AX window after cold start"
            return 1
        d.window_id = new["id"]
        rec["window"] = {"id": new["id"], "pid": new.get("pid"),
                         "visible": new.get("visible")}
        rec["content_ready"] = restart_cases.wait_content(d, attempts=120)
        print("[BOOT] window=%s pid=%s content_ready=%s" % (
            new["id"], new.get("pid"), rec["content_ready"]), flush=True)
        if not rec["content_ready"]:
            rec["error"] = "window never reached AX-ready content"
            return 1
        rec["studio_exe_after"] = exe_info()

        rc0 = subprocess.call([sys.executable, str(EV / "phase0.py")],
                              cwd=str(ROOT))
        rec["phase0_exit"] = rc0
        print(f"[PHASE0] exit={rc0}", flush=True)
        if rc0 != 0:
            rec["error"] = "Phase 0 smoke failed; fail-closed, no F01 runs"
            return 1

        runs = []
        for run in (1, 2):
            rc = subprocess.call(
                [sys.executable, str(EV / "f01_release_cases.py"),
                 "--run", str(run)], cwd=str(ROOT))
            src = EV / f"f01-release-run{run}.json"
            res = json.loads(src.read_text(encoding="utf-8")) if src.exists() else None
            runs.append({
                "run": run, "exit": rc,
                "verdict": res.get("verdict") if res else "MISSING",
                "token": res.get("token") if res else None,
                "assertions": res.get("assertion_count") if res else 0,
            })
            print("[F01] run%d exit=%d verdict=%s assertions=%s" % (
                run, rc, runs[-1]["verdict"], runs[-1]["assertions"]), flush=True)
        rec["runs"] = runs
        rec["all_pass"] = all(x["exit"] == 0 and x["verdict"] == "PASS"
                              for x in runs)
        rec["conclusion"] = (
            "F01 2x independent PASS on gitlink-aligned worktree"
            if rec["all_pass"]
            else "F01 did not reach 2x PASS; fail-closed, no coverage claim")
        print(f"F01_RELEASE_ALL_PASS: {rec['all_pass']}", flush=True)
        return 0 if rec["all_pass"] else 1
    finally:
        try:
            d.ax("close-app", APP, "--force")
        except Exception:
            pass
        rec["runtime_sha256_after"] = sha(RUNTIME)
        rec["runtime_unchanged"] = (rec["runtime_sha256_after"]
                                    == rec["runtime_sha256_before"])
        (EV / "f01-release-run.json").write_text(
            json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
