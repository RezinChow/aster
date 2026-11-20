# WebFetch range — `discarded_chars` (E4 residual)

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

`WebFetchTool` success metadata `range.discarded_chars` =
`discarded_bytes(total_chars, returned_chars)` (shared helper; char units).

## Commands / counts

```text
cargo test --locked -p aster-core --lib content_range_stops → 1 ok
```

## Explicitly not claimed

- Full E4 Done / named YOLO Done / Meta Harness Pass.
