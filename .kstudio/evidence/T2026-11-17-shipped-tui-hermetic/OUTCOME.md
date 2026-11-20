# T2026-11-17-shipped-tui-hermetic

Updated: 2026-11-17 · ≠Pass · ≠headed

## Slice

Hermetic (non-live-LLM) subset of `shipped_tui_e2e`: readiness, session wire, identity, refuse-repeated-reads, palette, pre-analysis.

## Commands

```bash
cargo test --locked -p aster-acp --test shipped_tui_e2e -- --test-threads=1 \
  tui_readiness shipped_agent_session_wire shipped_agent_refuses \
  shipped_agent_sends_aster_identity palette_rows pre_analysis
```

## Counts

| Check | Result |
| --- | --- |
| filtered suite | **8 passed · 0 failed** (12.62s) |

## Explicitly not claimed

- Full `shipped_tui_e2e` (includes real LLM / interactive)
- Headed Studio
- Meta Harness Done
