# T2026-11-17-e8-compaction-failed-phase

Updated: 2026-11-17 · defect catalog **E8** knife · ≠产品 Pass · ≠ Meta Harness Done

## Change

Compaction ledger gains a **Failed** phase so a mid-flight attach error cannot
leave the attempt stuck in `Started`:

- `CompactionLedgerPhase::Failed` + `mark_failed()`
- `auto_compact_fields` → `("failed", …)`
- Fact compaction emits `AgentEvent::AutoCompact { phase: "failed" }` before
  returning the attach error
- ACP maps `failed` → `sessionUpdate: auto_compact_failed`

`tokens_after > target` remains soft-Ok with `target_exceeded` tracing (not
forced Failed).

## Verification

```text
cargo test --locked -p aster-core --lib mid_flight_failure_leaves_failed_not_started
→ ok (1 passed)
```

Workspace `cargo clippy -p aster-core --lib -D warnings` still fails on
**pre-existing** unrelated lints; no new lint attributed to this knife.

## Explicitly not claimed

- Meta Harness Done / product Pass
- Soft post-target compact becomes hard-fail
- ACP host UI rendering of `auto_compact_failed`
- Full clippy clean of aster-core
