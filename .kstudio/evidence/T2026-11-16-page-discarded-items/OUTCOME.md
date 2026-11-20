# Pagination discarded_items (E4-adjacent residual)

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

Shared `Page::metadata` now exposes `discarded_items`
(`total_items − returned_items`) so glob/ls/grep page surfaces report how many
items remain beyond the current page — measurable waste vocabulary for HG2.

## Commands / counts

```text
cargo test --locked -p aster-core --lib pagination -- --test-threads=1  # 6 ok
cargo test --locked -p aster-core --lib glob_tool -- --test-threads=1   # 8 ok
cargo test --locked -p aster-core --lib 'builtin::ls::' -- --test-threads=1  # 6 ok
```

## Explicitly not claimed

- E4 Done (byte discard catalog still partial) / named YOLO Done / Meta Harness Pass.
- Headed Studio / live LLM.
