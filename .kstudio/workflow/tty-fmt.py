#!/usr/bin/env python3
"""TTY helpers for kstudio paste / progress (no color required).

Plain work-order text for humans in terminal/agent chat.
Status words stay plain: ok / no / warn / 待确认. %≠Pass.
Short reports: omit empty fields; MUST seat+machine; aggregate first line; bold highlights.
"""
from __future__ import annotations

import argparse
import sys


def bar(pct: float | int, width: int = 20) -> str:
    try:
        p = max(0.0, min(100.0, float(pct)))
    except (TypeError, ValueError):
        return "[" + "?" * width + "]   ?%"
    filled = int(round(width * p / 100.0))
    filled = max(0, min(width, filled))
    return f"[{'█' * filled}{'░' * (width - filled)}] {int(round(p)):3d}%"


def task_block(
    seat: str,
    role_path: str,
    machine: str,
    do: str,
    deny: str = "私开分支；无口令推 main",
) -> str:
    lines = [
        f"### 发给 {seat}",
        f"按 {role_path} 执行。",
        f"机器：{machine}",
        f"做：{do}",
    ]
    if deny and deny.strip():
        lines.append(f"不要：{deny}")
    lines.append("做完贴短报（代价：约 $… USD tokens）。")
    return "\n".join(lines)


def report_block(
    seat: str,
    machine: str,
    result: str,
    cost: str,
    did: str = "",
    verified: str = "",
    artifact: str = "",
    limit: str = "",
    need: str = "",
    waste: str = "",
    save: str = "",
    name: str = "",
) -> str:
    """Compact short report: first line aggregates MUST fields; omit empties."""
    if "USD" not in cost and "$" not in cost:
        cost = f"约 ${cost} USD tokens" if cost else "约 $… USD tokens"
    elif not cost.startswith("约") and "$" in cost:
        cost = f"约 {cost}" if not cost.startswith("约") else cost

    head = f"**{seat}** · {machine} · **{result}** · {cost}"
    lines = [f"### 短报" + (f" · {name}" if name else ""), "```text", head]
    for label, val in (
        ("做了", did),
        ("验了", verified),
        ("产物", artifact),
        ("限制", limit),
        ("需求", need),
        ("浪费", waste),
        ("省法", save),
    ):
        v = (val or "").strip()
        if not v or v in ("无", "n/a", "N/A", "-"):
            continue
        lines.append(f"{label}：{v}")
    lines.append("```")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="kstudio TTY format helpers")
    sub = ap.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("bar", help="print a progress bar")
    b.add_argument("pct", type=float)
    b.add_argument("--width", type=int, default=20)
    b.add_argument("--label", default="")

    t = sub.add_parser("task", help="print a plain task card")
    t.add_argument("seat")
    t.add_argument("--role", required=True)
    t.add_argument("--machine", required=True)
    t.add_argument("--do", required=True)
    t.add_argument("--deny", default="私开分支；无口令推 main")

    r = sub.add_parser("report", help="print a compact short-report card")
    r.add_argument("seat")
    r.add_argument("--machine", required=True)
    r.add_argument("--result", required=True)
    r.add_argument("--cost", required=True, help='e.g. "1.2" or "约 $1.2 USD tokens"')
    r.add_argument("--did", default="")
    r.add_argument("--verified", default="")
    r.add_argument("--artifact", default="")
    r.add_argument("--limit", default="")
    r.add_argument("--need", default="")
    r.add_argument("--waste", default="")
    r.add_argument("--save", default="")
    r.add_argument("--name", default="")

    args = ap.parse_args()
    if args.cmd == "bar":
        line = bar(args.pct, args.width)
        if args.label:
            print(f"{args.label:12s} {line}")
        else:
            print(line)
        return 0
    if args.cmd == "task":
        print(
            task_block(
                args.seat,
                args.role,
                args.machine,
                args.do,
                args.deny,
            )
        )
        return 0
    if args.cmd == "report":
        print(
            report_block(
                seat=args.seat,
                machine=args.machine,
                result=args.result,
                cost=args.cost,
                did=args.did,
                verified=args.verified,
                artifact=args.artifact,
                limit=args.limit,
                need=args.need,
                waste=args.waste,
                save=args.save,
                name=args.name,
            )
        )
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
