#!/usr/bin/env python3
"""Windows agent-desktop visual E2E driver for Aster Studio (2026-11-14).

Only drives the real Studio window through the `agent-desktop` CLI (v1.2.0).
This file is an orchestration harness: every observation/action is an
agent-desktop command, and every assertion is made on its JSON envelope.
Disk reads are evidence only, never substitutes for UI assertions.

Usage:
  python3 drive.py --case F02 --run 1
  python3 drive.py --case ALL --run 1
Output: prints per-assertion lines and a final `<CASE>_L3: PASS|FAIL|...`.
Also appends a JSONL record of every agent-desktop command to commands.jsonl.
"""
import argparse
import json
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path

EXE = r"C:\Users\admin\.workbuddy\binaries\node\versions\22.22.2-6\node_modules\agent-desktop\bin\agent-desktop-win32-x64.exe"
APP = "Studio.exe"
EV = Path(__file__).resolve().parent
CMD_LOG = EV / "commands.jsonl"

COMPOSER = "描述任务"
SWITCH = "运行任务时保持系统唤醒"
SIDEBAR_EXPANDED = "收起侧边栏"
SIDEBAR_COLLAPSED = "展开侧边栏"


class Driver:
    def __init__(self):
        self.case = ""
        self.run = 0
        self.window_id = None
        self.evidence = []

    def ax(self, *args, timeout=90):
        p = subprocess.run([EXE, *args], capture_output=True, text=True,
                           timeout=timeout, encoding="utf-8")
        try:
            d = json.loads(p.stdout)
        except Exception:
            d = {"ok": False, "raw": (p.stdout or "")[:400],
                 "stderr": (p.stderr or "")[:200]}
        data = d.get("data")
        snap_id = data.get("snapshot_id") if isinstance(data, dict) else None
        with CMD_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps({"case": self.case, "run": self.run,
                                "cmd": "agent-desktop " + " ".join(args),
                                "ok": d.get("ok"),
                                "error_code": (d.get("error") or {}).get("code"),
                                "snapshot_id": snap_id},
                               ensure_ascii=False) + "\n")
        return d

    # ---- window health: restore if minimized, never focus-window by reflex ----
    def window(self):
        d = self.ax("list-windows", "--app", APP)
        ws = d.get("data") or []
        if not ws:
            return None
        w = ws[0]
        if w.get("minimized"):
            self.ax("restore", "--app", APP)
            time.sleep(0.5)
        self.window_id = w["id"]
        return self.window_id

    def find(self, name, role=None, exact=False):
        w = self.window()
        if not w:
            return []
        args = ["find", "--app", APP, "--window-id", w, "--name", name]
        if exact:
            args.append("--exact")
        d = self.ax(*args)
        return [m for m in (d.get("data") or {}).get("matches", [])
                if m.get("ref_id") and (role is None or m.get("role") == role)]

    def one(self, name, role=None, exact=False):
        ms = self.find(name, role, exact)
        return ms[0] if ms else None

    def get(self, ref, prop="value"):
        return self.ax("get", ref, "--property", prop)

    def value(self, name, role=None):
        """AX readback: prefer the live `get`, fall back to `find` match value
        (both are agent-desktop AX observations; get can transiently return
        null when the element is rebuilt)."""
        m = self.one(name, role)
        if not m:
            return None
        g = self.get(m["ref_id"])
        if g.get("ok") and (g.get("data") or {}).get("value") is not None:
            return (g.get("data") or {}).get("value")
        return m.get("value")

    def click(self, name, role=None, exact=False):
        m = self.one(name, role, exact)
        if not m:
            return {"ok": False, "err": "no_ref", "name": name}
        return self.ax("click", m["ref_id"])

    def set_value(self, name, text, role=None):
        m = self.one(name, role)
        if not m:
            return {"ok": False, "err": "no_ref", "name": name}
        return self.ax("set-value", m["ref_id"], text)

    def check(self, label, cond, detail=""):
        line = f"  {'OK  ' if cond else 'FAIL'}  {label}" + (f" - {detail}" if detail else "")
        print(line, flush=True)
        self.evidence.append({"label": label, "ok": bool(cond), "detail": detail})
        if not cond:
            raise AssertionError(label)
        return True

    # ---- common setup: get to the workbench with an empty composer ----
    def to_workbench(self):
        for _ in range(4):
            if self.one("设置", "button"):
                break  # settings button visible means we're on a workbench-ish page
            time.sleep(0.4)
        # If settings overlay is open, go back via 工作 (or 返回应用)
        if self.one("返回应用", "button"):
            self.click("工作", "button")
            time.sleep(0.8)
        m = self.one(COMPOSER, "textfield")
        if m:
            self.ax("clear", m["ref_id"])
            time.sleep(0.5)
            # clear may report post_action_verification; the independent readback decides
            v = self.value(COMPOSER, "textfield")
            if v and str(v).strip() not in ("", "描述任务，输入 / 使用指令或技能，@ 选择工作区文件"):
                # retry once with a fresh ref (clear is idempotent and not_delivered-safe)
                m2 = self.one(COMPOSER, "textfield")
                if m2:
                    self.ax("clear", m2["ref_id"])
                    time.sleep(0.4)
        return True

    def type_composer(self, token):
        """Windows-adapted input. Try the user-specified physical path first
        (focus -> re-find -> type --headed). When the OS refuses foreground
        activation (ACTION_FAILED, not_delivered/safe), fall back to the
        semantic `set-value`, which Windows UIA supports for this
        contenteditable. Either way the ASSERTIONS are independent AX reads:
        `get`/`find` value round-trip and visible text in the live UI."""
        m = self.one(COMPOSER, "textfield")
        if not m:
            raise RuntimeError("composer textfield not found")
        self.ax("--headed", "focus", m["ref_id"])
        time.sleep(0.4)
        m2 = self.one(COMPOSER, "textfield")
        if not m2:
            raise RuntimeError("composer textfield not found after focus")
        r = self.ax("--headed", "type", m2["ref_id"], token)
        time.sleep(0.7)
        v = self.value(COMPOSER, "textfield")
        if v and token in str(v):
            return r, v, "type --headed"
        # foreground refused: semantic value path (Windows UIA, verified by AX readback)
        m3 = self.one(COMPOSER, "textfield")
        r2 = self.ax("set-value", m3["ref_id"], token) if m3 else {"ok": False}
        time.sleep(0.7)
        v2 = self.value(COMPOSER, "textfield")
        return (r2, v2, "set-value (headed foreground refused)") if v2 and token in str(v2) else (r, v, "no-input-landed")

    def visible_count(self, token):
        """AX visibility read: total_matches from `find --name <token>`.
        Visible composer text is a statictext node with no ref_id, so this
        deliberately does NOT filter on ref_id (unlike self.find)."""
        w = self.window()
        if not w:
            return 0
        d = self.ax("find", "--app", APP, "--window-id", w, "--name", token)
        return int((d.get("data") or {}).get("total_matches") or 0)

    def wait_visible(self, token, attempts=12, gap=0.6):
        """Wait for the renderer to commit typed text into a visible AX node.
        Waiting for readiness, not relaxing the assertion: still requires >=1."""
        for _ in range(attempts):
            n = self.visible_count(token)
            if n > 0:
                return n
            time.sleep(gap)
        return 0

    def clear_composer(self):
        """Best-effort restore between cases; not an assertion."""
        for _ in range(3):
            m = self.one(COMPOSER, "textfield")
            if not m:
                return
            v = self.value(COMPOSER, "textfield")
            if not v or str(v).strip() in ("", "描述任务，输入 / 使用指令或技能，@ 选择工作区文件"):
                return
            self.ax("clear", m["ref_id"])
            time.sleep(0.5)



# ---------------------------------------------------------------- cases ----
def code(r):
    return ((r or {}).get("error") or {}).get("code")


def case_F02(d, token):
    """composer: type a Chinese short sentence, read it back visible; probe
    the More-options / permission / prompt-optimize controls."""
    d.to_workbench()
    m = d.one(COMPOSER, "textfield")
    d.check("F02 composer textfield exists", m is not None)
    r, v, method = d.type_composer(token)
    d.check("F02 Chinese draft read back via AX get", bool(v) and token in str(v),
            f"value={v!r} method={method}")
    visible = d.wait_visible(token)
    d.check("F02 typed text visible in live UI", visible > 0,
            f"matches={visible}")
    more = d.one("更多选项", "menubutton") or d.one("更多选项", "combobox")
    d.check("F02 更多选项 control exists", more is not None,
            f"role={more.get('role') if more else None}")
    perm = d.one("授权模式", "menubutton") or d.one("授权模式", "combobox")
    d.check("F02 授权模式 control exists", perm is not None)
    d.clear_composer()


def case_F01(d, token):
    """draft navigation: type draft -> open Settings -> back to Work -> draft still there."""
    d.to_workbench()
    r, v, method = d.type_composer(token)
    d.check("F01 draft entered", bool(v) and token in str(v), f"value={v!r}")
    clicked = d.click("设置", "button")
    d.check("F01 settings click delivered", clicked.get("ok") is True,
            f"code={code(clicked)}")
    time.sleep(1.2)
    d.check("F01 settings page reached (返回应用 button present)",
            d.one("返回应用", "button") is not None)
    back = d.click("工作", "button")
    d.check("F01 work click delivered", back.get("ok") is True)
    time.sleep(1.0)
    after = d.value(COMPOSER, "textfield")
    d.check("F01 draft survived cross-page round trip", bool(after) and token in str(after),
            f"after={after!r}")
    d.clear_composer()


def case_F10(d, token):
    """settings search: open settings, activate the search combobox, input a
    query, and assert a REAL result (设置搜索结果 listbox + option), then clear
    and assert the settings nav recovers. Windows: `type --headed` on the
    combobox returns delivered_verified and keeps the control alive; `set-value`
    tears it down (post_action_verification STALE_REF), so headed input is the
    primary path here."""
    d.to_workbench()
    clicked = d.click("设置", "button")
    d.check("F10 settings click delivered", clicked.get("ok") is True)
    time.sleep(1.2)
    entry = d.one("搜索设置", "button")
    d.check("F10 search entry button exists", entry is not None)
    opened = d.click("搜索设置", "button")
    d.check("F10 search entry click delivered", opened.get("ok") is True)
    time.sleep(1.0)
    cb = d.one("搜索设置", "combobox")
    d.check("F10 entry became writable combobox", cb is not None)

    # input: headed physical typing (verified on Windows UIA for this combobox)
    r = d.ax("--headed", "type", cb["ref_id"], "网络")
    time.sleep(1.0)
    v = d.value("搜索设置", "combobox")
    d.check("F10 search value round-trips via AX", str(v) == "网络",
            f"readback={v!r} type_ok={r.get('ok')}")
    # real search results, not the always-present 网络搜索 nav button
    lb = d.ax("find", "--app", APP, "--window-id", d.window_id,
              "--name", "设置搜索结果")
    d.check("F10 设置搜索结果 listbox appears",
            int((lb.get("data") or {}).get("total_matches") or 0) > 0,
            f"matches={(lb.get('data') or {}).get('total_matches')}")
    opt = d.ax("find", "--app", APP, "--window-id", d.window_id,
               "--name", "网络搜索 网络搜索")
    d.check("F10 result option for query appears",
            int((opt.get("data") or {}).get("total_matches") or 0) > 0,
            f"matches={(opt.get('data') or {}).get('total_matches')}")
    # clear via the product's own 清除 button, then assert recovery
    cleared = d.click("清除", "button")
    time.sleep(1.0)
    v2 = d.value("搜索设置", "combobox")
    lb2 = d.ax("find", "--app", APP, "--window-id", d.window_id,
               "--name", "设置搜索结果")
    d.check("F10 search cleared (value no longer 网络 and results gone)",
            str(v2) != "网络" and int((lb2.get("data") or {}).get("total_matches") or 0) == 0,
            f"value={v2!r} listbox_matches={(lb2.get('data') or {}).get('total_matches')} clear_ok={cleared.get('ok')}")
    nav = d.ax("find", "--app", APP, "--window-id", d.window_id,
               "--name", "网络搜索", "--exact")
    d.check("F10 settings nav recovered after clear",
            int((nav.get("data") or {}).get("total_matches") or 0) > 0)
    d.click("工作", "button")
    time.sleep(0.6)


def case_F05(d, token):
    """model selection: a stable AX entry exists (选择模型 menubutton) but
    clicking it adds no AX nodes and exposes no selectable option, because the
    instance has no configured model service. Per plan: BLOCKED (product/AX
    gap), not FAIL and not counted as coverage."""
    d.to_workbench()
    m = d.one("选择模型", "menubutton")
    d.check("F05 选择模型 AX entry exists", m is not None)
    before = d.ax("snapshot", "--app", APP, "--window-id", d.window_id,
                  "--compact", "--max-depth", "40", "--timeout-ms", "30000")
    def node_count(d2):
        c = 0
        def walk(n):
            nonlocal c
            if not isinstance(n, dict):
                return
            if n.get("name"):
                c += 1
            for x in n.get("children") or []:
                walk(x)
        walk((d2.get("data") or {}).get("tree", {}))
        return c
    n_before = node_count(before)
    r = d.click("选择模型", "menubutton")
    d.check("F05 model entry click delivered", r.get("ok") is True)
    time.sleep(1.5)
    after = d.ax("snapshot", "--app", APP, "--window-id", d.window_id,
                 "--compact", "--max-depth", "40", "--timeout-ms", "30000")
    n_after = node_count(after)
    # look for any selectable model option (radio/menuitem/listitem/option)
    opts = []
    def collect(n):
        if not isinstance(n, dict):
            return
        if n.get("role") in ("radio", "menuitem", "listitem", "option", "checkbox") and n.get("ref_id"):
            opts.append((n.get("role"), n.get("name")))
        for x in n.get("children") or []:
            collect(x)
    collect((after.get("data") or {}).get("tree", {}))
    d.ax("press", "escape")
    # Not a pass/fail assertion: record the observation, then raise BLOCKED.
    d.evidence.append({"label": "F05 model options exposed by AX",
                       "ok": False, "detail": f"nodes_before={n_before} nodes_after={n_after} selectable={opts[:8]}"})
    print(f"  INFO  F05 nodes_before={n_before} nodes_after={n_after} selectable_options={opts[:8]}", flush=True)
    raise Blocked("no selectable model option exposed in AX after opening 选择模型")


def case_F17(d, token):
    """appearance sampling: resize-window narrow, snapshot with bounds,
    record whether severe overflow appears. Sampling only."""
    d.to_workbench()
    before = d.ax("list-windows", "--app", APP)
    w = (before.get("data") or [{}])[0]
    orig = (w.get("bounds") or {})
    r = d.ax("resize-window", "--app", APP, "--width", "900", "--height", "700")
    d.check("F17 resize-window delivered", r.get("ok") is True,
            f"code={code(r)}")
    time.sleep(1.2)
    snap = d.ax("snapshot", "--app", APP, "--window-id", d.window_id,
                "--compact", "--max-depth", "40", "--timeout-ms", "30000")
    d.check("F17 snapshot complete after resize", (snap.get("data") or {}).get("complete") is True)
    # `--compact` collapses the deep Web content tree, so bounds must be
    # sampled from live `find` matches (each carries its own bounds object).
    names = ["描述任务", "设置", "新建任务", "发送", "选择模型", "更多选项",
             "搜索任务", "工作", "连接器", "技能", "自动化", "项目", "最近"]
    bounds = []
    for nm in names:
        fd = d.ax("find", "--app", APP, "--window-id", d.window_id, "--name", nm)
        for m in (fd.get("data") or {}).get("matches", []):
            if m.get("bounds"):
                bounds.append((m.get("name") or nm, m["bounds"]))
    d.check("F17 sampled bounded content controls after resize", len(bounds) >= 3,
            f"bounded_nodes={len(bounds)}")
    win = d.ax("list-windows", "--app", APP)
    wb = ((win.get("data") or [{}])[0].get("bounds") or {})
    # severe overflow = any sampled control's right/bottom edge far beyond window
    severe = []
    for name, b in bounds:
        right = b.get("x", 0) + b.get("width", 0)
        bottom = b.get("y", 0) + b.get("height", 0)
        if right > wb.get("x", 0) + wb.get("width", 0) + 200 or bottom > wb.get("y", 0) + wb.get("height", 0) + 200:
            severe.append(name)
    d.evidence.append({"label": "F17 severe overflow count", "ok": len(severe) == 0,
                       "detail": f"window_bounds={wb} sampled_bounded_nodes={len(bounds)} severe={severe[:8]}"})
    print(f"  INFO  F17 window_bounds={wb} bounded_nodes={len(bounds)} severe_overflow={severe[:8]}", flush=True)
    # restore original size
    d.ax("resize-window", "--app", APP, "--width", str(int(orig.get("width", 1456))),
         "--height", str(int(orig.get("height", 959))))
    time.sleep(0.6)
    return True


class Blocked(Exception):
    pass


CASES = {
    "F02": case_F02, "F01": case_F01, "F10": case_F10,
    "F05": case_F05, "F17": case_F17,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--case", required=True)
    ap.add_argument("--run", type=int, default=1)
    args = ap.parse_args()
    cases = list(CASES) if args.case == "ALL" else [args.case]
    overall = 0
    for case in cases:
        d = Driver()
        d.case, d.run = case, args.run
        token = f"中文短句测试{case[1:]}{uuid.uuid4().hex[:4].upper()}"
        print(f"=== {case} run {args.run} token={token} ===", flush=True)
        try:
            CASES[case](d, token)
            verdict = "PASS"
        except Blocked as e:
            verdict = "BLOCKED"
            print(f"  BLOCKED  {e}", flush=True)
        except AssertionError as e:
            verdict = "FAIL"
            print(f"  ASSERTION FAILED: {e}", flush=True)
            overall = 1
        except Exception as e:
            verdict = "ERROR"
            print(f"  ERROR: {type(e).__name__}: {e}", flush=True)
            overall = 1
        out = {"case": case, "run": args.run, "verdict": verdict,
               "token": token, "window_id": d.window_id,
               "evidence": d.evidence}
        (EV / f"phase1-{case}-run{args.run}.json").write_text(
            json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"{case}_L3: {verdict}", flush=True)
        if verdict in ("FAIL", "ERROR"):
            overall = 1
    return overall


if __name__ == "__main__":
    sys.exit(main())
