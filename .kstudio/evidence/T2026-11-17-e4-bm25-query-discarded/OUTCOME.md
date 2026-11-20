# T2026-11-17-e4-bm25-query-discarded

Updated: 2026-11-17 · E4 honesty · BM25 echoed-query budget · ≠ E4 Pass · ≠ Meta Done

## Change

BM25 display/query echo uses `bounded_query_display` and reports:

- `query_discarded_chars`
- `query_display_budget` (256)

Truncation behavior unchanged; observability only.

## Verification

```text
cargo test --locked -p aster-core --lib bounded_query_display_reports_discarded_chars
→ 1 passed

python3 scripts/verify-hermetic-perf-e2e.py --suite hg2_e4_bm25_query_discarded
→ 1 suite / 1 passed / 0 failed
```

## Explicitly not claimed

- E4 closed for every tool
- Meta Harness Done
