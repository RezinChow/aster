# Read-batch budget fit: length probe without segment clone

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

`batch_candidate_fits` no longer clones retained segments + re-renders on every
binary-search step. It uses `batch_response_len` (body lengths + shared footer)
so large truncated batches avoid O(segments × log lines) string clones.

Also ships E4 `discarded_bytes` / `discarded_items` on read range + batch
(see `T2026-11-16-read-batch-discarded`).

## Commands / counts

```text
cargo test --locked -p aster-core --lib batch_response_len_matches_rendered_string
# → 1 passed
cargo test --locked -p aster-core --lib -- read::batch_tests
# → 8 passed (async suite) + len parity separately
python3 scripts/verify-hermetic-perf-e2e.py --suite tui_913_hermetic --suite unattended_e2e
# → 2 suites, 44 passed; 0 failed
```

## Explicitly not claimed

- Named YOLO Done / Meta Harness Pass / E4 Done.
