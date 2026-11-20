# T2026-11-17-p7-feature-switch-stages

Updated: 2026-11-17 · P7 deepen · stage honesty · ≠全量 Experimental 闸门 · ≠ Meta Done

## Change

- ACP `initialize` meta adds `featureSwitchStages` (id → stage string)
- Promote shipped mechanisms to **Stable**: `sandbox.permission_profile`, `compaction.ledger`
- Leave `tools.patch_codes` **Experimental**
- Hosts can tell Stable vs Experimental without mistaking `featureSwitches.enabled=true` for Stable

Digest string changes when registry stage rows change (expected).

## Verification

```text
cargo test --locked -p aster-core --lib feature_stage::tests
→ 2 passed

cargo test --locked -p aster-acp --lib initialize_projects_feature_switch_admission
→ 1 passed

python3 scripts/verify-hermetic-perf-e2e.py \
  --suite hg2_p7_feature_switch \
  --suite hg2_p7_dynamic_refuse
→ 2 suites / 2 passed / 0 failed
```

## Explicitly not claimed

- Experimental-stage hard refuse at every call site
- Meta Harness Done / product Pass
- Hosts already consuming `featureSwitchStages`
