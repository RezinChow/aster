#!/usr/bin/env python3
"""Restart-class E2E cases (F11 / F08 / F14) for the Windows agent-desktop run.

All GUI observations and actions go through the agent-desktop CLI (via
drive.Driver). The only non-AX operations are process lifecycle: `close-app
--force` (itself an agent-desktop command) and relaunching the SAME
studio-dev.mjs path used at startup. Those are environment preparation and
are never used as assertions.

IMPORTANT (Windows): studio-dev.mjs runs two full `cargo build --locked`
targets on every launch (~5-6 min), and a Popen'd launcher is reaped when its
parent Python exits. Therefore ALL restart cases run inside ONE long-lived
Python process, and window waits are sized for a cold incremental build.
"""
import argparse
import json
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path

import drive

EXE, APP, EV = drive.EXE, drive.APP, drive.EV
NODE = r"C:/Users/admin/.workbuddy/binaries/node/versions/22.22.2-6/node.exe"
STUDIO_DIR = Path(r"D:/code/aster/apps/studio")
LAUNCH_LOG = EV / "launch-restart.log"

SETTINGS = "\u8bbe\u7f6e"
WORK = "\u5de5\u4f5c"
KEEP_AWAKE = "\u8fd0\u884c\u4efb\u52a1\u65f6\u4fdd\u6301\u7cfb\u7edf\u5524\u9192"
COLLAPSE = "\u6536\u8d77\u4fa7\u8fb9\u680f"
EXPAND = "\u5c55\u5f00\u4fa7\u8fb9\u680f"
COMPOSER = "\u63cf\u8ff0\u4efb\u52a1"

RESTART_OBSERVATIONS = []


class Partial(Exception):
    pass


def code(r):
    return ((r or {}).get("error") or {}).get("code")


def _launch(tag):
    env = dict(os.environ)
    env.update({
        "ASTER_TENANT_SLUG": "aster",
        "STUDIO_RENDERER_DEV": "1",
        "ASTER_STUDIO_INSTANCE": "win-e2e-01",
        "STUDIO_RENDERER_PORT": "4318",
    })
    lf = LAUNCH_LOG.open("a", encoding="utf-8")
    lf.write("\n=== %s relaunch %s ===\n" % (tag, time.strftime("%Y-%m-%d %H:%M:%S")))
    lf.flush()
    return subprocess.Popen(
        [NODE, "scripts/studio-dev.mjs"], cwd=str(STUDIO_DIR), env=env,
        stdout=lf, stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS,
    )


def wait_window(d, attempts=600):
    ws = []
    for i in range(attempts):
        ws = d.ax("list-windows", "--app", APP).get("data") or []
        vis = [w for w in ws if w.get("visible") and not w.get("minimized")]
        if vis:
            print("  INFO  window appeared after %d polls" % i, flush=True)
            return vis[0], ws
        time.sleep(1.0)
    return None, ws


def wait_content(d, attempts=90):
    for _ in range(attempts):
        if d.one(SETTINGS, "button") or d.one(COMPOSER, "textfield"):
            return True
        time.sleep(1.0)
    return False


def ensure_window(d, tag):
    ws = d.ax("list-windows", "--app", APP).get("data") or []
    if ws:
        return True
    print("  INFO  no live window; booting initial instance", flush=True)
    _launch(tag)
    new, ws = wait_window(d)
    if not new:
        return False
    d.window_id = new["id"]
    return wait_content(d)


def restart(d, tag, expect_pre=True):
    pre = d.ax("list-windows", "--app", APP).get("data") or []
    if expect_pre:
        d.check("%s pre-restart main window present" % tag, len(pre) == 1,
                "windows=%d ids=%s" % (len(pre), [w["id"] for w in pre]))
    r = d.ax("close-app", APP, "--force")
    d.check("%s close-app --force delivered" % tag, r.get("ok") is True,
            "code=%s" % code(r))
    gone = False
    for _ in range(60):
        ws = d.ax("list-windows", "--app", APP).get("data") or []
        if not ws:
            gone = True
            break
        time.sleep(1.0)
    d.check("%s old main window gone before relaunch" % tag, gone)
    _launch(tag)
    new, ws = wait_window(d)
    d.check("%s relaunched main window visible" % tag, new is not None,
            "windows=%d" % len(ws))
    d.window_id = new["id"]
    identity = "before=%s after=(%s,%s) windows_after=%d" % (
        [(w["id"], w["pid"]) for w in pre], new["id"], new["pid"], len(ws))
    RESTART_OBSERVATIONS.append({"tag": tag, "detail": identity})
    d.evidence.append({"label": "%s restart identity" % tag, "ok": True,
                       "detail": identity})
    d.check("%s content AX tree ready after relaunch" % tag, wait_content(d))
    return new, ws


def case_F11(d, token):
    """Preferences survive a cross-process restart (AX assertions only)."""
    d.to_workbench()
    c = d.click(SETTINGS, "button")
    d.check("F11 settings opened", c.get("ok") is True)
    time.sleep(1.2)
    sw = d.one(KEEP_AWAKE, "switch")
    d.check("F11 keep-awake switch exists in AX", sw is not None)
    before = "checked" in (sw.get("states") or [])
    target = not before
    t = d.ax("toggle", sw["ref_id"])
    d.check("F11 toggle delivered", t.get("ok") is True, "code=%s" % code(t))
    time.sleep(0.9)
    sw2 = d.one(KEEP_AWAKE, "switch")
    d.check("F11 switch observable after toggle", sw2 is not None)
    now = "checked" in (sw2.get("states") or [])
    d.check("F11 switch state flipped before restart", now == target,
            "before=%s after=%s target=%s states=%s" % (before, now, target, sw2.get("states")))
    restart(d, "F11")
    d.check("F11 settings entry present after restart", d.one(SETTINGS, "button") is not None)
    c2 = d.click(SETTINGS, "button")
    d.check("F11 settings reopened after restart", c2.get("ok") is True)
    time.sleep(1.2)
    sw3 = d.one(KEEP_AWAKE, "switch")
    d.check("F11 keep-awake switch exists after restart", sw3 is not None)
    after = "checked" in (sw3.get("states") or [])
    d.check("F11 preference state restored after cross-process restart", after == target,
            "target=%s after=%s states=%s" % (target, after, sw3.get("states")))
    d.click(WORK, "button")
    time.sleep(0.6)


def case_F08(d, token):
    """Sidebar collapse state survives a cross-process restart."""
    d.to_workbench()
    cur = d.one(COLLAPSE, "switch") or d.one(EXPAND, "switch")
    d.check("F08 sidebar switch exists in AX", cur is not None)
    before_name = cur["name"]
    alt = EXPAND if before_name == COLLAPSE else COLLAPSE
    t = d.ax("toggle", cur["ref_id"])
    d.check("F08 sidebar toggle delivered", t.get("ok") is True, "code=%s" % code(t))
    time.sleep(1.0)
    sw2 = d.one(alt, "switch")
    d.check("F08 sidebar state flipped before restart (AX name changed)", sw2 is not None,
            "before=%s expected=%s" % (before_name, alt))
    restart(d, "F08")
    a = d.one(COLLAPSE, "switch")
    b = d.one(EXPAND, "switch")
    observed = a or b
    d.check("F08 sidebar switch observable after restart", observed is not None)
    d.check("F08 sidebar state persisted across restart", observed["name"] == alt,
            "target=%s observed=%s states=%s" % (alt, observed["name"], observed.get("states")))


def case_F14(d, token):
    """PARTIAL sampling only. Every relaunch in this run was a second start of
    the same instance; sample the AX window count and aggregate the recorded
    restart identities. Never claim flock / update-channel behaviour."""
    d.window()
    pre = d.ax("list-windows", "--app", APP).get("data") or []
    d.check("F14 exactly one main window at sampling time", len(pre) == 1,
            "windows=%d" % len(pre))
    obs = list(RESTART_OBSERVATIONS)
    if not obs:
        for p in sorted(EV.glob("phase1-*.json")):
            try:
                j = json.loads(p.read_text(encoding="utf-8"))
            except Exception:
                continue
            for e in j.get("evidence", []):
                if "restart identity" in e.get("label", ""):
                    obs.append({"tag": j.get("case"), "detail": e.get("detail")})
    d.evidence.append({
        "label": "F14 second-launch window count (AX list-windows)",
        "ok": len(pre) == 1,
        "detail": "current_windows=%d ids=%s pids=%s restart_observations=%s" % (
            len(pre), [w["id"] for w in pre], [w["pid"] for w in pre],
            json.dumps(obs, ensure_ascii=False)[:1600])})
    print("  INFO  F14 current_windows=%d restart_observations=%d" % (len(pre), len(obs)), flush=True)
    raise Partial("single-window relaunches observed; PARTIAL only (no flock/update-channel claim)")


CASES = {"F11": case_F11, "F08": case_F08, "F14": case_F14}
ALL_ORDER = [("F11", 1), ("F11", 2), ("F08", 1), ("F08", 2), ("F14", 1)]


def run_one(case, run):
    d = drive.Driver()
    d.case, d.run = case, run
    token = "WIN%s%s" % (case[1:], uuid.uuid4().hex[:4].upper())
    print("=== %s run %d token=%s ===" % (case, run, token), flush=True)
    verdict = "PASS"
    try:
        CASES[case](d, token)
    except Partial as e:
        verdict = "PARTIAL"
        print("  PARTIAL  %s" % e, flush=True)
    except AssertionError as e:
        verdict = "FAIL"
        print("  ASSERTION FAILED: %s" % e, flush=True)
    except Exception as e:
        verdict = "ERROR"
        print("  ERROR: %s: %s" % (type(e).__name__, e), flush=True)
    out = {"case": case, "run": run, "verdict": verdict,
           "token": token, "window_id": d.window_id, "evidence": d.evidence}
    (EV / ("phase1-%s-run%d.json" % (case, run))).write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("%s_L3: %s" % (case, verdict), flush=True)
    return verdict


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--case", required=True)
    ap.add_argument("--run", type=int, default=1)
    a = ap.parse_args()
    if a.case == "ALL":
        boot = drive.Driver()
        boot.case, boot.run = "BOOT", 0
        if not ensure_window(boot, "ALL-boot"):
            print("BOOT FAILED: no main window", flush=True)
            return 1
        results = [run_one(c, r) for c, r in ALL_ORDER]
        print("ALL RESULTS: %s" % json.dumps(results), flush=True)
        return 0 if all(v in ("PASS", "PARTIAL") for v in results) else 1
    v = run_one(a.case, a.run)
    return 0 if v in ("PASS", "PARTIAL") else 1


if __name__ == "__main__":
    sys.exit(main())
