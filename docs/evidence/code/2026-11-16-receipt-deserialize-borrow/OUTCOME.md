# Core — receipt JSON deserialize without Value clone

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Named YOLO: core/acp/tui 极致优化.

## Change

Checkpoint / refusal / history_seed receipt parsing uses
`ToolExecutionResultV1::deserialize(&Value)` instead of
`serde_json::from_value(value.clone())`. Also: checkpoint + fact_reads
`ModelDecision::deserialize(&payload)`.

## Verification

```text
cargo test --locked -p aster-core --lib both_adapters_ordinary_checkpoint → ok
cargo test --locked -p aster-core --lib 'agent_api::tests::background_subagent' → 5 passed
cargo test --locked -p aster-core --lib streaming_split_cr_does_not_emit_partial_event → ok
```

Also: `subagent.settled` background_subagent binding uses `deserialize(&Value)`.

## Explicitly not claimed

- Product Pass / named YOLO Done.
