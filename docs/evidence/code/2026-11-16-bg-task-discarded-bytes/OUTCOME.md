# Background + task discarded_bytes (E4 residual)

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

- Background settle capture metadata adds `discarded_bytes` via
  `CommandOutputSummary::discarded_bytes()` (same vocabulary as bash).
- Task / parallel-task parent-context projection returns discarded byte count
  from `compact_task_output` and exposes `discarded_bytes` on tool metadata
  alongside `truncated_for_context`.

## Commands / counts

```text
cargo test --locked -p aster-core --lib compact_task_output -- --test-threads=1
cargo test --locked -p aster-core --lib format_task_result_for_context -- --test-threads=1
cargo test --locked -p aster-core --lib task_artifact_reference_is_stable -- --test-threads=1
# → 3 ok

cargo test --locked -p aster-core --lib background::tests -- --test-threads=1
# → focused suite green (see terminal)
```

Hermetic pack oracle (pre-slice, still authoritative for pack size):
`just hermetic-perf-e2e` → **13 suites / 239 passed / 0 failed**.

## Explicitly not claimed

- E4 Done / named YOLO Done / Meta Harness Pass.
- Headed Studio / live LLM.
- Remaining tools (grep / read batch / batch compact / …) still may omit discard.
