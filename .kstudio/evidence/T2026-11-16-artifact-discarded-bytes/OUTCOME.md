# Tool-output artifact discarded_bytes (shared transform)

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

`merge_tool_output_artifact_metadata` now records `discarded_bytes`
(`original_bytes − shown_bytes` via shared byte_budget) on every projected
tool-output artifact. Covers the registry transform path for all tools that
hit the shared head/tail / artifact projection.

## Commands / counts

```text
cargo test --locked -p aster-core --lib registry::tests -- --test-threads=1
# → see terminal (artifact discarded assertion included)
```

Hermetic pack oracle after expansion: **17 suites / 246 passed / 0 failed**.

## Explicitly not claimed

- E4 Done / named YOLO Done / Meta Harness Pass.
- Headed Studio / live LLM.
