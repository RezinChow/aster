# feature-stage-capability-2026-11-16 (P1-8)

## Task

B · implement · P1-8 Feature Stage governance mapped to capability plane: Stage enum, static registry, legacy aliases, stable digest. Wiki DoD §P1-8. Decision: `D-2026-11-16-p1-8-wave-lock`.

## Changes

- `crates/code/core/src/capability/feature_stage.rs` (new): `FeatureStage`, `FeatureSwitchSpec`, `FEATURE_SWITCHES` (Aster mechanism ids), `resolve_feature_switch`, `feature_switch_registry_digest`.
- `crates/code/core/src/capability/mod.rs`: module + public re-exports.

## DoD checklist

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Mechanism switches have Stage (or equiv table) | `FEATURE_SWITCHES[].stage` |
| 2 | Deprecated/legacy keys have alias migration tests | `resolve_feature_switch(alias)` hermetic |
| 3 | Projection/registry digest stable & measurable | `feature_switch_registry_digest` + tamper inequality |
| 4 | Not a Codex feature-list mirror / remote rollout | Aster-absorbed mechanism ids only |

## Commands and results

```bash
cargo test --locked -p aster-core --lib -- capability::feature_stage -- --nocapture
# exit 0 · 2 passed; 0 failed

rustfmt --check --edition 2021 \
  crates/code/core/src/capability/feature_stage.rs \
  crates/code/core/src/capability/mod.rs
# exit 0
```

## Explicitly not claimed

- 产品 Pass / 日常稳定使用
- commit / 推送 / 发布
- 改 CapabilityDescriptor / ACP agentCapabilities 字段布局
- 百分比远程放量
- P1-6 / P2
