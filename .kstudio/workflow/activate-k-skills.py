#!/usr/bin/env python3
"""Link factory skills into installed local agents; preserve all existing custom files."""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from pathlib import Path

AGENTS = ("codex", "claude", "cursor", "opencode")
CORE_SKILLS = {"k-init", "k-status", "k-progress", "k-plan", "k-go", "k-yolo", "k-task", "k-loop", "k-goal", "k-wiki", "k-review", "k-clean"}
NAME = re.compile(r"^k-[a-z0-9-]+$")


def installed_agents(home: Path) -> dict[str, str]:
    found = {}
    for agent, commands in {
        "codex": ("codex",), "claude": ("claude",),
        "cursor": ("cursor-agent", "cursor"), "opencode": ("opencode",),
    }.items():
        executable = next((path for command in commands if (path := shutil.which(command))), None)
        if executable:
            found[agent] = executable
    if "claude" not in found:
        for product in ("Claude", "Claude-3p"):
            base = home / "Library/Application Support" / product / "claude-code"
            for path in sorted(base.glob("*/*/claude.app/Contents/MacOS/claude"), reverse=True):
                if path.is_file() and os.access(path, os.X_OK):
                    found["claude"] = str(path)
                    break
            if "claude" in found:
                break
    if "cursor" not in found:
        for app in (Path("/Applications/Cursor.app"), home / "Applications/Cursor.app"):
            if app.is_dir():
                found["cursor"] = str(app)
                break
    return found


def skill_root(agent: str, home: Path, env: dict[str, str]) -> Path:
    def configured(key: str, default: Path) -> Path:
        value = Path(env[key]).expanduser() if env.get(key) else default
        if not value.is_absolute():
            raise ValueError(f"{key} must be absolute")
        return value

    if agent == "codex":
        # Codex keeps CODEX_HOME/skills compatibility; the current shared root is .agents.
        return configured("CODEX_HOME", home / ".codex") / "skills" if env.get("CODEX_HOME") else home / ".agents/skills"
    if agent == "claude":
        return configured("CLAUDE_CONFIG_DIR", home / ".claude") / "skills"
    if agent == "cursor":
        if env.get("CURSOR_CONFIG_DIR") or env.get("CURSOR_AGENT_HOME"):
            raise ValueError("Cursor directory override needs native path verification; no default path was written")
        return home / ".cursor/skills"
    if agent == "opencode":
        if env.get("OPENCODE_CONFIG_DIR"):
            return configured("OPENCODE_CONFIG_DIR", home / ".config/opencode") / "skills"
        return configured("XDG_CONFIG_HOME", home / ".config") / "opencode/skills"
    raise ValueError(f"unsupported agent: {agent}")


def factory_skills(factory: Path) -> list[Path]:
    root = (factory / "kstudio-skills").resolve(strict=True)
    skills = []
    for path in sorted(root.iterdir()):
        if not NAME.fullmatch(path.name):
            continue
        if path.is_symlink() or not path.is_dir() or path.resolve().parent != root:
            raise ValueError(f"factory skill must be a real child directory: {path}")
        text = (path / "SKILL.md").read_text()
        if not re.search(rf"(?m)^name:\s*{re.escape(path.name)}\s*$", text):
            raise ValueError(f"skill directory/frontmatter name mismatch: {path}")
        skills.append(path)
    missing = CORE_SKILLS - {path.name for path in skills}
    if missing:
        raise ValueError(f"factory missing core skills: {', '.join(sorted(missing))}")
    return skills


def safe_parents(path: Path) -> None:
    for parent in (path, *path.parents):
        if parent.is_symlink():
            raise ValueError(f"preserved symlinked native parent: {parent}")
        if parent.exists() and not parent.is_dir():
            raise ValueError(f"native parent is not a directory: {parent}")


def activate(factory: Path, home: Path, agents: list[str], env: dict[str, str], mode: str) -> dict:
    skills = factory_skills(factory)
    records = []
    for agent in agents:
        try:
            base = skill_root(agent, home, env)
            safe_parents(base)
        except (OSError, ValueError) as error:
            records.append({"agent": agent, "status": "blocked", "reason": str(error)})
            continue
        for source in skills:
            target = base / source.name
            row = {"agent": agent, "skill": source.name, "path": str(target), "source": str(source)}
            try:
                if target.is_symlink() and target.resolve() == source:
                    row["status"] = "present"
                elif target.exists() or target.is_symlink():
                    row.update(status="conflict", reason="existing custom entry preserved")
                elif mode == "apply":
                    safe_parents(base)
                    base.mkdir(parents=True, exist_ok=True)
                    safe_parents(base)
                    target.symlink_to(source, target_is_directory=True)
                    row["status"] = "linked"
                else:
                    row["status"] = "missing" if mode == "check" else "planned"
            except (OSError, ValueError) as error:
                row.update(status="blocked", reason=str(error))
            records.append(row)
    bad = any(row["status"] in ("blocked", "conflict", "missing") for row in records)
    return {
        "schema": "kstudio.agent-skill-activation.v1", "mode": mode,
        "factory": str(factory.resolve()), "skill_count": len(skills),
        "agents": agents, "status": "needs_attention" if bad or not agents else "dry_run" if mode == "dry_run" else "ready",
        "entries": records,
        "limits": "Local native discovery only; existing session menus and remote/cloud agents are not refreshed.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--factory", type=Path, default=Path(__file__).resolve().parents[1], help="KStudio share directory")
    parser.add_argument("--agent", action="append", choices=AGENTS, help="limit to these detected installed agents")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="create missing native symlinks; never replace custom entries")
    mode.add_argument("--check", action="store_true", help="verify native links without writing")
    args = parser.parse_args()
    try:
        home = Path.home()
        found = installed_agents(home)
        requested = list(dict.fromkeys(args.agent or found))
        unavailable = [agent for agent in requested if agent not in found]
        report = activate(args.factory.resolve(), home, [agent for agent in requested if agent in found], dict(os.environ), "apply" if args.apply else "check" if args.check else "dry_run")
        report["installations"] = found
        if unavailable:
            report["unavailable_agents"] = unavailable
            report["status"] = "needs_attention"
        print(json.dumps(report, indent=2))
        return 1 if report["status"] == "needs_attention" else 0
    except (OSError, ValueError) as error:
        print(f"activation blocked: {error}; pass --factory <KStudio share>", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
