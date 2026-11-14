#!/usr/bin/env python3
"""Compliance audit + result summary for the 2026-11-14 rerun."""
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
    out.append("=== 2026-11-14 rerun compliance audit ===")
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
    out.append("  All assertions come from agent-desktop AX JSON envelopes;")
    out.append("  disk hash / logs / HTTP / git are environment evidence only.")
    (EV / "compliance-audit.txt").write_text("\n".join(out) + "\n",
                                             encoding="utf-8")

    # ---- verdict + window summary ----
    res = {}
    for p in sorted(EV.glob("phase1-F*-run*.json")):
        m = re.fullmatch(r"phase1-(F\d\d)-run(\d)\.json", p.name)
        if not m:
            continue
        j = json.loads(p.read_text(encoding="utf-8"))
        res[(m.group(1), int(m.group(2)))] = (j.get("verdict"),
                                              j.get("window_id"),
                                              j.get("token"))

    ids = [f"F{i:02d}" for i in range(1, 18)]
    lines = ["=== 2026-11-14 rerun result summary ===", ""]
    for fid in ids:
        r1 = res.get((fid, 1))
        r2 = res.get((fid, 2))
        v1 = r1[0] if r1 else "-"
        v2 = r2[0] if r2 else "-"
        w1 = r1[1] if r1 else ""
        w2 = r2[1] if r2 else ""
        lines.append(f"{fid}  run1={v1:<8} run2={v2:<8} "
                     f"window_id(run1/run2)={w1}/{w2}")
    lines.append("")
    lines.append("--- restart identities (from evidence) ---")
    for p in sorted(EV.glob("phase1-F*.json")):
        j = json.loads(p.read_text(encoding="utf-8"))
        for e in j.get("evidence", []):
            if "restart identity" in e.get("label", ""):
                lines.append(f"  {p.name}: {e.get('detail')}")
    (EV / "results-summary.txt").write_text("\n".join(lines) + "\n",
                                            encoding="utf-8")
    print("\n".join(out))
    print()
    print("\n".join(lines))


if __name__ == "__main__":
    main()
