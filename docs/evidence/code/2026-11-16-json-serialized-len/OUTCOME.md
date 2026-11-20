# json_serialized_len: budget gates without Vec alloc

Date: 2026-11-16.
Branch: `main` @ dirty.

## Change

- `aster_core::byte_budget::json_serialized_len` counts via `serde_json::to_writer`.
- Consumers: web_search bounded JSON; ACP document/office/memory/workspace/diagnostics;
  batch binding/compact; porcelain content baseline; Gemini request size;
  generate_object / task schema + partial event budgets; durable_memory_vec management budgets.
- Hermetic pack +`hg2_json_serialized_len` (**26 suites / 257 passed**).

≠ named YOLO Done / HG2 Pass.

## Commands / counts

```text
cargo test --locked -p aster-core --lib byte_budget::tests::hg2_json_serialized_len
# → 1 passed
cargo test --locked -p aster-core --lib tools::builtin::batch::
# → 27 passed
python3 scripts/verify-hermetic-perf-e2e.py
# → 26 suites, 257 passed; 0 failed; 13 ignored
```

## Explicitly not claimed

- Named YOLO Done / Meta Harness Pass / headed-live.
