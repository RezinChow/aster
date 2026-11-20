# SSE — hold blank trailing CR (split CRLF terminator)

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Named YOLO: core/acp/tui 极致优化 + hermetic/trustworthy streams.

## Change

`take_sse_events_scanned` holds **every** trailing `\r` when `!eof`, including a
blank CR that may still grow into a CRLF event terminator. Previously only
non-blank trailing CR was held, so `data:…\r\n\r` emitted a partial event.

Also this cycle (adjacent knives): checkpoint `read_freeze`; OpenAI ToolUseStart
id move when no buffered args; TUI tool-body estimate borrow.

## Verification

```text
cargo test --locked -p aster-core --lib streaming_split_cr_does_not_emit_partial_event → ok
cargo test --locked -p aster-core --lib streaming_crlf_data_frame_matches_lf_payload → ok
cargo test --locked -p aster-core --lib take_sse_events_holds_blank_trailing_cr → (in sse_tests)
cargo test --locked -p aster-acp --test acp_conformance_stdio → 15 passed (after rebuild)
```

## Explicitly not claimed

- Product Pass / named YOLO Done.
- Pre-existing on HEAD before this fix (reproduced with openai sources stashed).
