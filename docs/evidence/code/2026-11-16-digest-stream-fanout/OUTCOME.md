# Digest stream fan-out (event log · snapshot · MCP len · transform · tool sig)

Date: 2026-11-16.
Branch: `main` @ dirty.

## Change

- `core_event_log` / `source_snapshot` entry digests stream via `json_update_sha256`.
- `serialized_entry_len` + MCP `validate_json_size` use `json_serialized_len`.
- `result_transform::canonical_digest` streams; freeze digests refreshed (stream≡to_vec;
  prior freezes were stale vs current policy constants).
- `execution_state::tool_signature` streams with empty-hash fail-open.

≠ named YOLO Done.

## Commands / counts

```text
cargo test --locked -p aster-core --lib core_event_log::
# → 9 passed
cargo test --locked -p aster-core --lib workspace::source_snapshot::
# → 5 passed
cargo test --locked -p aster-core --lib mcp::result::
# → 3 passed
cargo test --locked -p aster-core --lib tools::result_transform::
# → 7 passed
cargo test --locked -p aster-core --lib agent::execution_state::
# → 25 passed
```

## Explicitly not claimed

- Named YOLO Done; full hermetic reconfirm of this exact knife (prior pack 29/260/0).
