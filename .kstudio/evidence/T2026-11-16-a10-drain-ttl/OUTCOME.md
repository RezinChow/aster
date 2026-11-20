# A10 — ACP post-turn subagent drain TTL

Date: 2026-11-16.  
Branch: `main`.  
Named YOLO scope: 极致优化 aster-core / aster-acp / aster-tui 性能与效率.

## Change

`crates/code/acp/src/agent/emit.rs` bounds the post-turn `subagent_started_ms`
100ms poll with a 30s TTL (`subagent_post_turn_drain_ttl` /
`subagent_post_turn_drain_timed_out`). On timeout the drain clears unfinished
ids and exits instead of spinning for the session lifetime.

## Verification

```text
cargo test --locked -p aster-acp --lib a10_subagent_post_turn_drain_ttl_is_finite_and_enforced
→ ok. 1 passed
```

## Explicitly not claimed

- Product Pass / Meta Harness Done / overall GOALS Done.
- Live multi-child hung-drain wall-clock measurement under load.
- Studio H2 land / push.
