# Conductor internalization — E2E test plan

Scope (YOLO named): 规划测试用例并完成端到端测试  
Updated: 2026-11-17 · ≠产品 Pass · ≠ Meta Harness Done

## Cases

| ID | Layer | Assertion | Harness |
| --- | --- | --- | --- |
| C1 | Root | Bare `.aster/config.acl` → no auto-arm | `arm_kburn_runtime_skips_…` |
| C2 | Root | Eng markers / legacy `.kstudio` → arm | `arm_kburn_runtime_materializes_…` |
| C3 | Root | Canonical prefer `.aster` with workflow over legacy | `kstudio_root_prefers_aster_…` |
| C4 | Factory | Materialize creates `MANIFEST.json` + **`project.acl`** (not `.kcl`) | new + `format_kburn_report_materialize_…` |
| C5 | Skills | `KBURN_SKILL_NAMES` = 12 bare names (no `k-`) | `kburn_skill_names_are_twelve_unique_…` |
| C6 | Skills | This-repo coverage 12/12 + load | `this_repo_kstudio_skills_cover_all_twelve…` |
| C7 | Skills | `.aster/skills` later-wins last in roots | `agent_skill_roots_include…` + ACP order |
| C8 | ACP | `/kburn` coverage prints `eng root:` | `format_kburn_coverage_…` |
| C9 | ACP | Host composes coverage from Core | `acp_host_can_compose_kburn…` |
| C10 | Pack | Hermetic `hg2_kburn_*` suite wall | `verify-hermetic-perf-e2e.py` filters |

## Explicitly not in this E2E

- Headed Studio / TUI GUI (park H2/headed)
- Push / notarize
- Migrating live `.kstudio/` → `.aster/`
