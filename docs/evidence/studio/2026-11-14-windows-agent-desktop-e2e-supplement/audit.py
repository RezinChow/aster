#!/usr/bin/env python3
"""Compliance audit + result summary for the 2026-11-14 supplement run.

The core policy checks are identical to the rerun audit (same commands.jsonl
schema). The result summary is supplement-specific: it reads the actual case
JSONs produced in this directory and states the final verdict for the 12
features that were still outstanding after the rerun.
"""
import collections
import json
import re
from pathlib import Path

EV = Path(__file__).resolve().parent
SUBS = ["list-windows", "list-apps", "snapshot", "find", "get", "is",
        "click", "toggle", "focus", "type", "set-value", "clear", "press",
        "resize-window", "close-app", "restore", "screenshot", "wait",
        "status", "check", "uncheck", "select", "scroll", "expand", "collapse"]


def sub_of(cmd):
    for t in cmd.split()[1:]:
        if t in SUBS:
            return t
    return "other"


def main():
    rows = [json.loads(l) for l in (EV / "commands.jsonl").read_text(
        encoding="utf-8").splitlines() if l.strip()]

    subs = collections.Counter(sub_of(r.get("cmd", "")) for r in rows)
    errs = collections.Counter(r.get("error_code") for r in rows
                               if r.get("error_code"))
    headed = collections.Counter()
    for r in rows:
        c = r.get("cmd", "")
        if "--headed" in c:
            headed[sub_of(c)] += 1
    mouse = sum(1 for r in rows if "mouse-click" in r.get("cmd", ""))
    focusw = sum(1 for r in rows if "focus-window" in r.get("cmd", ""))
    playwright = sum(1 for r in rows if re.search(
        r"playwright|stub-runtime|nativeHarness", r.get("cmd", ""), re.I))

    out = []
    out.append("=== 2026-11-14 supplement compliance audit ===")
    out.append(f"total agent-desktop commands logged: {len(rows)}")
    out.append("")
    out.append("--- command counts ---")
    for k, v in subs.most_common():
        out.append(f"  {k:<16} {v}")
    out.append("")
    out.append("--- error codes ---")
    for k, v in errs.most_common():
        out.append(f"  {k:<20} {v}")
    if not errs:
        out.append("  (none)")
    out.append("")
    out.append("--- policy checks ---")
    out.append(f"  mouse-click / coordinate actions : {mouse}   (expected 0)")
    out.append(f"  focus-window                      : {focusw}   (expected 0)")
    out.append(f"  Playwright / runtime stub refs    : {playwright}   (expected 0)")
    out.append(f"  --headed total                    : {sum(headed.values())}")
    for k, v in headed.most_common():
        out.append(f"      {k:<14} {v}")
    out.append("")
    out.append("  All coverage assertions come from agent-desktop AX JSON envelopes;")
    out.append("  disk hash / renderer logs / HTTP / git are environment evidence only.")
    out.append("  D-class probes are read-only find/is observations: no PASS verdict.")
    (EV / "compliance-audit.txt").write_text("\n".join(out) + "\n",
                                             encoding="utf-8")

    lines = ["=== 2026-11-14 supplement result summary ===", "",
             "--- newly executed cases (verdicts read from case JSON) ---"]
    groups = [
        ("supp-F16-run*.json", "F16 UI-subset"),
        ("f01-control-A-run*.json", "F01C control (gitlink renderer + cold start)"),
    ]
    for pattern, label in groups:
        found = sorted(EV.glob(pattern))
        if not found:
            lines.append(f"  {label:<48} (no result file)")
        for p in found:
            j = json.loads(p.read_text(encoding="utf-8"))
            lines.append(
                f"  {label:<48} {p.name:<28} "
                f"verdict={j.get('verdict', '-'):<8} "
                f"window={j.get('window_id', '-'):<16} token={j.get('token', '-')}")

    lines += ["", "--- final verdict for the 12 outstanding features ---"]
    final = [
        ("F01", "FAIL (unchanged)", "2xFAIL on user worktree (rerun archive kept). "
         "Control: 2xPASS only on gitlink renderer. NOT counted as coverage."),
        ("F03", "SKIP", "no free-form model service; model_server.py is an exact "
         "CAPABILITY-PROBE contract oracle (HTTP 422 on normal prompt)"),
        ("F04", "SKIP", "needs >100-message session / synthetic MCP instance"),
        ("F05", "BLOCKED", "no selectable model in AX; fixture unusable for a real turn"),
        ("F06", "NOT TESTED", "structurally unreachable; approval controls 0 AX hits"),
        ("F07", "SKIP", "needs synthetic MCP instance / real LLM turn"),
        ("F09", "NOT TESTED", "structurally unreachable; the only role=tab is the "
         "Chromium title-bar tab, not a workspace tab"),
        ("F12", "NOT TESTED", "structurally unreachable; document-output controls 0 AX hits"),
        ("F13", "NOT TESTED", "dependency entry 0 AX hits; ledger PARTIAL_PASS is "
         "not a Windows agent-desktop result"),
        ("F14", "PARTIAL", "rerun PARTIAL stands; update-channel / exit-guard 0 AX hits"),
        ("F15", "NOT TESTED", "structurally unreachable; capture controls 0 AX hits"),
        ("F16", "PASS x2 (UI subset)", "NEW this supplement run; L3 crash-recovery "
         "sampling explicitly not claimed"),
    ]
    for fid, verdict, note in final:
        lines.append(f"  {fid}  {verdict:<22} {note}")
    lines += ["",
              "Already-PASS features from the rerun (F02/F08/F10/F11/F17) were not",
              "re-executed here; this supplement adds F16 as the only new case.",
              "No MATRIX.md / ledger number was changed by this run."]
    (EV / "results-summary.txt").write_text("\n".join(lines) + "\n",
                                            encoding="utf-8")
    print("\n".join(out))
    print()
    print("\n".join(lines))


if __name__ == "__main__":
    main()
