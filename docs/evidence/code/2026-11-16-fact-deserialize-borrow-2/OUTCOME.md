# Fact-path deserialize borrow (round 2)

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

Avoid `serde_json::from_value(owned/cloned Value)` on hot fact-fold paths:

| Path | Before → after |
| --- | --- |
| `fact_reads::tool_result_weights` | `from_value(payload)` → `ModelDecision::deserialize` |
| `history_seed::recorded_tool_calls_in` | model.turn / tool.result / compaction.done → `deserialize(&payload)` |
| `receipts/refusal::prepared_actions` | `from_value(prepared.clone())` → `ToolPreparedV1::deserialize` |
| `receipts` debt fold | prepared / receipt / effects / background_subagent → borrow deserialize |

## Commands / counts

```text
cargo test --locked -p aster-core --lib recorded_tool → 2 ok
cargo test --locked -p aster-core --lib refusal_cycle → 17 ok (pre-receipts-extra)
```

Re-run `refusal_cycle` after receipts.rs edits in this slice.

## Explicitly not claimed

- Named YOLO Done / HG2 Pass / Meta Harness Pass.
- That every `from_value` in core is gone.
