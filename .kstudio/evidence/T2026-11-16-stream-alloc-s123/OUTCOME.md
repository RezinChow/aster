# Stream alloc knives S1–S3 (explore follow-up)

Date: 2026-11-16.  
Branch: `main`.  
Source: [Find next perf knives](5a05655f-7ec3-4f9d-8125-80cceb4c66bd) ranking.

## Change

1. **S1** — `OpenAiClient::append_stream_delta` takes `String` and moves it into
   `TextDelta` / `ReasoningDelta` (no second `to_string()` per token).
2. **S2** — `streaming_bash_delta` omits optional dead fields
   (`output_for_prompt`, `description`); `preview_text` fast-path when
   `len ≤ max_chars`.
3. **S3** — `emit_tool_call_completed` omits `title` / `kind` / `rawInput`
   (already published on start/started).

## Verification

```text
cargo test --locked -p aster-core --lib append_stream_delta_moves_owned_bytes_into_the_event
→ ok
cargo test --locked -p aster-acp --lib tool_cards_use_pager_kind_and_raw_input
→ ok
```

## Explicitly not claimed

- Product Pass / overall GOALS Done.
- TUI O(N²) stream height estimate (explore knife **M** — still open).
- Full BashOutput serde `default` for a tiny delta object (pager still needs
  required wire fields).
