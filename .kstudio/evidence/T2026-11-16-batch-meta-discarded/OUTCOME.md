# Batch child metadata discarded_bytes (E4 residual)

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

`compact_child_metadata` now records `discarded_bytes` (shared byte_budget)
whenever oversized child metadata is compacted for the batch binding surface,
including the lifecycle-budget slim fallback.

## Commands / counts

```text
cargo test --locked -p aster-core --lib compact_child_metadata -- --test-threads=1
# → 2 ok
```

## Explicitly not claimed

- E4 Done / named YOLO Done / Meta Harness Pass.
- Headed Studio / live LLM.
