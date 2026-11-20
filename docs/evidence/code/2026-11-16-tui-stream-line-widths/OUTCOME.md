# TUI streaming line-width profile (O(chunk) estimate)

Date: 2026-11-16.  
Branch: `main`.  
Named YOLO: aster-tui 性能 + 全面 E2E.

## Change

1. Agent/thinking height estimates build line widths from **raw markdown source**
   (not rendered plain text).
2. `push_chunk_to_agent` / `push_chunk_to_thinking` (and deferred) call
   `invalidate_after_stream_chunk`: keep and **extend** `cached_line_widths`
   instead of dropping the profile on every chunk (was O(N²) re-clone).

## Verification

```text
cargo test -p aster-pager --lib streaming_chunks_extend_line_widths_without_dropping_the_profile
→ ok
cargo test -p aster-pager --lib estimate_source_lines_is_the_per_line_ceiling_sum
→ ok
```

## Explicitly not claimed

- Product Pass / headed Studio FPS measurement.
- Exact markdown-rendered height (estimate remains an approximation).
