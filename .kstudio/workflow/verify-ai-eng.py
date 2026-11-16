#!/usr/bin/env python3
"""Verify repo .kstudio against KStudio AI eng L2/L3 checklist.

Usage (from repo root):
  python3 .kstudio/workflow/verify-ai-eng.py
  python3 .kstudio/workflow/verify-ai-eng.py --level L3
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

UNIVERSAL = ["O", "B", "R", "M", "I", "S", "D"]
ROLE_ID = re.compile(r"^[A-Z]$")


def fail(msg: str, errors: list[str]) -> None:
    errors.append(msg)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--level", default="L3", choices=["L1", "L2", "L3"])
    ap.add_argument(
        "--root",
        default=None,
        help="repo root (default: cwd if .kstudio exists, else parent of this script)",
    )
    args = ap.parse_args()
    script_repo = Path(__file__).resolve().parents[2]
    if args.root:
        root = Path(args.root).resolve()
    else:
        cwd = Path(".").resolve()
        root = cwd if (cwd / ".kstudio").is_dir() else script_repo
    ks = root / ".kstudio"
    errors: list[str] = []

    if not ks.is_dir():
        print(f"FAIL: missing {ks}", file=sys.stderr)
        return 2

    manifest_path = ks / "MANIFEST.json"
    if not manifest_path.is_file():
        fail("missing MANIFEST.json", errors)
        manifest = {}
    else:
        try:
            manifest = json.loads(manifest_path.read_text())
        except json.JSONDecodeError as e:
            fail(f"MANIFEST.json invalid JSON: {e}", errors)
            manifest = {}
        if manifest.get("schema") != "kstudio.project-manifest.v1":
            fail("MANIFEST.schema must be kstudio.project-manifest.v1", errors)

    conductor = manifest.get("conductor") or {}
    if conductor.get("write_policy") != "orchestrate_only":
        fail("conductor.write_policy must be orchestrate_only", errors)
    if conductor.get("role_id", "O") != "O":
        fail("conductor.role_id must be O", errors)
    elev = conductor.get("elevation")
    if elev and elev not in ("on_planning_request", "explicit_only"):
        fail(f"conductor.elevation invalid: {elev!r}", errors)

    head_path = ks / "workflow" / "HEAD"
    if not head_path.is_file():
        fail("missing workflow/HEAD", errors)
        wave_id = ""
    else:
        wave_id = head_path.read_text().strip()
        if not wave_id:
            fail("workflow/HEAD empty", errors)

    wave = ks / "workflow" / "waves" / wave_id if wave_id else None
    if wave_id and (wave is None or not wave.is_dir()):
        fail(f"HEAD points to missing wave: {wave_id}", errors)

    # L1+
    for rel in [
        "wiki/Home.md",
        "wiki/Chronicle.md",
        "wiki/Decisions.md",
        "workflows/prefs.toml",
        "workflow/print-paste.sh",
    ]:
        if not (ks / rel).is_file():
            fail(f"missing {rel}", errors)

    if args.level in ("L2", "L3"):
        billets_path = ks / "workflow" / "billets.json"
        if not billets_path.is_file():
            fail("missing workflow/billets.json", errors)
            billets = {}
        else:
            billets = json.loads(billets_path.read_text())
            if not str(billets.get("schema", "")).startswith("kstudio.billets"):
                fail("billets.schema must start with kstudio.billets", errors)
            ids = [b["id"] for b in billets.get("billets", [])]
            for u in UNIVERSAL:
                if u not in ids:
                    fail(f"billets missing universal seat {u}", errors)
            for bid in ids:
                if not ROLE_ID.match(bid):
                    fail(f"invalid billet id {bid!r}", errors)

        if wave and wave.is_dir():
            for name in ["work-plan.md", "STATUS.md", "lineage.json", "timeline.jsonl"]:
                if not (wave / name).is_file():
                    fail(f"wave missing {name}", errors)
            for seat in UNIVERSAL:
                rp = wave / "roles" / f"{seat}.md"
                if not rp.is_file():
                    fail(f"wave missing roles/{seat}.md", errors)
                else:
                    text = rp.read_text()
                    if "KSTUDIO_COPY" in text or "kind=assign" in text:
                        fail(f"roles/{seat}.md still has machine-protocol copy headers", errors)
                    if seat == "O":
                        if "orchestrate_only" not in text and "不要改" not in text:
                            fail("roles/O.md should state orchestrate-only / no code", errors)
                        if "P10e" not in text and "升为指挥" not in text and "升席" not in text:
                            fail("roles/O.md should mention P10e / elevation", errors)
                        if "P10f" not in text and "接替" not in text:
                            fail("roles/O.md should mention P10f / 接替", errors)
                        if "P14" not in text and "第一性" not in text and "因果" not in text:
                            fail("roles/O.md should mention P14 / 第一性原理", errors)
                        if "P12" not in text and "机器" not in text:
                            fail("roles/O.md should mention P12 / 机器提示", errors)
                        if "P13" not in text and "冲突" not in text:
                            fail("roles/O.md should mention P13 / 冲突检查", errors)
                        if "研究员" not in text and " I" not in text and "`I`" not in text and "发给 I" not in text:
                            if "I" not in text:
                                fail("roles/O.md should mention I (研究员)", errors)
                    elif "短报" not in text:
                        fail(f"roles/{seat}.md missing 短报 guidance", errors)
                    if seat != "O":
                        has_cost_word = "代价" in text
                        has_usd = "USD" in text or "$" in text
                        if not has_cost_word and not has_usd:
                            fail(
                                f"roles/{seat}.md missing P11 cost (代价 or $ / USD tokens)",
                                errors,
                            )
                        if has_cost_word and not has_usd:
                            fail(
                                f"roles/{seat}.md P11 cost must mention $ / USD tokens",
                                errors,
                            )
                        # compact short-report guide should mention 代价 or USD in 短报 section
                        if "短报" in text and "USD" not in text and "代价" not in text:
                            fail(
                                f"roles/{seat}.md short-report section missing cost hint",
                                errors,
                            )
                    # D0029: empty optional fields are themselves waste
                    if seat != "O" and re.search(r"(?m)^浪费：\s*无", text):
                        fail(
                            f"roles/{seat}.md must not exemplify a bare 「浪费：无」 line",
                            errors,
                        )
                    if seat != "O" and "短报" in text:
                        if "整行省略" not in text and "有值才" not in text and "有才写" not in text:
                            fail(
                                f"roles/{seat}.md short-report must say omit-empty / 有值才写",
                                errors,
                            )
                        if "席位" not in text and f"**{seat}**" not in text:
                            fail(
                                f"roles/{seat}.md short-report must require 席位 in first line",
                                errors,
                            )
                        # blank key placeholders teach bad reports
                        if re.search(r"(?m)^(机器|结果|做了|验了|产物|代价)：\s*$", text):
                            fail(
                                f"roles/{seat}.md must not show empty short-report keys (omit or fill examples)",
                                errors,
                            )
                    if seat == "O" and "P19" not in text and "教训" not in text:
                        fail("roles/O.md should mention P19 / 教训", errors)
                    if seat != "O" and not re.search(r"<!--\s*environment\s*:", text, re.I):
                        fail(
                            f"roles/{seat}.md missing <!-- environment: … --> (P12)",
                            errors,
                        )

            lin_path = wave / "lineage.json"
            if lin_path.is_file():
                lin = json.loads(lin_path.read_text())
                role_ids = [r["role_id"] for r in lin.get("roles", [])]
                if role_ids != UNIVERSAL:
                    fail(f"lineage roles order/set want {UNIVERSAL}, got {role_ids}", errors)
                for r in lin.get("roles", []):
                    rid = r["role_id"]
                    if not ROLE_ID.match(rid):
                        fail(f"lineage invalid role_id {rid}", errors)
                    esc = r.get("escalates_to")
                    if esc == "D":
                        fail(f"{rid}.escalates_to=D (疑难必须是 I，不是史政 D)", errors)
                    if esc == "H":
                        fail(f"{rid}.escalates_to=H (现行疑难主码是 I；H 仅别名)", errors)
                    if esc == "S":
                        fail(f"{rid}.escalates_to=S (参谋长不做疑难升级目标)", errors)
                    if rid == "M":
                        deps = set(r.get("depends_on") or [])
                        if deps and not deps.intersection({"B", "R"}):
                            fail(f"M.depends_on should include B/R, got {sorted(deps)}", errors)
                    binding = r.get("binding")
                    if binding is None:
                        fail(f"{rid} missing binding object", errors)
                    prompt = (r.get("prompt") or {}).get("path")
                    if prompt and not (root / prompt).is_file():
                        fail(f"{rid} prompt path missing: {prompt}", errors)

        ae = manifest.get("ai_engineering") or {}
        if not ae.get("conformance"):
            fail("MANIFEST.ai_engineering.conformance missing", errors)
        if not ae.get("billets_path"):
            fail("MANIFEST.ai_engineering.billets_path missing", errors)
        if not ae.get("aril_ref") and not ae.get("conformance_ref"):
            fail("MANIFEST.ai_engineering missing aril_ref/conformance_ref", errors)

    if args.level == "L3":
        ae = manifest.get("ai_engineering") or {}
        if ae.get("conformance") != "L3":
            fail("ai_engineering.conformance must be L3", errors)
        if not (ks / "extensions").exists():
            fail("missing extensions/ directory", errors)
        if not conductor.get("output_ref") and not ae.get("conductor_output_ref"):
            fail("missing conductor output_ref / ai_engineering.conductor_output_ref", errors)
        principles = set(ae.get("principles") or [])
        for req in (
            "P10e",
            "P10f",
            "P12",
            "P13",
            "P14",
            "P15",
            "P16",
            "P17",
            "P18",
            "P11",
            "P10c",
            "P10d",
        ):
            if req not in principles:
                fail(f"ai_engineering.principles missing {req}", errors)
        if not ae.get("first_principles_ref"):
            fail("missing ai_engineering.first_principles_ref (P14)", errors)
        if not ae.get("conductor_skills_ref"):
            fail("missing ai_engineering.conductor_skills_ref (P15)", errors)
        if not ae.get("project_config_ref"):
            fail("missing ai_engineering.project_config_ref (P16)", errors)
        if not ae.get("git_branch_discipline_ref"):
            fail("missing ai_engineering.git_branch_discipline_ref (P17)", errors)
        if not ae.get("full_seat_utilization_ref"):
            fail("missing ai_engineering.full_seat_utilization_ref (P18)", errors)
        sitrep = ks / "workflow" / "sitrep.py"
        if not sitrep.is_file():
            fail("missing workflow/sitrep.py (P15 conductor sitrep)", errors)
        skills_dir = ks / "skills"
        if not skills_dir.is_dir():
            fail("missing .kstudio/skills/ (P15)", errors)
        for req_skill in (
            "k-status",
            "k-progress",
            "k-plan",
            "k-go",
            "k-yolo",
            "k-task",
            "k-goal",
            "k-wiki",
            "k-clean",
            "k-review",
            "k-init",
            "k-loop",
        ):
            sk = skills_dir / req_skill / "SKILL.md"
            if not sk.is_file():
                fail(f"missing .kstudio/skills/{req_skill}/SKILL.md (P15)", errors)
        yolo_skill = skills_dir / "k-yolo" / "SKILL.md"
        if yolo_skill.is_file():
            yolo_text = yolo_skill.read_text(encoding="utf-8")
            for needle in (
                "Target of record",
                "Hard block = slice-local first",
                "Forbidden premature stops",
                "overall goal",
            ):
                if needle not in yolo_text:
                    fail(
                        f"k-yolo/SKILL.md missing stop-discipline phrase: {needle}",
                        errors,
                    )
        if not (ks / "workflow" / "loop-kstudio.py").is_file():
            fail("missing workflow/loop-kstudio.py (P15 k-loop)", errors)
        if not (ks / "workflow" / "init-kstudio.py").is_file():
            fail("missing workflow/init-kstudio.py (P15 k-init)", errors)
        review = ks / "workflow" / "review.py"
        if not review.is_file():
            fail("missing workflow/review.py (P15 k-review)", errors)
        else:
            import subprocess

            review_config = subprocess.run(
                [sys.executable, str(review), "--root", str(root), "--check-config"],
                capture_output=True,
                text=True,
            )
            if review_config.returncode != 0:
                fail("review configuration invalid: " + (review_config.stderr or review_config.stdout).strip()[:300], errors)
        clean = ks / "workflow" / "clean-kstudio.py"
        if not clean.is_file():
            fail("missing workflow/clean-kstudio.py (P15 k-clean)", errors)
        for child in skills_dir.iterdir():
            if child.is_dir() and not child.name.startswith("k-"):
                fail(
                    f"skills/{child.name}/ must use k- prefix (P15)",
                    errors,
                )
        example = ks / "config.kcl.example"
        if not example.is_file():
            fail("missing .kstudio/config.kcl.example (P16)", errors)
        load_cfg = ks / "workflow" / "load-config.py"
        if not load_cfg.is_file():
            fail("missing workflow/load-config.py (P16)", errors)
        else:
            import subprocess

            r = subprocess.run(
                [sys.executable, str(load_cfg)],
                cwd=str(root),
                capture_output=True,
                text=True,
            )
            if r.returncode != 0:
                fail(
                    "config.kcl failed to parse: " + (r.stderr or r.stdout).strip()[:200],
                    errors,
                )
            else:
                try:
                    cfg = json.loads(r.stdout)
                    if cfg.get("schema") != "kstudio.project-config.v1":
                        fail(
                            "config schema must be kstudio.project-config.v1 (P16)",
                            errors,
                        )
                except json.JSONDecodeError:
                    fail("load-config.py did not emit JSON (P16)", errors)
        sync = ks / "workflow" / "sync-k-skills.py"
        if not sync.is_file():
            fail("missing workflow/sync-k-skills.py (P15 auto-load)", errors)
        else:
            import subprocess

            r = subprocess.run(
                [sys.executable, str(sync), "--check"],
                cwd=str(root),
                capture_output=True,
                text=True,
            )
            if r.returncode != 0:
                fail(
                    "k-skills not synced to .cursor (run sync-k-skills.py): "
                    + (r.stdout or r.stderr).strip()[:200],
                    errors,
                )
        if not conductor.get("elevation"):
            fail("conductor.elevation missing (want on_planning_request for P10e)", errors)
        if not conductor.get("elevation_ref") and not ae.get("elevation_ref"):
            fail("missing conductor.elevation_ref (P10e)", errors)
        if not ae.get("environment_prompt_ref") and not conductor.get("environment_prompt_ref"):
            fail("missing ai_engineering.environment_prompt_ref (P12)", errors)
        seats = ae.get("universal_billets") or []
        if seats and seats != UNIVERSAL:
            fail(f"ai_engineering.universal_billets want {UNIVERSAL}, got {seats}", errors)
        pps = ks / "workflow" / "print-paste.sh"
        if pps.is_file() and not os_access_exec(pps):
            pass

    if errors:
        print(f"FAIL ({args.level}) {root.name}: {len(errors)} issue(s)")
        for e in errors:
            print(f"  - {e}")
        return 1

    print(f"PASS ({args.level}) {root.name} HEAD={wave_id or '?'} seats={','.join(UNIVERSAL)}")
    return 0


def os_access_exec(p: Path) -> bool:
    import os

    return os.access(p, os.X_OK)


if __name__ == "__main__":
    sys.exit(main())
