# OpenAI stream finalize — take tool_calls / usage / response ids

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Named YOLO: core/acp/tui 极致优化.

## Change

`[DONE]` and no-DONE finalize paths `mem::take` the tool-call map (move id/name/args
into `ToolUse`), take `usage` / optional response id fields into `LlmResponse`
instead of cloning them on the terminal event.

## Verification

```text
cargo test --locked -p aster-core --lib 'llm::openai::tests::' → 54 passed
cargo test --locked -p aster-core --lib streaming_split_cr_does_not_emit_partial_event → ok (prior)
ASTER_*_BIN tui_913 one_turn_shows_assistant_text → ok
```

## Explicitly not claimed

- Product Pass / named YOLO Done / latency benchmark.
