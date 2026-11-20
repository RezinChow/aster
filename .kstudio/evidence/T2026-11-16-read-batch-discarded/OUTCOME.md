# E4 read / read-batch discarded_bytes · discarded_items

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

- Single-file `read` range metadata: `discarded_bytes` + `discarded_items` when
  `budget_clamped` (formatted remaining numbered lines).
- Batch `read` metadata: `discarded_bytes` for prefetched lines omitted from the
  page; `discarded_items` = continuation length.

## Commands / counts

```text
cargo test --locked -p aster-core --lib -- read::batch_tests read::line_endings
# → 12 passed; 0 failed
cargo test --locked -p aster-core --lib -- budget_truncation_reports_partial
# → 1 passed (asserts discarded_bytes > 0 and discarded_items == 2)
```

## Explicitly not claimed

- E4 Done / named YOLO Done / Meta Harness Pass.
- Files never reached after an early break still contribute via
  `discarded_items` (continuation), not always via byte sum.
