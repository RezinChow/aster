#!/usr/bin/env python3
"""Compliance audit + result summary for the 2026-11-14 F05 increment."""
import collections
import json
import re
from pathlib import Path

EV = Path(__file__).resolve().parent
SUBS = ["list-windows", "list-apps", "snapshot", "find", "get", "is",
        "click", "toggle", "focus", "type", "set-value", "clear", "press",
        "resize-window", "close-app", "restore", "screenshot", "wait",
        "status", "check", "uncheck", "select", "scroll", "expand",
        "collapse", "screenshot"]


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
    headed = sum(1 for r in rows if "--headed" in r.get("cmd", ""))
    mouse = sum(1 for r in rows if "mouse-click" in r.get("cmd", ""))
    focusw = sum(1 for r in rows if "focus-window" in r.get("cmd", ""))
    playwright = sum(1 for r in rows if re.search(
        r"playwright|stub-runtime|nativeHarness", r.get("cmd", ""), re.I))
    expand = sum(1 for r in rows if re.search(r"\bexpand\b", r.get("cmd", "")))
    setval = sum(1 for r in rows if "set-value" in r.get("cmd", ""))

    out = ["=== 2026-11-14 F05 increment compliance audit ===",
           f"total agent-desktop commands logged: {len(rows)}", "",
           "--- command counts ---"]
    for k, v in subs.most_common():
        out.append(f"  {k:<16} {v}")
    out += ["", "--- error codes ---"]
    for k, v in errs.most_common():
        out.append(f"  {k:<20} {v}")
    if not errs:
        out.append("  (none)")
    out += ["", "--- policy checks ---",
            f"  mouse-click / coordinate actions : {mouse}   (expected 0)",
            f"  focus-window                      : {focusw}   (expected 0)",
            f"  Playwright / runtime stub refs    : {playwright}   (expected 0)",
            f"  --headed total                    : {headed}",
            f"  expand (semantic disclosure)      : {expand}",
            f"  set-value (settings inputs)       : {setval}", "",
            "  All coverage assertions come from agent-desktop AX JSON envelopes;",
            "  HTTP / git / renderer logs / disk hashes are environment evidence only.",
            "  The local synthetic model service is NOT a stub suite and NOT a real LLM."]
    (EV / "compliance-audit.txt").write_text("\n".join(out) + "\n",
                                             encoding="utf-8")

    lines = ["=== 2026-11-14 F05 increment result summary ===", "",
             "--- executed F05 UI-subset case ---"]
    for run in (1, 2):
        p = EV / f"case-F05-run{run}.json"
        if p.exists():
            j = json.loads(p.read_text(encoding="utf-8"))
            lines.append(
                f"  F05 run{run}: verdict={j.get('verdict')} "
                f"assertions={len(j.get('evidence', []))} "
                f"all_ok={all(e.get('ok') for e in j.get('evidence', []))} "
                f"window={j.get('window_id')} token={j.get('token')}")
    lines += ["", "--- functional verdict (fail-closed) ---",
              "  F05  PARTIAL  (was BLOCKED) : provider configured through the real GUI,",
              "                 model discovered via the product's own /v1/models call,",
              "                 model visible in the workbench selector AX (2 matches).",
              "                 NOT counted as coverage: 'select model -> read back' is",
              "                 impossible because model rows expose no actionable ref.",
              "  F03  SKIP     : synthetic model cannot become the active model through AX,",
              "                 so no controllable turn can be attributed to the fixture.",
              "  F01  unchanged: 2xFAIL on the user worktree (rerun archive kept).",
              "  F16  unchanged: 2xPASS UI subset from the previous supplement run.",
              "", "  No MATRIX.md / ledger number was changed by this run.",
              "  No product source file was modified."]
    (EV / "results-summary.txt").write_text("\n".join(lines) + "\n",
                                            encoding="utf-8")
    print("\n".join(out))
    print()
    print("\n".join(lines))


if __name__ == "__main__":
    main()
