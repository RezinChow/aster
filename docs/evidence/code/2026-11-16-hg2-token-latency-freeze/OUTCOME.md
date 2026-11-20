# HG2 measurable surfaces — token + latency freeze graders

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Named YOLO: Core/ACP/TUI perf + hermetic e2e.

## Change

1. **Token freeze grader** (`aster-acp` `usage_meta_tests::hg2_token_freeze_grader_usage_update_wire`):
   fixed snapshot + transcript → exact `sessionTotalTokens` / `totalTokens` /
   `completionTokens` / estimated user·other context fields on the usage wire.
2. **Latency freeze grader** (`aster-pager`
   `hg2_estimate_line_widths_latency_freeze`): fixed 200-line prompt × 100
   estimate passes → exact width digest `[10; 200]` and wall clock `< 2s`.
3. Adjacent TUI borrow knife: `Subagent` / `Btw` / `SessionEvent` estimate arms
   avoid `searchable_text` join clones (`estimate_line_widths_borrows_subagent_btw_session`).

## Commands / counts

```text
cargo test --locked -p aster-acp --lib hg2_token_freeze_grader → 1 ok
cargo test --locked -p aster-pager --lib estimate_line_widths → 4 ok
  (incl. hg2_estimate_line_widths_latency_freeze · subagent_btw_session)
```

## Explicitly not claimed

- HG2 product Pass / named YOLO Done / Meta Harness Pass.
- Headed Studio / live LLM latency under production providers.
- That the 2s wall bound is a production SLO (hermetic CI freeze only).
