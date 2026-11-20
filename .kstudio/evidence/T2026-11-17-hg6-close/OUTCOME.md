# T2026-11-17-hg6-close

Updated: 2026-11-17 · **HG6 hard-goal slice closed** (Q13 bar) · **≠产品 Pass** · **≠ Meta Harness Done**

## Close bar (GOALS HG6 · Q13)

Core/ACP 内化 kburn 全套机制 + 规范落点 `.aster/`（遗留 `.kstudio/` 兼容）+ 会话装配对已有工程根 **自动触发**；可叙述 + 可复跑证据。  
**不要求** TUI / Studio 专用 UI。挂文档 alone ≠ Pass。

## Green (reconfirmed this tip)

| Piece | Evidence / command |
| --- | --- |
| Flat `.aster/` eng root + legacy `.kstudio` | `T2026-11-17-kburn-aster-root` · `hg2_kburn_aster_root` |
| Auto-arm (skip bare `config.acl`) | `kstudio::arm_kburn_*` |
| Bare 12 conductor skills | `T2026-11-17-conductor-acl-bare-skills` · `hg2_kburn_bare_skills` |
| Factory seeds + `project.acl` | `hg2_kburn_project_acl` · `hg2_kburn_materialize` · `hg2_kburn_factory_bundle` |
| Workflow helpers in factory | `T2026-11-17-kburn-workflow-helpers` · `hg2_kburn_workflow_helpers` |
| ACP `/kburn` compose | `hg2_kburn_slash_coverage` · `hg2_kburn_acp_coverage` |
| Skill root / layout / README skip | `hg2_kburn_skill_root` · `hg2_kburn_layout_contract` · `hg2_kburn_readme_skip` |
| Conductor E2E pack | `T2026-11-17-conductor-e2e` 10/10 |
| L3 bare-skills gate | `python3 .kstudio/workflow/verify-ai-eng.py --level L3` → **PASS** |
| Hermetic pack (close tip) | `python3 scripts/verify-hermetic-perf-e2e.py` ×11 `hg2_kburn_*` → **18 passed / 0 failed** |

## This-repo eng root

Live Aster checkout keeps tracked eng under **`.kstudio/`**. Product **`.aster/`** is gitignored runtime (`sessions` / `memory` / `config.acl`). That dual-root is intentional; Core prefers engineering markers under `.aster` when present, else legacy `.kstudio`. Optional full migrate of this checkout is **not** required to close HG6 under Q13.

## Explicitly not claimed

- Meta Harness overall Done
- Product Pass / daily headed GUI Pass
- H2 Studio land (still parked · dirty submodule needs commit/push auth)
- 12× SKILL.md bodies embedded in the Core binary (non-goal)
- Auto-creating an eng tree when only bare `config.acl` exists (by design: skip)

## Remaining overall-goal gap (post-HG6)

Studio sync (H2) · headed/daily-use Pass proof · residual trust/efficient knives · release channel discipline. **%≠Pass.**
