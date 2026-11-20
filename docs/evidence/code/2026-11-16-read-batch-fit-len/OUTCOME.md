# Read-batch budget fit: length probe without segment clone

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

`batch_candidate_fits` → `batch_response_len` (no segment clone per binary-search step).

## Commands / counts

```text
cargo test --locked -p aster-core --lib -- read::batch_tests
```

## Explicitly not claimed

- Named YOLO Done.
