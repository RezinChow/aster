# E5 — concurrent `session/load` exclusive begin

Date: 2026-11-16.  
Branch: `main`.  
Goal knife: Meta Harness **可信** (defect catalog E5) + E2E stability.

## Change

`InflightSessionLoads::begin` returns `Result` — a second concurrent begin for
the same session id fails closed. `load_session` maps that to
`invalid_params` / `session load already in progress` instead of running a
parallel unguarded load behind an empty no-op guard.

## Verification

```text
cargo test --locked -p aster-acp --lib concurrent_begin_for_same_session_fails_closed
→ ok
```

## Explicitly not claimed

- Product Pass / Meta Harness Done.
- Studio H2 land/push.
- Soft 20s `wait` timeout rewrite for `/session-info`.
