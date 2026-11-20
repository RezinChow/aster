# T2026-11-17-conductor-e2e

Updated: 2026-11-17 · YOLO named scope: 规划测试用例并完成端到端测试 · ≠产品 Pass · ≠ Meta Harness Done

## Slice

Planned conductor internalization E2E cases (C1–C10) and executed hermetic pack covering `.aster` root, bare skill names, `project.acl` materialize, ACP `/kburn` compose.

Also: seed list now includes `project.acl` / `project.acl.example`; sitrep lists bare skill names.

## Commands

```bash
cargo test --locked -p aster-core --lib kstudio:: -- --nocapture
python3 scripts/verify-hermetic-perf-e2e.py \
  --suite hg2_kburn_skill_root --suite hg2_kburn_layout_contract \
  --suite hg2_kburn_acp_coverage --suite hg2_kburn_readme_skip \
  --suite hg2_kburn_slash_coverage --suite hg2_kburn_materialize \
  --suite hg2_kburn_factory_bundle --suite hg2_kburn_aster_root \
  --suite hg2_kburn_bare_skills --suite hg2_kburn_project_acl \
  --out .kstudio/evidence/T2026-11-17-conductor-e2e/hermetic-summary.json
```

## Counts

| Check | Result |
| --- | --- |
| Test plan | `TESTPLAN.md` (C1–C10) |
| `kstudio::` | **17 passed** |
| Hermetic kburn pack | **10 suites · 17 passed · 0 failed** · 23.73s (lib wall; + just build) |
| failed_suites | **[]** |

## Explicitly not claimed

- Meta Harness / HG6 product Pass
- Headed Studio / TUI GUI E2E
- Live LLM unattended convergence
- Push / notarize
