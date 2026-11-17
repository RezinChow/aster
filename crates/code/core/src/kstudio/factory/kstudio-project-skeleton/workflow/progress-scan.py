#!/usr/bin/env python3
"""progress helper: dump GOALS + progress_refs (inputs only; % is agent-judged).

Lives under <eng-root>/workflow/ (.aster canonical or legacy .kstudio).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ENG = Path(__file__).resolve().parents[1]
ROOT = ENG.parent
GOALS = ENG / "workflow" / "GOALS.md"
MANIFEST = ENG / "MANIFEST.json"


def section(md: str, title: str) -> str:
    pat = re.compile(
        rf"^##\s+{re.escape(title)}\s*\n(.*?)(?=^##\s+|\Z)",
        re.M | re.S,
    )
    m = pat.search(md)
    return m.group(1).strip() if m else ""


def main() -> int:
    print("=== progress scan (inputs only; % is agent-judged) ===")
    print(f"root: {ROOT}")
    print(f"eng: {ENG}")
    if not GOALS.is_file():
        print("GOALS.md: MISSING — run /goal first")
        print("=== end ===")
        return 0
    text = GOALS.read_text(encoding="utf-8")
    print("-- GOALS.md --")
    for title in (
        "Overall goal",
        "Stretch (within product)",
        "Near-term hard goals",
        "Non-goals",
        "Real constraints (not self-doubt)",
        "Open turtle-soup",
    ):
        body = section(text, title)
        print(f"## {title}")
        print(body if body else "(empty)")
        print()
    refs: list[str] = []
    if MANIFEST.is_file():
        try:
            data = json.loads(MANIFEST.read_text(encoding="utf-8"))
            ae = data.get("ai_engineering") or {}
            refs = list(ae.get("progress_refs") or [])
        except Exception as e:  # noqa: BLE001
            print(f"MANIFEST: parse error: {e}")
    print("-- progress_refs (≠Pass) --")
    if refs:
        for r in refs:
            print(f"  · {r}")
    else:
        print("  (none)")
    print("tip: score axes vs real source; overall%≠Pass; ≠ /status sitrep.")
    print("=== end ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
