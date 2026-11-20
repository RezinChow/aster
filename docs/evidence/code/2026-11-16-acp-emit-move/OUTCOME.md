# ACP emit: move owned Core delta String onto the wire

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Named YOLO: core/acp/tui 极致优化.

## Change

- `emit_text` / `emit_thought` take `impl Into<String>` and move into `TextContent::new` (no `to_string()` copy).
- Turn handler moves `AgentEvent::TextDelta` / `ReasoningDelta` / `End` owned bytes into emit.

## Verification

```text
cargo test --locked -p aster-acp --lib a10_subagent_post_turn_drain_ttl_is_finite_and_enforced → ok
cargo test --locked -p aster-acp --test tui_913_hermetic (paired bins) → 11 passed; 0 failed
```

## Explicitly not claimed

- Product Pass / named YOLO Done / Meta Harness Done.
- Measured wall-clock latency reduction under live providers.
