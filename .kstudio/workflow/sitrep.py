#!/usr/bin/env python3
"""Conductor sitrep — read-only .kstudio battle picture (P15).

Project-agnostic: only reads .kstudio layout + optional MANIFEST progress_refs.
Truth: lineage + evidence paths > STATUS > this summary.
% != Pass. 77 != Pass.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KSTUDIO = ROOT / ".kstudio"
WF = KSTUDIO / "workflow"
MANIFEST = KSTUDIO / "MANIFEST.json"


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


def section_bullets(status_text: str, header: str) -> list[str]:
    items: list[str] = []
    section = None
    for line in status_text.splitlines():
        if line.startswith(header):
            section = header
            continue
        if section == header and line.startswith("  - "):
            items.append(line[4:].strip())
        elif section == header and line and not line.startswith((" ", "\t")):
            break
    return items


def progress_refs(manifest: dict) -> list[str]:
    ae = manifest.get("ai_engineering") or {}
    refs = ae.get("progress_refs") or []
    out: list[str] = []
    for r in refs:
        if not isinstance(r, str):
            continue
        p = ROOT / r
        if p.exists():
            out.append(r)
        else:
            out.append(f"{r} (missing)")
    return out


def list_skills() -> list[str]:
    skills = KSTUDIO / "skills"
    if not skills.is_dir():
        return []
    names = []
    for d in sorted(skills.iterdir()):
        if d.is_dir() and d.name.startswith("k-") and (d / "SKILL.md").exists():
            names.append(d.name)
    return names


def load_project_config() -> dict:
    """P16 config.kcl summary (optional)."""
    import subprocess

    load = WF / "load-config.py"
    if not load.is_file():
        return {}
    try:
        out = subprocess.check_output(
            [sys.executable, str(load)],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        return json.loads(out)
    except Exception:
        return {}


def build() -> dict:
    head = read_text(WF / "HEAD").strip()
    wave_dir = WF / "waves" / head if head else None
    status_text = read_text(wave_dir / "STATUS.md") if wave_dir else ""
    status = yamlish_status(status_text)
    lineage = load_json(wave_dir / "lineage.json") if wave_dir else {}
    manifest = load_json(MANIFEST)

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
                "handoff": ev.get("handoff"),
            }
        )

    goals = []
    goals_md = read_text(WF / "GOALS.md")
    if goals_md:
        overall = ""
        heading = None
        for line in goals_md.splitlines():
            if line.startswith("## Overall goal") or line.startswith("## North star"):
                heading = "seen"
                continue
            if heading == "seen":
                if line.startswith("##"):
                    break
                if line.strip():
                    goals.append(f"GOALS overall: {line.strip()}")
                    break
        if not any(g.startswith("GOALS overall:") for g in goals):
            goals.append("GOALS.md: present (see .kstudio/workflow/GOALS.md)")
    for key in ("note", "next_slice", "phase", "merge_sha"):
        if status.get(key):
            goals.append(f"{key}: {status[key]}")

    holds = sorted(p.name for p in wave_dir.glob("HOLD*.md")) if wave_dir else []
    cfg = load_project_config()
    fleet = ((cfg.get("fleet") or {}).get("machine")) or {}
    fleet_sum = []
    for mid, meta in fleet.items():
        meta = meta or {}
        connect = meta.get("connect") if isinstance(meta.get("connect"), dict) else {}
        use = meta.get("use") if isinstance(meta.get("use"), dict) else {}
        fleet_sum.append(
            {
                "id": mid,
                "class": meta.get("class"),
                "label": meta.get("label"),
                "via": connect.get("via"),
                "command": connect.get("command"),
                "workdir": connect.get("workdir"),
                "use_summary": use.get("summary"),
            }
        )
    prefs = ((cfg.get("prefs") or {}).get("role")) or {}

    return {
        "schema": "kstudio.conductor-sitrep.v1",
        "repo": str(ROOT),
        "head_wave": head or None,
        "wave_path": str(wave_dir.relative_to(ROOT)) if wave_dir and wave_dir.exists() else None,
        "status_keys": {
            k: status.get(k)
            for k in (
                "stage_floor",
                "phase",
                "next_slice",
                "merge_sha",
                "conductor_session",
                "last_orchestrate",
                "note",
            )
            if status.get(k)
        },
        "hard_goals_hint": goals,
        "roles": roles_sum,
        "dispatch_now": section_bullets(status_text, "dispatch_now:"),
        "hold": section_bullets(status_text, "hold:"),
        "hold_files": holds,
        "progress_refs": progress_refs(manifest),
        "skills_k": list_skills(),
        "config": {
            "schema": cfg.get("schema"),
            "fleet": fleet_sum,
            "prefs_roles": sorted(prefs.keys()),
            "note": "prefer_* are hints only; not silent lineage bindings (P16/P1)",
        },
        "disclaimer": "%!=Pass; 77!=Pass; lineage+evidence > STATUS",
        "tools": {
            "sitrep": "python3 .kstudio/workflow/sitrep.py",
            "load_config": "python3 .kstudio/workflow/load-config.py",
            "print_paste": ".kstudio/workflow/print-paste.sh",
            "verify": "python3 .kstudio/workflow/verify-ai-eng.py --level L3",
            "skills_dir": ".kstudio/skills/",
            "config_kcl": ".kstudio/config.kcl",
            "goals": ".kstudio/workflow/GOALS.md",
        },
    }


def render_tty(data: dict) -> str:
    lines = [
        "=== k-status sitrep (P15) ===",
        f"HEAD: {data.get('head_wave')}",
        f"wave: {data.get('wave_path')}",
        f"skills: {', '.join(data.get('skills_k') or []) or '(none)'}",
        f"disclaimer: {data.get('disclaimer')}",
        "",
        "-- status --",
    ]
    for k, v in (data.get("status_keys") or {}).items():
        lines.append(f"  {k}: {v}")
    lines += ["", "-- hard_goals_hint --"]
    for g in data.get("hard_goals_hint") or ["(none)"]:
        lines.append(f"  · {g}")
    lines += ["", "-- roles (lineage) --"]
    for r in data.get("roles") or []:
        lines.append(
            f"  {r.get('role_id')}: stage={r.get('stage')} duty={r.get('duty')} "
            f"sha={r.get('head_sha')} ready={r.get('evidence_ready')}"
        )
    lines += ["", "-- dispatch_now --"]
    for d in data.get("dispatch_now") or ["(none)"]:
        lines.append(f"  - {d}")
    lines += ["", "-- hold --"]
    for h in data.get("hold") or ["(none)"]:
        lines.append(f"  - {h}")
    if data.get("hold_files"):
        lines.append(f"  files: {', '.join(data['hold_files'])}")
    lines += ["", "-- progress_refs (MANIFEST; ≠Pass) --"]
    for p in data.get("progress_refs") or ["(none declared)"]:
        lines.append(f"  · {p}")
    cfg = data.get("config") or {}
    lines += ["", "-- config.kcl fleet (P16: connect / use) --"]
    for m in cfg.get("fleet") or []:
        lines.append(f"  · {m.get('id')}: {m.get('label')} [{m.get('class')}]")
        via = m.get("via") or "?"
        cmd = m.get("command") or "(no connect.command)"
        lines.append(f"      connect: via={via} · {cmd}")
        if m.get("workdir"):
            lines.append(f"      workdir: {m.get('workdir')}")
        if m.get("use_summary"):
            lines.append(f"      use: {m.get('use_summary')}")
    if not cfg.get("fleet"):
        lines.append("  · (no config.kcl — copy config.kcl.example)")
    if cfg.get("prefs_roles"):
        lines.append(f"  prefs roles: {', '.join(cfg['prefs_roles'])}")
    lines.append("  tip: python3 .kstudio/workflow/load-config.py --machine <id>")
    lines += [
        "",
        "-- tools --",
        f"  skills: {data['tools']['skills_dir']}",
        f"  config: {data['tools']['config_kcl']}",
        f"  goals: {data['tools'].get('goals', '.kstudio/workflow/GOALS.md')}",
        f"  paste: {data['tools']['print_paste']}",
        "=== end sitrep ===",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="Conductor sitrep (read-only, project-agnostic)")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    if not (WF / "HEAD").exists():
        print("error: missing .kstudio/workflow/HEAD", file=sys.stderr)
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
