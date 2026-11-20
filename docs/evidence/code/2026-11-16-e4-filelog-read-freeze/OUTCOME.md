# E4 — `FileLog::read_freeze` on settlement hot paths

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Named YOLO: core/acp/tui 极致优化.

## Change

1. `aster-effect`: `FileLog::read_freeze` returns `(facts, LogFreeze)` in one open;
   `freeze` reuses it.
2. Core `append_turn_complete_fact` and background child settle use `read_freeze`,
   recording `log_byte_len` / `child_log_byte_len` beside the existing cut shape
   (TranscriptSourceCut stays `{seq,digest}`).

## Verification

```text
cargo test --locked -p aster-effect --lib log_cut_or_freeze_exposes_committed_byte_len → ok
cargo test --locked -p aster-core --lib 'agent_api::tests::background_subagent' → 5 passed
cargo clippy --locked -p aster-effect --all-targets --no-deps → Finished (no new errors)
```

## Explicitly not claimed

- Product Pass / named YOLO Done / full E4 catalog Done (other tools may still omit budgets).
- `the_run_receives_background_output_and_settles_the_task` (WC-BG1 twin) — observed fail
  on marker fact; path does not use `read_freeze`; treated as separate residual, not as
  freeze acceptance.
