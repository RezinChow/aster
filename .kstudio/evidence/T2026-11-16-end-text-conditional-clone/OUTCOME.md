# ACP — conditional end_text clone

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Named YOLO: core/acp/tui 极致优化.

## Change

`AgentEvent::End`: clone `text` into `state.end_text` only when
`should_emit_end_text` still needs a streamed copy; otherwise move.

Also: `message_from_fact` uses `ModelDecision::deserialize(&payload)`.

## Verification

```text
cargo test --locked -p aster-core --lib compaction_transcript_replays_user_and_assistant → ok
cargo test --locked -p aster-acp --test acp_conformance_stdio → 15 passed
```

## Explicitly not claimed

- Product Pass / named YOLO Done.
