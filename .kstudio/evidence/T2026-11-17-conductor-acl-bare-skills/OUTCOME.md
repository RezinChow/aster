# T2026-11-17-conductor-acl-bare-skills

Updated: 2026-11-17 · ≠产品 Pass

## Slice

1. Engineering project config: `.kcl` → **`.acl`** as `project.acl` (+ `.example` / `project.local.acl`) so it does not collide with product `.aster/config.acl`.
2. Twelve conductor skills drop the `k-` prefix (`init` … `yolo`); slash `/init` … `/yolo`; rule `skills.mdc`.

## Commands

```bash
cargo test --locked -p aster-core --lib kstudio:: -- --nocapture
cargo test --locked -p aster-acp --lib -- format_kburn_coverage format_kburn_report_materialize acp_host_can_compose_kburn project_kstudio_skills_load
python3 .kstudio/workflow/sync-k-skills.py --check
python3 .kstudio/workflow/load-config.py --json | head
```

## Counts

| Check | Result |
| --- | --- |
| `kstudio::` | **17 passed** |
| ACP kburn filters (4) | **4 passed** |
| `sync-k-skills.py --check` | **OK sync 12 skill(s) + rules** |
| `load-config.py` | **reads `project.acl`** |

## Explicitly not claimed

- HG6 / Meta Harness Done
- Renaming historical `T*-k-*` evidence folders
- Migrating this repo eng root onto `.aster/`
