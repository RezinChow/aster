# Deserialize borrow: migration · ACP document/plugin · snapshot · event · inspection

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

Hot-path `from_value(clone)` → `T::deserialize(&Value)` on migration receipts,
ACP document/plugin args, session snapshot evidence binding, event verification
summary, and inspection memory outcome.

## Commands / counts

```text
cargo test --locked -p aster-core --lib -- event_protocol session_snapshot migration::
# → 16/0
cargo test --locked -p aster-acp --lib -- plugin_mcp document_read inspection
# → 35/0 (2 ignored)
```

## Explicitly not claimed

- Named YOLO Done / Meta Harness Pass.
- Headed / live / H2.
