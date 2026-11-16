#!/usr/bin/env python3
"""Inventory generated junk; delete only an unchanged, reviewed exact-file plan.

Source bugs and dead code require semantic review and Implementer changes.
This helper never deletes evidence, wiki, wave history, or business source.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import uuid
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
KS = ROOT / ".kstudio"
CURSOR = ROOT / ".cursor"
PROTECTED = ("evidence", "wiki", "migration", "workflow/waves", "workflow/objects", "workflow/refs")
SCHEMA = "kstudio.clean-plan.v1"


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def protected(path: Path) -> bool:
    return any(path.is_relative_to(KS / part) for part in PROTECTED)


def owned_file(path: Path) -> bool:
    if not path.is_relative_to(ROOT) or protected(path):
        return False
    # Resolve every parent: even a generated-looking symlink must never escape.
    if path.is_symlink() or not path.resolve().is_relative_to(ROOT) or not path.is_file():
        return False
    if any(parent.is_symlink() for parent in path.parents if parent.is_relative_to(ROOT)):
        return False
    if path.is_relative_to(KS) and path.suffix == ".pyc" and path.parent.name == "__pycache__":
        return True
    if path.parent == CURSOR / "commands" and re.fullmatch(r"k-[a-z0-9-]+\.md", path.name):
        if (KS / "skills" / path.stem / "SKILL.md").exists():
            return False
        name = path.stem
        # A retained header cannot prove ownership after a user adds their own work.
        expected = f"""---
name: {name}
description: Load and run .kstudio/skills/{name} (P15 conductor skill). Immediate.
---

# /{name}

1. **Immediately** Read and follow **`.kstudio/skills/{name}/SKILL.md`** (authoritative).
2. If missing or stale: `python3 .kstudio/workflow/sync-k-skills.py` then retry.
3. Do not write business/product source unless that skill explicitly allows orchestration-only `.kstudio` metadata.
4. P17: do not privately create git branches/worktrees.
"""
        return path.read_text(encoding="utf-8", errors="replace") == expected
    return False


def git_safe(path: Path) -> bool:
    try:
        tracked = subprocess.check_output(["git", "-C", str(ROOT), "ls-files", "-z", "--", rel(path)], stderr=subprocess.DEVNULL)
        status = subprocess.check_output(["git", "-C", str(ROOT), "status", "--porcelain", "--untracked-files=all", "--", rel(path)], stderr=subprocess.DEVNULL).decode()
        return not tracked and all(line.startswith("?? ") for line in status.splitlines())
    except (OSError, subprocess.CalledProcessError):
        return False


def referenced(path: Path, plan_path: Path | None = None) -> bool:
    try:
        names = subprocess.check_output(["git", "-C", str(ROOT), "ls-files", "--cached", "--others", "--exclude-standard", "-z"], stderr=subprocess.DEVNULL)
    except (OSError, subprocess.CalledProcessError):
        return True
    candidates = {ROOT / os.fsdecode(name) for name in names.split(b"\0") if name}
    if KS.is_dir():
        candidates.update(KS.rglob("*"))
    for source in candidates:
        if source.suffix not in (".md", ".json", ".jsonl", ".toml", ".kcl", ".txt", ".rs", ".py", ".ts", ".tsx", ".mjs", ".yml", ".yaml", ".sh", ".ps1", ".html"):
            continue
        if source == path or source.is_symlink() or not source.is_file() or not source.resolve().is_relative_to(ROOT) or source.is_relative_to(KS / "local") or plan_path is not None and source.resolve() == plan_path.resolve():
            continue
        text = source.read_text(encoding="utf-8", errors="replace")
        if rel(path) in text:
            return True
        for target in re.findall(r"\]\(([^\s)]+)\)", text):
            try:
                url = urlsplit(target)
            except ValueError:
                continue
            if not url.scheme and (source.parent / unquote(url.path)).resolve() == path.resolve():
                return True
    return False


def collect() -> dict[str, list[Path]]:
    delete = []
    flag = []
    if KS.is_dir():
        for folder, dirs, files in os.walk(KS, followlinks=False):
            current = Path(folder)
            dirs[:] = [d for d in dirs if not protected(current / d) and not (current / d).is_symlink() and current / d != KS / "local"]
            for name in files:
                path = current / name
                if name.endswith((".pyc", ".orig", ".swp", "~")):
                    (delete if owned_file(path) and git_safe(path) and not referenced(path) else flag).append(path)
    for base in (KS / "skills", CURSOR / "skills"):
        if base.is_dir():
            for path in sorted(base.iterdir()):
                if path.name == "k-dispatch" or base == CURSOR / "skills" and path.name.startswith("k-") and not (KS / "skills" / path.name / "SKILL.md").is_file():
                    flag.append(path)
    commands = CURSOR / "commands"
    if commands.is_dir():
        for path in commands.glob("k-*.md"):
            if not (KS / "skills" / path.stem / "SKILL.md").is_file():
                (delete if owned_file(path) and git_safe(path) and not referenced(path) else flag).append(path)
    for pattern in ("*.orig", "*.swp", "*~"):
        flag.extend(ROOT.glob(pattern))
    return {"delete": sorted(set(delete)), "flag": sorted(set(flag)), "rebuild": []}


def fingerprint(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def apply_deletes(entries: list[dict], plan_path: Path | None = None) -> list[str]:
    paths = []
    for entry in entries:
        value = entry.get("path") if isinstance(entry, dict) else None
        if not isinstance(value, str) or Path(value).is_absolute() or ".." in Path(value).parts:
            raise ValueError("invalid plan path")
        path = ROOT / value
        if not owned_file(path) or not git_safe(path) or referenced(path, plan_path) or fingerprint(path) != entry.get("sha256"):
            raise ValueError(f"refusing changed, referenced, protected, or non-generated file: {value}")
        paths.append((path, entry["sha256"]))
    done = []
    for path, expected in paths:
        if not owned_file(path) or not git_safe(path) or fingerprint(path) != expected:
            raise ValueError(f"file changed before deletion: {rel(path)}")
        path.unlink()
        done.append(rel(path))
    return done


def main() -> int:
    global ROOT, KS, CURSOR
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--plan", type=Path, help="write a new dry-run plan, or consume that reviewed plan with --apply")
    parser.add_argument("--apply", action="store_true", help="delete only files in --plan after rechecking them")
    args = parser.parse_args()
    ROOT = args.root.resolve()
    KS, CURSOR = ROOT / ".kstudio", ROOT / ".cursor"
    try:
        if args.apply:
            if not args.plan:
                raise ValueError("--apply requires --plan <reviewed-plan.json>; run a dry-run first")
            plan = json.loads(args.plan.read_text())
            if not isinstance(plan, dict) or plan.get("schema") != SCHEMA or plan.get("root") != str(ROOT) or not isinstance(plan.get("delete"), list):
                raise ValueError("plan schema/root/delete list does not match this repository")
            for path in apply_deletes(plan["delete"], args.plan):
                print(f"deleted: {path}")
            return 0
        bags = collect()
        plan = args.plan or KS / "local" / "k-clean" / f"{uuid.uuid4().hex}.json"
        plan.parent.mkdir(parents=True, exist_ok=True)
        payload = {"schema": SCHEMA, "root": str(ROOT), "delete": [{"path": rel(p), "sha256": fingerprint(p)} for p in bags["delete"]], "flag": [rel(p) for p in bags["flag"]]}
        with plan.open("x", encoding="utf-8") as stream:
            json.dump(payload, stream, indent=2, ensure_ascii=True)
            stream.write("\n")
        print("dry-run: generated-file cleanup only; source changes require semantic review")
        for group in ("delete", "flag"):
            for path in bags[group]:
                print(f"{group}: {rel(path)}")
        print(f"plan: {plan.resolve()}")
        print("After reviewing the exact plan, use --apply --plan <this-file.json>.")
        return 0
    except (OSError, ValueError, TypeError) as error:
        print(f"clean error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
