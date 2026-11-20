# E3 — observation byte cap ≤ effect record cap

Date: 2026-11-16.  
Branch: `main`.  
Goal knife: Meta Harness **可信** / effect integrity (defect catalog E3).

## Change

- `OBSERVATION_BYTE_CAP` now equals `aster_effect::MAX_RECORD_BYTES` (12 MiB),
  not 64 MiB — hashing cannot outrun a persistable JSONL record.
- `SharedByteBudgets` exposes `observation_max`; hermetic assert
  `observation_max ≤ effect_record_max`.

## Verification

```text
cargo test --locked -p aster-core --lib shared_budgets_expose_positive_caps
→ ok

cargo test --locked -p aster-core --lib an_oversized_sparse_file_is_refused
→ ok
```

## Explicitly not claimed

- Product Pass / Meta Harness Done.
- Wiring `shared_byte_budgets` into every hot path (E4 still open).
- Lowering `CHANGED_PATH_BYTE_CAP` (1 GiB) or raising `MAX_LOG_BYTES`.
- Studio H2 / gitlink land.
