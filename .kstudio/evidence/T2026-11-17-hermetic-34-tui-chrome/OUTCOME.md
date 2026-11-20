# T2026-11-17 hermetic pack +3 TUI first-token chrome graders

## Change
`scripts/verify-hermetic-perf-e2e.py` adds:
- `hg2_tui_first_stream_thinking` → `aster-pager` `first_stream_start_pre_creates_thinking`
- `hg2_tui_start_turn_thinking` → `aster-pager` `start_turn_pre_creates_thinking_chrome`
- `hg2_acp_stream_start_meta` → `aster-acp` `notification_meta_stamps_turn_and_stream_start_ms`

Later same wave: also `hg2_a5_nested_task_deny` (pack **35**; not in the 34-suite run below).

Follow-up fix: `emit_turn_started_chrome` moved **after** `_aster/queue/changed` so ACP `queue-running-identity` stays green.

## Commands

```bash
python3 scripts/verify-hermetic-perf-e2e.py --out /tmp/aster-hermetic-34.json
# suites 34 · passed 264 · failed 1 · failed_suites [acp_conformance_stdio]
# (pre-fix: chrome before queue/changed)

cargo test --locked -p aster-acp --test acp_conformance_stdio
# after order fix: 15/15 pass
```

## Result (full pack before conformance fix)
- suites: **34**
- passed: **264**
- failed: **1** (`acp_conformance_stdio` / `queue-running-identity`)
- ignored: **13**
- seconds: **600.85**

## Result (conformance after chrome order fix)
- `acp_v1_conformance` **15/15**

## Explicitly not claimed
- Full pack 34 re-run after conformance fix in this OUTCOME (conformance alone re-verified)
- Meta Harness Done / product Pass / headed-live
