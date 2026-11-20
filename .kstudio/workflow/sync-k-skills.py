#!/usr/bin/env python3
"""Sync .kstudio/skills/<conductor> → Agent-visible .cursor (P15) + factory rules.

Idempotent. Does not touch business source. Project-agnostic.
Also copies share/kstudio-agent-rules/*.mdc when present next to this repo's
sibling kense/kstudio, or from .kstudio/agent-rules/ if vendored.
"""
from __future__ import annotations

import argparse
import re
import shutil
import sys
from datetime import datetime, timezone
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


ROOT, ENG = _resolve_eng()
SRC = ENG / "skills"
CURSOR_SKILLS = ROOT / ".cursor" / "skills"
CURSOR_CMDS = ROOT / ".cursor" / "commands"
CURSOR_RULES = ROOT / ".cursor" / "rules"
VENDOR_RULES = ENG / "agent-rules"
CANONICAL_SKILLS = {
    "init",
    "goal",
    "status",
    "progress",
    "plan",
    "task",
    "go",
    "loop",
    "yolo",
    "review",
    "clean",
    "wiki",
}
NAME_RE = re.compile(r"^(?:init|goal|status|progress|plan|task|go|loop|yolo|review|clean|wiki)$")


def skill_dirs() -> list[Path]:
    if not SRC.is_dir():
        return []
    out = []
    for d in sorted(SRC.iterdir()):
        if d.is_dir() and NAME_RE.match(d.name) and (d / "SKILL.md").is_file():
            out.append(d)
    return out


def sync_skill(src: Path) -> None:
    dst = CURSOR_SKILLS / src.name
    dst.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src / "SKILL.md", dst / "SKILL.md")


def write_command(name: str) -> None:
    CURSOR_CMDS.mkdir(parents=True, exist_ok=True)
    body = f"""---
name: {name}
description: Load and run {ENG.name}/skills/{name} (P15 conductor skill). Immediate.
---

# /{name}

1. **Immediately** Read and follow **`{ENG.name}/skills/{name}/SKILL.md`** (authoritative).
2. If missing or stale: `python3 {ENG.name}/workflow/sync-k-skills.py` then retry.
3. Do not write business/product source unless that skill explicitly allows orchestration-only eng-root metadata.
4. P17: do not privately create git branches/worktrees.
"""
    if name == "yolo":
        body += (
            "5. **Stop discipline:** Done = `GOALS.md` **overall** (or named YOLO "
            "scope) with evidence. Near-term-only or a single-slice hard block "
            "(notarize/push/secret) is **not** campaign stop — park that slice "
            "and continue other overall-goal work. %≠Pass.\n"
        )
    (CURSOR_CMDS / f"{name}.md").write_text(body, encoding="utf-8")


def rule_sources() -> list[Path]:
    """Prefer vendored .kstudio/agent-rules, else sibling kense share."""
    dirs: list[Path] = []
    if VENDOR_RULES.is_dir():
        dirs.append(VENDOR_RULES)
    # sibling: <parent>/kense/kstudio/share/kstudio-agent-rules OR ../kstudio when in kense
    candidates = [
        ROOT.parent / "kense" / "kstudio" / "share" / "kstudio-agent-rules",
        ROOT / "share" / "kstudio-agent-rules",
    ]
    for c in candidates:
        if c.is_dir() and c not in dirs:
            dirs.append(c)
    return dirs


def sync_rules() -> list[str]:
    copied: list[str] = []
    CURSOR_RULES.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    for d in rule_sources():
        files = list(d.glob("*.mdc"))
        # Prefer skills.mdc over legacy k-skills.mdc when both exist.
        has_skills = any(f.name == "skills.mdc" for f in files)
        for f in sorted(files, key=lambda p: (p.name == "k-skills.mdc", p.name)):
            if f.name == "k-skills.mdc" and has_skills:
                continue
            name = "skills.mdc" if f.name == "k-skills.mdc" else f.name
            if name in seen:
                continue
            dst_rule = CURSOR_RULES / name
            if f.resolve() != dst_rule.resolve():
                shutil.copy2(f, dst_rule)
            VENDOR_RULES.mkdir(parents=True, exist_ok=True)
            vend = VENDOR_RULES / name
            if f.resolve() != vend.resolve():
                shutil.copy2(f, vend)
            legacy = CURSOR_RULES / "k-skills.mdc"
            if name == "skills.mdc" and legacy.exists():
                legacy.unlink()
            seen.add(name)
            copied.append(name)
    return copied


def write_stamp(n_skills: int, rules: list[str]) -> None:
    stamp = ENG / "workflow" / "SYNC-SKILLS.stamp"
    stamp.write_text(
        f"synced_at={datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}\n"
        f"skills={n_skills}\n"
        f"rules={','.join(rules) if rules else '(none)'}\n"
        f"effective=/.cursor/skills + /.cursor/commands + /.cursor/rules\n",
        encoding="utf-8",
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Sync conductor skills + agent rules to .cursor (P15)")
    ap.add_argument("--check", action="store_true", help="verify sync only; exit 1 if drift")
    args = ap.parse_args()
    dirs = skill_dirs()
    if not dirs:
        print(f"error: no canonical {ENG.name}/skills/<name>/SKILL.md", file=sys.stderr)
        return 2

    drifted = []
    for d in dirs:
        dst = CURSOR_SKILLS / d.name / "SKILL.md"
        src_text = (d / "SKILL.md").read_text(encoding="utf-8")
        if args.check:
            if not dst.is_file() or dst.read_text(encoding="utf-8") != src_text:
                drifted.append(d.name)
            cmd = CURSOR_CMDS / f"{d.name}.md"
            if not cmd.is_file():
                drifted.append(f"cmd:{d.name}")
            continue
        sync_skill(d)
        write_command(d.name)

    if args.check:
        # rules presence
        for name in ("skills.mdc", "git-branch-discipline.mdc"):
            if not (CURSOR_RULES / name).is_file():
                drifted.append(f"rule:{name}")
        if drifted:
            print(f"DRIFT: {', '.join(drifted)}")
            print(f"run: python3 {ENG.name}/workflow/sync-k-skills.py")
            return 1
        print(f"OK sync {len(dirs)} skill(s) + rules")
        return 0

    rules = sync_rules()
    write_stamp(len(dirs), rules)
    print(f"synced {len(dirs)} skill(s) → .cursor/skills + .cursor/commands")
    for d in dirs:
        print(f"  /{d.name}  EFFECTIVE")
    if rules:
        print(f"synced rules → .cursor/rules: {', '.join(rules)}")
    print(f"stamp: {ENG.name}/workflow/SYNC-SKILLS.stamp")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
