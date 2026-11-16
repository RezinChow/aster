# hooks-managed-only-2026-11-16 (P2-9)

## Task

B · P2-9 Hooks mandatory gate set + managed-only admission. Decision: `D-2026-11-16-p2-9-wave-lock`.

## Changes

- `crates/code/core/src/hooks/policy.rs`: `MANDATORY_HOOK_GATES`, `HookSource`, `HookAdmissionPolicy`, `is_mandatory_hook_gate`.
- `crates/code/core/src/hooks/mod.rs`: re-exports.

## DoD

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Document mandatory gate set | `MANDATORY_HOOK_GATES` |
| 2 | managed-only ignores user hooks | hermetic `managed_only_ignores_user_hooks` |
| 3 | Do not expand event enum | no new `HookEventType` |

## Commands

```bash
cargo test --locked -p aster-core --lib -- hooks::policy -- --nocapture
# exit 0 · 2 passed
```

## Explicitly not claimed

- 产品 Pass / commit·发布 / 钩子市场 / P2-10 / discovery fail-closed 全路径接线 HookEngine
