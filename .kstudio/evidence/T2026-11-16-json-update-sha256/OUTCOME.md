# byte_budget::json_update_sha256 — Result + fan-out

Date: 2026-11-16.
Branch: `main` @ dirty.

## Change

- `json_update_sha256` returns `serde_json::Result` (fail-closed on serialize).
- Consumers: porcelain digests, workspace MCP trust id, `ExecutionIdentityV1::derive`,
  command-hook definition id (stream, no throwaway `Vec`).
- Trust test `trusted_only_layers_are_untouched` asserts provenance digest presence
  (admission always attaches `forced_layer_digest`).
- Hermetic lib grader `hg2_json_update_sha256`.

≠ named YOLO Done / HG2 product Pass / headed-live.

## Commands / counts

```text
cargo test --locked -p aster-core --lib byte_budget::
# → 6 passed
cargo test --locked -p aster-core --lib execution_identity::
# → 5 passed
cargo test --locked -p aster-core --lib config::workspace_trust::
# → 10 passed
cargo test --locked -p aster-core --lib hooks::command::
# → 8 passed
cargo test --locked -p aster-core --lib porcelain::receipt_tests
# → 39 passed
python3 scripts/verify-hermetic-perf-e2e.py
# → 29 suites / 260 passed / 0 failed
```

## Explicitly not claimed

- Named YOLO Done; measurable HG2 高效 product Pass; headed/live/H2/e_bash/v912.
