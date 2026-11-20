# ACP: move owned tool delta + ToolCallId without String

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Follow-up to ranked knives (OpenAI finalize `take` already landed).

## Change

1. `emit_tool_call_output_delta` takes `impl Into<String>`; `preview_text_owned` moves short flushes.
2. `ToolCallId::new(id)` — no intermediate `id.to_string()` on start/started/complete/delta.

## Verification

```text
cargo test --locked -p aster-acp --lib tool_cards_use_pager_kind_and_raw_input → ok
cargo test --locked -p aster-core --lib output_deltas_coalesce_until_byte_budget_or_complete → ok
cargo test --locked -p aster-core --lib append_stream_delta_moves_owned_bytes_into_the_event → ok
```

## Explicitly not claimed

- Product Pass / named YOLO Done.
- Live bash FPS under headed Studio.
