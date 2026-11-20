# T2026-11-17-e4-update-plan-discarded

Updated: 2026-11-17 · E4 honesty · `update_plan` step truncation · ≠ E4 Pass · ≠ Meta Done

## Change

`update_plan` now reports step-label truncation in tool metadata:

- `discarded_chars` — total characters dropped across steps at `MAX_STEP_CHARS` (480)
- `step_char_budget` — the bound used
- Truncation behavior unchanged; only observability added

## Verification

```text
cargo test --locked -p aster-core --lib 'tools::builtin::update_plan::'
→ 9 passed (includes update_plan_reports_discarded_chars_when_steps_truncate)
cargo fmt -p aster-core
→ ok
```

## Explicitly not claimed

- E4 closed for every tool
- Meta Harness Done
- Live token/latency Pass
