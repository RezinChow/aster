# Deserialize borrow: migration · ACP document/plugin · snapshot · event · inspection

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

Replaced hot-path `serde_json::from_value(….clone())` with `T::deserialize(&Value)` on:

- `agent_api/migration.rs` — entry fact + completion receipt decode
- `acp/document_read.rs` — tool `Input` parse
- `acp/plugin_mcp.rs` — enabled / timeout / optional MCP fields
- `store/session_snapshot.rs` — transform binding + tool result evidence
- `event_protocol.rs` — `VerificationSummary` projection
- `acp/agent/inspection_commands.rs` — memory manage outcome

## Commands / counts

```text
cargo test --locked -p aster-core --lib -- event_protocol session_snapshot migration::
# → 16 passed; 0 failed

cargo test --locked -p aster-acp --lib -- plugin_mcp document_read inspection
# → 35 passed; 0 failed; 2 ignored
# (one prior flake on timed_out_native_mcp_call… re-ran green alone)
```

Hermetic pack mid-edit hit a transient `long_horizon_contracts` compile race while
read-batch discard was landing; re-run recorded separately after both knives settled.

## Explicitly not claimed

- Named YOLO Done / Meta Harness Pass / HG2 Pass.
- Headed Studio / live LLM / H2 land.
