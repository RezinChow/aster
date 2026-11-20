# Program tool discarded_bytes (E4 residual)

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

Nested program/PTC host-tool results expose `discardedBytes` on the JS tool
result object, and `discarded_bytes` on each script call receipt
(`original_output_bytes − output_bytes` via shared byte_budget).

## Commands / counts

```text
cargo test --locked -p aster-core --lib program_tool::tests -- --test-threads=1
# → 39 ok
```

Hermetic recheck after prior E4 residual slice (bg/task):
`tui_913` 11 + `unattended` 33 → **44/0**.

## Explicitly not claimed

- E4 Done / named YOLO Done / Meta Harness Pass.
- Headed Studio / live LLM.
