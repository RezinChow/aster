# OpenAI merge_stream_text: move owned snapshot String

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Named YOLO: core/acp/tui 极致优化.

## Change

Also: Done / no-`[DONE]` finalize uses `std::mem::take(&mut text_content)` instead of `clone()`.

`OpenAiClient::merge_stream_text` takes `String` and moves into the accumulator /
delta on empty/replace/append paths (prefix-snapshot path only allocates the
suffix). Streaming call sites pass owned `message.content` / `reasoning_content`.

## Verification

```text
cargo test --locked -p aster-core --lib merge_stream_text_moves_owned_prefix_snapshot_without_recloning_body → ok
cargo test --locked -p aster-core --lib append_stream_delta_moves_owned_bytes_into_the_event → ok
cargo test --locked -p aster-core --lib 'openai::tests::stream_text' → 4 passed
```

## Explicitly not claimed

- Product Pass / named YOLO Done.
- Measured live-provider TTFT improvement.
