# CommandOutputSummary::discarded_bytes

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

`CommandOutputSummary::discarded_bytes()` wraps the shared byte_budget helper;
bash capture metadata calls the method.

## Commands / counts

```text
cargo test --locked -p aster-core --lib shared_budgets_expose → 1 ok
cargo test --locked -p aster-core --lib tool_capture_discard → 1 ok
cargo test --locked -p aster-core --lib output_deltas_coalesce → 1 ok
```

## Explicitly not claimed

- Named YOLO Done / E4 Done / Meta Harness Pass.
