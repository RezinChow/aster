# ACP meta deserialize borrow

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

| Path | Change |
| --- | --- |
| `permission_state::from_meta` | `Deserialize::deserialize(value)` (no clone) |
| `agent::validate_plugin_selection` | same for `SelectionCursor` |
| `host_context` knowledgeCompile | same for `CompileScope` |
| `office_read` / `office_file` / `output_check` / `wiki_search` | args deserialize without clone |
| `emit::announce_session_usage` | `SessionId::new(&str)` → Arc without intermediate String |

## Commands / counts

```text
cargo test --locked -p aster-acp --lib permission_state → 9 ok
cargo test --locked -p aster-acp --lib host_context → 15 ok
cargo test --locked -p aster-acp --lib plugin_selection → 14 ok
cargo test --locked -p aster-acp --lib wiki_search → 9 ok
cargo test --locked -p aster-acp --lib output_check → 10 ok
cargo test --locked -p aster-acp --lib office_ → 40 ok
cargo test --locked -p aster-acp --lib session_usage_notifications → 1 ok
```

## Explicitly not claimed

- Named YOLO Done / Meta Harness Pass.
