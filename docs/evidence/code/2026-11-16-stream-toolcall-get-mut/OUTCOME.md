# Streaming tool-call snapshot: get_mut (no clone+reinsert)

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

`apply_tool_call_snapshot` updates an existing slot via `BTreeMap::get_mut`
instead of cloning bound id/name/args and `insert`ing a new triple when the
snapshot omits fields.

## Commands / counts

```text
cargo test --locked -p aster-core --lib openai::streaming::empty_name_tests
# → 8 passed; 0 failed
```

## Explicitly not claimed

- Named YOLO Done / measurable latency Pass.
- Full hermetic pack re-run for this slice alone (see hermetic-25 evidence).
