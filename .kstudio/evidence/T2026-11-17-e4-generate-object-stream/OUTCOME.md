# T2026-11-17-e4-generate-object-stream

Updated: 2026-11-17 · E4 honesty · generate_object stream omit · ≠ E4 Pass · ≠ Meta Done

## Change

`generate_object` success metadata now reports:

- `object_bytes`
- `stream_partial_budget` / `stream_partial_omitted`
- `discarded_bytes` — bytes omitted from the **stream delta** when over budget (tool result still carries the full object)

## Verification

```text
cargo test --locked -p aster-core --lib generate_object_tool_unwraps_array_schema_and_sets_metadata
→ 1 passed

python3 scripts/verify-hermetic-perf-e2e.py --suite hg2_e4_generate_object_stream
→ 1 suite / 1 passed / 0 failed
```

## Explicitly not claimed

- E4 closed for every tool
- Meta Harness Done
