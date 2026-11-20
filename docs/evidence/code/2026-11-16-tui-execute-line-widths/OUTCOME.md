# TUI execute streaming line-width profile

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Named YOLO: core/acp/tui 极致优化.

## Change

Also: `MarkdownContent::with_source` + cold `estimate_line_widths` borrows markdown source (no `text()` clone).

1. `estimate_line_widths` for `Execute` uses output-only text (no command/desc join).
2. `push_chunk_to_execute` uses `invalidate_after_stream_chunk` (keep/extend profile).

## Verification

```text
cargo test --locked -p aster-pager --lib streaming_execute_chunks_extend_line_widths_without_dropping_the_profile → ok
cargo test --locked -p aster-pager --lib line_widths → 2 passed
cargo test --locked -p aster-pager --lib estimate_source_lines → (see below)
```

## Explicitly not claimed

- Product Pass / named YOLO Done.
- BlockContext Arc (still park).
