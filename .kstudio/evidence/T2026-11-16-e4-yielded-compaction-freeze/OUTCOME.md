# E4 residual — `turn.yielded` + compaction `read_freeze`

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Named YOLO: core/acp/tui 极致优化 + hermetic e2e.

## Change

1. `append_turn_yielded_fact` uses `read_freeze` under the existing writer fence
   and records `log_cut` + `log_byte_len` (aligned with `turn.complete`).
2. `append_compaction_done` uses `read_freeze` for the durable-source check
   (nested fence reuse; key still `compaction:{len}`).

## Verification

```text
cargo test --locked -p aster-core --lib 'agent_api::tests::background_subagent' → 5 passed
cargo test --locked -p aster-core --lib 'agent_api::tests::compact::source_guard' → 4 passed
cargo test --locked -p aster-acp --test acp_conformance_stdio → 15 passed
```

## Explicitly not claimed

- Product Pass / named YOLO Done / full E4 catalog Done.
- Headed Studio / live LLM / seatbelt e_bash (parked).
