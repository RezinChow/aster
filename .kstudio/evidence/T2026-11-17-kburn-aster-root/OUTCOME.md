# T2026-11-17-kburn-aster-root

Updated: 2026-11-17 · ≠产品 Pass

Supersedes nest path `T2026-11-17-kburn-aster-nest` (Q14 correction: flat `.aster/`, not `.aster/kstudio`).

## Slice

AI 工程树规范落点 **`workspace/.aster/`**（与 `config.acl` 同根）；遗留 `.kstudio/` 仍解析；仅有 `.aster/config.acl` **不** auto-arm；`.aster/skills`（或 workflow/wiki/evidence/MANIFEST）视为工程标记；skill root 末位 `.aster/skills`（later-wins）；factory skeleton/rules 路径已改 `.aster`。

## Commands

```bash
cargo test --locked -p aster-core --lib kstudio:: -- --nocapture
cargo test --locked -p aster-core --lib agent_skill_roots_include -- --nocapture
cargo test --locked -p aster-acp --lib -- format_kburn_report_materialize project_kstudio_skills_load watched_skill_dirs_include
python3 scripts/verify-hermetic-perf-e2e.py --suite hg2_kburn_aster_root
```

## Counts

| Check | Result |
| --- | --- |
| `kstudio::` | **17 passed** |
| `agent_skill_roots_include_kstudio_skills_last` | **1 passed** |
| `format_kburn_report_materialize_creates_seeds_once` | **1 passed** |
| `format_kburn_coverage_reports_complete_and_partial_workspaces` | **1 passed** (asserts `eng root: …/.aster`) |
| `project_kstudio_skills_load_after_other_project_roots` | **1 passed** |
| `watched_skill_dirs_include_home_agent_roots_before_they_exist` | **1 passed** |
| hermetic `hg2_kburn_aster_root` | **1 passed** |

## Explicitly not claimed

- Migrating this repo's live `.kstudio/` onto `.aster/`
- HG6 / Meta Harness Done
- TUI/Studio UI
