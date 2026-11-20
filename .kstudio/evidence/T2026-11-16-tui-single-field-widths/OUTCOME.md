# TUI — single-field `estimate_line_widths` borrow

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Named YOLO: core/acp/tui 极致优化.

## Change

`Stub` / `UserPrompt` / `System` / `ContextInfo` estimate paths borrow field
`&str` directly instead of allocating via `searchable_text()` join+clone.

## Verification

```text
cargo test --locked -p aster-pager --lib estimate_line_widths_borrows_single_field_blocks
cargo test --locked -p aster-pager --lib 'estimate_source_lines_without|streaming_execute_chunks|streaming_chunks_extend'
```

## Explicitly not claimed

- Product Pass / named YOLO Done / BlockContext Arc (still park).
