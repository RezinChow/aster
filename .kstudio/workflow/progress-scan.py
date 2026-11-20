#!/usr/bin/env python3
"""progress helper: dump GOALS + progress_refs for completion rubrics.

Does NOT invent a percentage — the agent scores against real source.
Project-agnostic. Read-only.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

def _resolve_eng() -> tuple[Path, Path]:
    here = Path(__file__).resolve()
    root = here.parents[2]
    aster = root / ".aster"
    legacy = root / ".kstudio"

    def present(p: Path) -> bool:
        return (
            (p / "MANIFEST.json").is_file()
            or (p / "workflow").is_dir()
            or (p / "skills").is_dir()
        )

    if present(aster):
        return root, aster
    if legacy.exists():
        return root, legacy
    return root, here.parents[1]


ROOT, KS = _resolve_eng()
GOALS = KS / "workflow" / "GOALS.md"
MANIFEST = KS / "MANIFEST.json"


def section(md: str, title: str) -> str:
    # ## Title ... until next ##
    pat = re.compile(
        rf"^##\s+{re.escape(title)}\s*\n(.*?)(?=^##\s+|\Z)",
        re.M | re.S,
    )
    m = pat.search(md)
    return (m.group(1).strip() if m else "")


def main() -> int:
    print("=== progress scan (inputs only; % is agent-judged) ===")
    print(f"root: {ROOT}")
    if not GOALS.is_file():
        print("GOALS.md: MISSING — run /goal first")
        print("=== end ===")
        return 0
    text = GOALS.read_text(encoding="utf-8")
    print("-- GOALS.md --")
    # Prefer "Overall goal"; accept legacy "North star" / "Ambition (stretch)".
    titles = [
        "Overall goal",
        "Stretch (within product)",
        "Near-term hard goals",
        "Non-goals",
        "Real constraints (not self-doubt)",
        "Open turtle-soup",
    ]
    legacy = {
        "Overall goal": "North star",
        "Stretch (within product)": "Ambition (stretch)",
    }
    for title in titles:
        body = section(text, title)
        if not body and title in legacy:
            body = section(text, legacy[title])
            if body:
                title = f"{title} (legacy: {legacy[title]})"
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
    print("tip: score axes vs real source; TTY reply with bars:")
    print("     python3 .kstudio/workflow/tty-fmt.py bar 61 --label 总体")
    print("     overall%≠Pass; ≠ /status sitrep; no 套话.")
    print("=== end ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
