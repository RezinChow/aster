# shared-byte-budget-2026-11-16 (P2-12)

## Task

B · P2-12 shared output/persistence byte budgets with measurable discard. Decision: `D-2026-11-16-p2-12-wave-lock`.

## Changes

- `crates/code/core/src/byte_budget.rs`: `SharedByteBudgets`, `shared_byte_budgets`, `discarded_bytes`; hermetic discard + effect ceiling tests.
- `crates/code/core/src/lib.rs`: `pub mod byte_budget`.

## DoD

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Over-limit output truncation measurable | BoundedCapture discard oracle |
| 2 | Persistence volume upper bound asserted | `effect_record_max == MAX_RECORD_BYTES` |
| 3 | Discard count / equiv in OUTCOME | tests assert discarded > 0 |

## Commands

```bash
cargo test --locked -p aster-core --lib -- byte_budget -- --nocapture
# exit 0 · byte_budget 3 passed (filter also hit 3 unrelated *byte_budget* names)
```

## Explicitly not claimed

- 产品 Pass / commit·发布 / 遥测 / 改模型 API / P2-9·10
