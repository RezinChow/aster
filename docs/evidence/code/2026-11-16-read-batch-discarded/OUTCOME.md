# E4 read / read-batch discarded_bytes · discarded_items

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

Read single-range and batch metadata expose `discarded_bytes` /
`discarded_items` under budget truncation (E4 vocabulary).

## Commands / counts

```text
cargo test --locked -p aster-core --lib -- read::batch_tests read::line_endings
# → 12/0
```

## Explicitly not claimed

- E4 Done / named YOLO Done.
