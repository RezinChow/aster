# skills-partial-load-2026-11-16 (P2-11)

## Task

B · P2-11 Skills partial-success loading: bad candidate does not block siblings; errors enumerable; standing digest contract unchanged. Decision: `D-2026-11-16-p2-11-wave-lock`.

## Changes

- `crates/code/core/src/skills/registry.rs`: `SkillLoadErrorKind` / `SkillLoadError` / `SkillLoadReport`; `load_from_dir_report`; `load_from_dir` delegates.
- `crates/code/core/src/skills/mod.rs`: re-exports.
- Hermetic: `bad_skill_does_not_block_good_sibling_and_errors_are_enumerable`.

## DoD

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Bad + good same dir → good usable | test asserts `good-skill` present |
| 2 | Errors enumerable | `report.errors` with Parse kind |
| 3 | Standing digest contract | loader docs: does not write standing context |

## Commands

```bash
cargo test --locked -p aster-core --lib -- bad_skill_does_not_block test_load_from_dir -- --nocapture
# exit 0 · 9 passed (filter matched load_from_dir family)
```

## Explicitly not claimed

- 产品 Pass / commit·发布 / 合并 .kstudio 技能进 Core / P2-9·10·12
