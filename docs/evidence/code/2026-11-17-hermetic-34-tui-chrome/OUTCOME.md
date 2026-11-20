# T2026-11-17 hermetic pack +3 TUI first-token chrome graders

## Change
`scripts/verify-hermetic-perf-e2e.py` adds:
- `hg2_tui_first_stream_thinking` → `aster-pager` `first_stream_start_pre_creates_thinking`
- `hg2_tui_start_turn_thinking` → `aster-pager` `start_turn_pre_creates_thinking_chrome`
- `hg2_acp_stream_start_meta` → `aster-acp` `notification_meta_stamps_turn_and_stream_start_ms`

Locks T2026-11-17-tui-first-token-chrome into the daily hermetic floor.

## Command
```bash
python3 scripts/verify-hermetic-perf-e2e.py \
  --suite hg2_tui_first_stream_thinking \
  --suite hg2_tui_start_turn_thinking \
  --suite hg2_acp_stream_start_meta
```

## Result
- suites: **3**
- passed: **3**
- failed: **0**
- failed_suites: []
- seconds: **312.15**

Pack size when full run: **31 → 34** suites (prior 31 + these 3).

## Explicitly not claimed
- Full pack 34-suite wall-clock reconfirm in this OUTCOME (only the 3 new suites ran here)
- Meta Harness Done / product Pass / headed-live
