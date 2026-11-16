#!/usr/bin/env python3
"""Preview or create missing project AI-engineering files from a KStudio factory.

Existing files are never overwritten. Project facts are inputs for an agent,
not invented goals or permission to run discovered project commands.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

TOOLS = ("loop-kstudio.py", "init-kstudio.py", "activate-k-skills.py", "review.py", "clean-kstudio.py", "verify-ai-eng.py",
         "sync-k-skills.py", "load-config.py", "sitrep.py", "progress-scan.py",
         "wiki-site.py", "tty-fmt.py", "print-paste.sh")
SKILLS = ("k-init", "k-status", "k-progress", "k-plan", "k-go", "k-yolo", "k-task", "k-goal", "k-wiki", "k-clean", "k-review", "k-loop")
SEATS = ("O", "B", "R", "M", "I", "S", "D")


def safe_path(root: Path, relative: str) -> Path:
    name = Path(relative)
    if name.is_absolute() or ".." in name.parts:
        raise ValueError(f"path must be relative to its root: {relative}")
    path = root
    for part in name.parts:
        path /= part
        if path.is_symlink():
            raise ValueError(f"refusing symlink: {path}")
        if path != root / name and path.exists() and not path.is_dir():
            raise ValueError(f"parent is not a directory: {path}")
    return path


def source_bytes(factory: Path, relative: str) -> bytes:
    path = safe_path(factory, relative)
    if not path.is_file():
        raise ValueError(f"factory file is missing: {relative}")
    return path.read_bytes()


def factory_path(requested: Path | None) -> Path:
    if requested:
        if requested.is_symlink():
            raise ValueError("factory directory must not be a symlink")
        candidates = [requested.resolve()]
    else:
        script = Path(__file__).resolve()
        candidates = [script.parents[1], script.parents[2] / "share"]
    for candidate in candidates:
        if all((candidate / name).is_dir() for name in ("kstudio-project-skeleton", "kstudio-skills", "kstudio-workflow-tools", "kstudio-agent-rules")):
            return candidate
    raise ValueError("KStudio factory unavailable; pass --factory <KStudio-checkout>/share (installed projects do not contain a private factory copy)")


def command_text(name: str) -> bytes:
    # Match the existing sync generator without executing or overwriting project scripts.
    return f"""---
name: {name}
description: Load and run .kstudio/skills/{name} (P15 conductor skill). Immediate.
---

# /{name}

1. **Immediately** Read and follow **`.kstudio/skills/{name}/SKILL.md`** (authoritative).
2. If missing or stale: `python3 .kstudio/workflow/sync-k-skills.py` then retry.
3. Do not write business/product source unless that skill explicitly allows orchestration-only `.kstudio` metadata.
4. P17: do not privately create git branches/worktrees.
""".encode()


def load_parser(factory: Path):
    source_bytes(factory, "kstudio-workflow-tools/load-config.py")
    spec = importlib.util.spec_from_file_location("kstudio_init_config", factory / "kstudio-workflow-tools/load-config.py")
    module = importlib.util.module_from_spec(spec)
    before = sys.dont_write_bytecode
    try:
        sys.dont_write_bytecode = True
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = before
    return module.parse_document


def bundle(root: Path, factory: Path) -> tuple[dict[str, bytes], set[str]]:
    files = {}
    managed = set()
    skeleton = safe_path(factory, "kstudio-project-skeleton")
    for path in sorted(skeleton.rglob("*")):
        relative = str(path.relative_to(factory))
        safe_path(factory, relative)
        if path.is_file():
            name = ".kstudio/" + path.relative_to(skeleton).as_posix()
            files[name] = source_bytes(factory, relative)
    required = ["MANIFEST.json", "config.kcl", "config.kcl.example", "workflow/HEAD", "workflow/billets.json", "workflow/review-checks.json", "wiki/Home.md", "wiki/Chronicle.md", "wiki/Decisions.md", "wiki/Tasks.md", "extensions/README.md"]
    required += [f"workflow/waves/bootstrap/{name}" for name in ("work-plan.md", "STATUS.md", "lineage.json", "timeline.jsonl")]
    required += [f"workflow/waves/bootstrap/roles/{seat}.md" for seat in SEATS]
    for name in required:
        if ".kstudio/" + name not in files:
            raise ValueError(f"factory skeleton is incomplete: {name}")
    if re.search(rb"(?m)^## T[0-9]", files[".kstudio/wiki/Tasks.md"]):
        raise ValueError("factory task ledger must not contain completed project history")
    parse = load_parser(factory)
    for name in ("config.kcl", "config.kcl.example"):
        starter = parse(files[".kstudio/" + name].decode())
        if starter.get("schema") != "kstudio.project-config.v1" or any(starter.get(section) for section in ("fleet", "agents", "models", "prefs")):
            raise ValueError("factory config must be valid and unconfigured; do not copy real fleet, agent or model bindings")
    lineage = json.loads(files[".kstudio/workflow/waves/bootstrap/lineage.json"])
    if not isinstance(lineage, dict) or not isinstance(lineage.get("roles"), list) or any(not isinstance(row, dict) for row in lineage["roles"]):
        raise ValueError("factory lineage must be an object with a roles array of objects")
    if any(not isinstance(row.get(key), dict) for row in lineage["roles"] for key in ("binding", "code", "evidence")):
        raise ValueError("factory lineage binding, code and evidence must be objects")
    if [row.get("role_id") for row in lineage.get("roles", [])] != list(SEATS) or any(
        row.get("stage") != "planned" or any((row.get("binding") or {}).values())
        or any((row.get("code") or {}).get(key) for key in ("branch", "head_sha", "commits"))
        or any((row.get("evidence") or {}).get(key) for key in ("dir", "ready", "handoff", "accepts"))
        for row in lineage["roles"]
    ):
        raise ValueError("factory lineage must contain only planned, unbound seats without completion evidence")
    tool_names = set(TOOLS)
    tool_names.update(path.name for path in (factory / "kstudio-workflow-tools").iterdir() if path.suffix in (".py", ".sh"))
    for name in sorted(tool_names):
        dest = f".kstudio/workflow/{name}"
        files[dest] = source_bytes(factory, f"kstudio-workflow-tools/{name}")
        managed.add(dest)
    for name in ("styles.css", "wiki.css", "kense-icon.png", "kense-mark.png"):
        files[f".kstudio/workflow/wiki-assets/{name}"] = source_bytes(factory, f"kstudio-workflow-tools/wiki-assets/{name}")
    names = {p.name for p in safe_path(factory, "kstudio-skills").iterdir() if p.name.startswith("k-")}
    for name in SKILLS:
        if name not in names:
            raise ValueError(f"factory skill missing: {name}")
    for name in sorted(names):
        source_bytes(factory, f"kstudio-skills/{name}/SKILL.md")
        directory = safe_path(factory, f"kstudio-skills/{name}")
        for source in sorted(directory.rglob("*")):
            relative = str(source.relative_to(factory))
            safe_path(factory, relative)
            if source.is_file():
                dest = f".kstudio/skills/{name}/" + source.relative_to(directory).as_posix()
                files[dest] = source_bytes(factory, relative)
                managed.add(dest)
    for name in ("k-skills.mdc", "git-branch-discipline.mdc"):
        dest = f".kstudio/agent-rules/{name}"
        files[dest] = source_bytes(factory, f"kstudio-agent-rules/{name}")
        managed.add(dest)
    files[".kstudio/workflows/templates/parallel-lanes-example.v1.json"] = source_bytes(factory, "workflow-templates/parallel-lanes-example.v1.json")
    files["AGENTS.md"] = b"# Project AI engineering\n\nAuthoritative skills are in .kstudio/skills/k-*/SKILL.md. Read the matching skill when a user invokes /k-*.\nUse /k-goal for unknown product goals, /k-task for the current task, and /k-plan for whole-project planning.\nConductor O orchestrates only; Implementer roles change product source. Bind agents, models and environments explicitly.\nReview actual source and evidence before claiming acceptance; initialization and L3 are not product Pass.\n"

    head = safe_path(root, ".kstudio/workflow/HEAD")
    wave = head.read_text().strip() if head.is_file() else "bootstrap"
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", wave):
        raise ValueError("existing workflow/HEAD is invalid; it is retained and requires project repair")
    waves = safe_path(root, ".kstudio/workflow/waves")
    if not head.exists() and waves.is_dir() and any(p.is_dir() and not p.name.startswith(".") for p in waves.iterdir()):
        raise ValueError("existing waves have no HEAD; choose the current wave explicitly before initialization")
    if wave != "bootstrap":
        files = {key: value for key, value in files.items() if not key.startswith(".kstudio/workflow/waves/bootstrap/")}
    manifest = json.loads(files[".kstudio/MANIFEST.json"])
    if not isinstance(manifest, dict) or manifest.get("schema") != "kstudio.project-manifest.v1" or not isinstance(manifest.get("ai_engineering"), dict):
        raise ValueError("factory manifest must be a kstudio.project-manifest.v1 object with ai_engineering")
    manifest["project"] = root.name
    manifest["ai_engineering"]["head_wave"] = wave
    files[".kstudio/MANIFEST.json"] = (json.dumps(manifest, indent=2) + "\n").encode()

    project_skills = safe_path(root, ".kstudio/skills")
    if project_skills.is_dir():
        for directory in sorted(project_skills.iterdir()):
            if not re.fullmatch(r"k-[a-z0-9-]+", directory.name):
                continue
            safe_path(root, str(directory.relative_to(root)))
            if not (directory / "SKILL.md").is_file():
                continue
            names.add(directory.name)
            for source in sorted(directory.rglob("*")):
                name = source.relative_to(root).as_posix()
                safe_path(root, name)
                if source.is_file():
                    files.setdefault(name, source.read_bytes())
    project_rules = safe_path(root, ".kstudio/agent-rules")
    if project_rules.is_dir():
        for source in project_rules.glob("*.mdc"):
            name = source.relative_to(root).as_posix()
            safe_path(root, name)
            if source.is_file():
                files.setdefault(name, source.read_bytes())

    # Existing authority wins when creating a missing native mirror.
    for name, data in list(files.items()):
        if name.startswith(".kstudio/skills/") or name.startswith(".kstudio/agent-rules/"):
            existing = safe_path(root, name)
            effective = existing.read_bytes() if existing.is_file() else data
            dest = ".cursor/" + name[len(".kstudio/"):].replace("agent-rules/", "rules/", 1)
            files[dest] = effective
            managed.add(dest)
    for name in sorted(names):
        dest = f".cursor/commands/{name}.md"
        files[dest] = command_text(name)
        managed.add(dest)
    return files, managed


def project_facts(root: Path) -> dict:
    facts = {"readme": None, "manifests": [], "ci": [], "candidate_checks": [], "warnings": [], "product_goal": "unknown"}
    for name in ("README.md", "README.rst", "README"):
        path = root / name
        if path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(root):
            facts["readme"] = {"path": name, "first_line": path.read_text(errors="replace").splitlines()[:1]}
            break
    for name in ("package.json", "Cargo.toml", "pyproject.toml", "go.mod"):
        path = root / name
        if not path.is_file() or path.is_symlink() or not path.resolve().is_relative_to(root):
            continue
        facts["manifests"].append(name)
        if name == "package.json":
            try:
                scripts = json.loads(path.read_text()).get("scripts", {})
                for key in ("lint", "typecheck", "check", "test", "build"):
                    if isinstance(scripts, dict) and key in scripts:
                        facts["candidate_checks"].append({"source": name, "script": key, "review_required": True})
            except (ValueError, AttributeError) as error:
                facts["warnings"].append(f"package.json could not be read: {error}")
        elif name == "Cargo.toml":
            facts["candidate_checks"].append({"source": name, "argv": ["cargo", "test", "--workspace", "--locked"], "review_required": True})
    folder = root / ".github/workflows"
    if folder.is_dir() and not folder.is_symlink() and folder.resolve().is_relative_to(root):
        facts["ci"] = [str(path.relative_to(root)) for path in sorted(folder.iterdir()) if path.suffix in (".yml", ".yaml") and path.is_file() and not path.is_symlink()]
    return facts


def validate_existing(root: Path, factory: Path) -> None:
    parse = load_parser(factory)
    for name in ("config.kcl.example", "config.kcl", "config.local.kcl"):
        path = safe_path(root, ".kstudio/" + name)
        if path.is_file():
            cfg = parse(path.read_text())
            if name != "config.local.kcl" and cfg.get("schema") != "kstudio.project-config.v1":
                raise ValueError(f"existing {name} has an invalid schema; it is not overwritten")
    for name, schema in (("MANIFEST.json", "kstudio.project-manifest.v1"), ("workflow/review-checks.json", "kstudio.review-checks.v1")):
        path = safe_path(root, ".kstudio/" + name)
        if path.is_file():
            cfg = json.loads(path.read_text())
            if not isinstance(cfg, dict) or cfg.get("schema") != schema:
                raise ValueError(f"existing {name} has an invalid schema; it is not overwritten")
            if name.endswith("review-checks.json") and (not isinstance(cfg.get("checks"), list) or not cfg["checks"]):
                raise ValueError("existing review-checks.json has no checks; it is not overwritten")


def create_file(root: Path, relative: str, data: bytes) -> None:
    target = safe_path(root, relative)
    target.parent.mkdir(parents=True, exist_ok=True)
    safe_path(root, relative)
    fd, temporary = tempfile.mkstemp(prefix=".kstudio-init-", dir=target.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, 0o755 if target.suffix == ".sh" else 0o644)
        safe_path(root, relative)
        os.link(temporary, target, follow_symlinks=False)
    finally:
        Path(temporary).unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True, help="existing project or empty target directory")
    parser.add_argument("--factory", type=Path, help="KStudio share directory; required when not adjacent to this installed tool")
    parser.add_argument("--apply", action="store_true", help="create missing files only; never overwrite existing files")
    args = parser.parse_args()
    result = {"schema": "kstudio.init-plan.v1", "mode": "apply" if args.apply else "preview", "status": "blocked", "created": [], "retained": [], "conflicts": []}
    try:
        if args.root.is_symlink():
            raise ValueError("target root must not be a symlink")
        root = args.root.resolve()
        if root.exists() and not root.is_dir():
            raise ValueError("target root must be a directory")
        factory = factory_path(args.factory)
        result.update(root=str(root), factory=str(factory), facts=project_facts(root))
        files, managed = bundle(root, factory)
        validate_existing(root, factory)
        create = []
        for name, data in sorted(files.items()):
            path = safe_path(root, name)
            if path.exists():
                if not path.is_file():
                    raise ValueError(f"destination is not a file: {name}")
                result["retained"].append(name)
                if name in managed and path.read_bytes() != data:
                    result["conflicts"].append(name)
            else:
                create.append(name)
        result["create"] = create
        if args.apply:
            root.mkdir(parents=True, exist_ok=True)
            for name in create:
                create_file(root, name, files[name])
                result["created"].append(name)
        result["status"] = "partial" if result["conflicts"] else "created_pending_verification" if args.apply else "planned"
        print(json.dumps(result, indent=2, ensure_ascii=True))
        return 1 if result["conflicts"] else 0
    except (OSError, ValueError, TypeError, KeyError, IndexError) as error:
        result["status"] = "partial" if result["created"] else "blocked"
        result["error"] = str(error)
        print(json.dumps(result, indent=2, ensure_ascii=True))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
