# Git diff range — `discarded_bytes` (E4 residual)

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

`GitTool` diff pagination metadata includes
`range.discarded_bytes = discarded_bytes(total, returned)` via the shared
`byte_budget` helper (same vocabulary as bash).

## Commands / counts

```text
cargo test --locked -p aster-core --lib test_diff_is_utf8_safe → 1 ok
```

## Explicitly not claimed

- Full E4 Done across every tool.
- Named YOLO Done / Meta Harness Pass.
