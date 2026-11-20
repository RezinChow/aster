# TUI SentMessage estimate borrow (exhaustive widths)

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

`estimate_line_widths` covers `ToolCall::SentMessage` via borrowed `input.text`
(no searchable join). Match is exhaustive over `RenderBlock` (no `_` →
`searchable_text` fallback).

## Commands / counts

```text
cargo test --locked -p aster-pager --lib estimate_line_widths_borrows_subagent → 1 ok
```

## Explicitly not claimed

- Named YOLO Done / Meta Harness Pass / headed e2e.
