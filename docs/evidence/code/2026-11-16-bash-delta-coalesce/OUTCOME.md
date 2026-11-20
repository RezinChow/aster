# Bash output-delta coalesce (Core → ACP streaming)

Date: 2026-11-16.  
Branch: `main`.  
Named YOLO scope: aster-core / aster-acp 流式效率.

## Change

`ToolEventObserver` coalesces `on_output_delta` into ≤4 KiB or ≥50ms batches
(and always flushes on `on_output_complete`) so chatty commands no longer emit
one ACP `ToolCallUpdate` per OS read chunk.

## Verification

```text
cargo test --locked -p aster-core --lib default_sandbox_execution_preserves_timeout_env_and_streaming_contract
→ ok
cargo test --locked -p aster-core --lib output_deltas_coalesce_until_byte_budget_or_complete
→ ok
```

## Explicitly not claimed

- Product Pass / overall GOALS Done.
- Measured wall-clock FPS under headed Studio.
- Time-based flush without a subsequent delta (complete still drains).
