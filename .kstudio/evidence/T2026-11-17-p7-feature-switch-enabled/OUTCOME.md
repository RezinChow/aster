# T2026-11-17-p7-feature-switch-enabled

Updated: 2026-11-17 · defect catalog **P7** knife (narrow) · ≠产品 Pass · ≠ Meta Harness Done

## Change

- `feature_switch_enabled(name) -> Option<bool>` — `Removed` fail-closed; unknown → `None`
- Registry row `tools.parallel_task` / alias `parallel_task` marked **Removed** (F1 honesty)
- ACP `initialize` meta projects `featureSwitches` admission map
- Dynamic tool registration refuses Removed names (`parallel_task`)

Digest changes when the registry row set changes (expected).

## Verification

```text
cargo test --locked -p aster-core --lib feature_stage::tests
→ ok (2 passed)

cargo test --locked -p aster-acp --lib initialize_projects_feature_switch_admission
→ ok (1 passed)

cargo test --locked -p aster-core --lib register_dynamic_tool_refuses_removed_feature_switch_names
→ ok (1 passed)
```

## Explicitly not claimed

- Full Experimental-stage enforcement at every call site
- Meta Harness Done / product Pass
- Hosts already calling `feature_switch_enabled` everywhere
