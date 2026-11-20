# T2026-11-17-appview-280-slash-tip

Updated: 2026-11-17 · `/yolo` · aster-pager `app_view` full green after slash-gate `/init` + tip harden · ≠ Meta Done

## Change

1. `ASTER_EFFECTIVE_COMMANDS` includes `init` (see `T2026-11-17-slash-gate-init`).
2. `word_select_tip_retires_on_prompt_divergence_and_accepts_before` now asserts typing reaches the prompt and diverges the snapshot before the retire tick (closes a prior alone-run failure mode).

## Verification

```text
cargo test --locked -p aster-pager --lib apply_aster_slash_gate_hides_unsupported_builtins
→ 1 passed

cargo test --locked -p aster-pager --lib word_select_tip_retires_on_prompt_divergence_and_accepts_before
→ 1 passed (×3 consecutive)

cargo test --locked -p aster-pager --lib app_view
→ 280 passed; 0 failed
```

## Explicitly not claimed

- Meta Harness / headed Pass
- Studio H2 land
- Root-caused every prior flake beyond the added divergence asserts
