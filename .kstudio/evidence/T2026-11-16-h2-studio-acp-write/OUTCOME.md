# H2 — Studio ACP write ≠ false process-exited

Date: 2026-11-16.  
Branch: Studio submodule dirty on `main` (not landed / not pushed).  
Goal knife: Meta Harness **可信** (defect catalog H2).

## Change

`AcpClient::write` no longer maps every stdin write/flush failure to
`agent.runtime.exited`:

- Fatal pipe kinds (`BrokenPipe` / reset / abort / not-connected) or a
  terminated child → `exit_message()` (unchanged).
- Otherwise → `agent.runtime.write_failed: …` without flipping `exited`.
- `AcpError::keeps_runtime` is true for `write_failed` so the turn does not
  discard a live runtime.

## Verification

```text
cargo check --locked -p aster-studio
→ Finished (lib)

Focused unit: `only_fatal_stdio_kinds_count_as_process_exit_signals` added;
`keeps_runtime` assertion for write_failed added.
```

Full `cargo test --lib` for aster-studio blocked here by missing include_str
fixtures (api vendor / use-registry / OCR evidence paths) — environmental,
not caused by this knife.

## Explicitly not claimed

- Product Pass / Meta Harness Done.
- Studio commit / push / parent gitlink land (needs explicit push auth +
  `just studio-land-check`).
- Retry/replay of failed ACP requests after write_failed.
