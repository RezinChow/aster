# P3 — `register_registration` honors admission

Date: 2026-11-16.  
Branch: `main`.  
Goal knife: Meta Harness **可信** (defect catalog P3).

## Change

`HookEngine::register_registration` now takes `HookSource` and applies the same
`admission.admits` gate as `register_with_source`. Rejected sources leave hook
and handler maps untouched (`None`). Session/SDK bridge registers as `Managed`.

## Verification

```text
cargo test --locked -p aster-core --lib managed_only_engine_refuses_user_register_registration
→ ok

cargo test --locked -p aster-core --lib complete_registration_replaces
→ ok

cargo test --locked -p aster-core --lib atomic_registration_drops_replaced
→ ok
```

## Explicitly not claimed

- Product Pass / Meta Harness Done.
- Removing managed `Allow` → skip-HITL (intentional for trusted engines).
- Default engine `managed_only: false` (P9) flip.
- Studio H2 / gitlink land.
