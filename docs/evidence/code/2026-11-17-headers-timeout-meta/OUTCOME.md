# T2026-11-17 — stamp streamHeadersTimeoutMs on ACP chrome meta

## Change
- `aster-core` `llm::http::stream_headers_timeout_ms()` (public; default 120_000).
- ACP `notification_meta` inserts `streamHeadersTimeoutMs` so hosts can show the
  real headers deadline during Thinking chrome (default unchanged).

## Command
```bash
cargo test --locked -p aster-acp --lib notification_meta_stamps_turn_and_stream_start_ms
# ok · 1 passed (asserts streamHeadersTimeoutMs == Core helper)
```

## Explicitly not claimed
- Default headers timeout reduced
- Pager UI rendering of the deadline field
- Meta Harness Done / product Pass
