#!/usr/bin/env python3
"""Conductor sitrep — read-only eng-root battle picture (P15).

Lives under <eng-root>/workflow/ (.aster canonical or legacy .kstudio).
% != Pass. 77 != Pass.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ENG = Path(__file__).resolve().parents[1]
ROOT = ENG.parent
WF = ENG / "workflow"
MANIFEST = ENG / "MANIFEST.json"

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


def read_text(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8")
    except OSError:
        return ""


def yamlish_status(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in text.splitlines():
        if not line or line.startswith("#") or line.startswith((" ", "\t")):
            continue
        if ":" not in line:
            continue
        k, _, v = line.partition(":")
        k, v = k.strip(), v.strip()
        if k and k not in out:
            out[k] = v
    return out


def load_json(p: Path) -> dict:
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"error": f"invalid json: {p}"}


def list_skills() -> list[str]:
    skills = ENG / "skills"
    if not skills.is_dir():
        return []
    names = []
    for d in sorted(skills.iterdir()):
        if d.is_dir() and d.name in CANONICAL_SKILLS and (d / "SKILL.md").exists():
            names.append(d.name)
    return names


def build() -> dict:
    head = read_text(WF / "HEAD").strip()
    wave_dir = WF / "waves" / head if head else None
    status_text = read_text(wave_dir / "STATUS.md") if wave_dir else ""
    status = yamlish_status(status_text)
    lineage = load_json(wave_dir / "lineage.json") if wave_dir else {}
    roles_sum = []
    for r in lineage.get("roles") or []:
        ev = r.get("evidence") or {}
        code = r.get("code") or {}
        roles_sum.append(
            {
                "role_id": r.get("role_id"),
                "duty": r.get("duty"),
                "stage": r.get("stage"),
                "head_sha": code.get("head_sha") or code.get("merge_sha"),
                "evidence_ready": ev.get("ready"),
            }
        )
    return {
        "schema": "kstudio.conductor-sitrep.v1",
        "repo": str(ROOT),
        "eng_root": str(ENG),
        "head_wave": head or None,
        "wave_path": str(wave_dir.relative_to(ROOT)) if wave_dir and wave_dir.exists() else None,
        "status_keys": {
            k: status.get(k)
            for k in ("stage_floor", "phase", "next_slice", "note")
            if status.get(k)
        },
        "roles": roles_sum,
        "skills": list_skills(),
        "disclaimer": "%!=Pass; lineage+evidence > STATUS",
        "tools": {
            "sitrep": f"python3 {ENG.name}/workflow/sitrep.py",
            "print_paste": f"{ENG.name}/workflow/print-paste.sh",
            "skills_dir": f"{ENG.name}/skills/",
            "goals": f"{ENG.name}/workflow/GOALS.md",
        },
    }


def render_tty(data: dict) -> str:
    lines = [
        "=== status sitrep (P15) ===",
        f"HEAD: {data.get('head_wave')}",
        f"wave: {data.get('wave_path')}",
        f"eng: {data.get('eng_root')}",
        f"skills: {', '.join(data.get('skills') or []) or '(none)'}",
        f"disclaimer: {data.get('disclaimer')}",
        "",
        "-- status --",
    ]
    for k, v in (data.get("status_keys") or {}).items():
        lines.append(f"  {k}: {v}")
    lines += ["", "-- roles (lineage) --"]
    for r in data.get("roles") or []:
        lines.append(
            f"  {r.get('role_id')}: stage={r.get('stage')} duty={r.get('duty')} "
            f"ready={r.get('evidence_ready')}"
        )
    lines += ["", "=== end sitrep ===", ""]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="Conductor sitrep (eng-root portable)")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    if not (WF / "HEAD").exists():
        print(f"error: missing {ENG.name}/workflow/HEAD", file=sys.stderr)
        return 2
    data = build()
    if args.json:
        json.dump(data, sys.stdout, indent=2, ensure_ascii=False)
        sys.stdout.write("\n")
    else:
        sys.stdout.write(render_tty(data))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
