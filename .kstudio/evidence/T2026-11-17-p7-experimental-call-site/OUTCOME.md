# T2026-11-17-p7-experimental-call-site

Updated: 2026-11-17 · `/yolo` · P7 Experimental call-site hard refuse · ≠ Meta Done

## Change

- Core `feature_switch_call_site_allowed(name) -> Option<bool>`
  - Stable / Deprecated → `Some(true)`
  - Experimental / Development / Removed → `Some(false)`
  - unknown → `None`
- Dynamic tool registration uses this gate (not only `Removed` via `feature_switch_enabled`)
- `tools.patch_codes` / alias `verified_patch` refused at registration even while
  `feature_switch_enabled` remains `true` (hosts must not treat enabled as Stable)
- ACP `PROTOCOL.md` documents the split
- Hermetic suite `hg2_p7_experimental_refuse`

## Verification

```text
cargo test --locked -p aster-core --lib feature_stage::tests
→ 2 passed

cargo test --locked -p aster-core --lib register_dynamic_tool_refuses_
→ 2 passed (Removed + Experimental)

python3 scripts/verify-hermetic-perf-e2e.py \
  --suite hg2_p7_feature_switch \
  --suite hg2_p7_dynamic_refuse \
  --suite hg2_p7_experimental_refuse
→ 3 suites / 3 passed / 0 failed (~29s)
```

## Explicitly not claimed

- Every product call site already calls `feature_switch_call_site_allowed`
- Opt-in path to enable Experimental in production
- Meta Harness Done / product Pass
