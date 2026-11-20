# T2026-11-17-slash-gate-init

Updated: 2026-11-17 · `/yolo` · aster slash-gate honesty for `/init` · ≠ Meta Done

## Change

`ASTER_EFFECTIVE_COMMANDS` now includes `init`.

`/init` is a pager-local `InjectSkill` (writes `AGENTS.md` via the active agent).
It was still visible after `apply_aster_slash_gate` but missing from the allowlist,
so `apply_aster_slash_gate_hides_unsupported_builtins` failed with:

```text
/init is visible under asterCode but not on ASTER_EFFECTIVE_COMMANDS
```

Test asserts `reg.get("init")` stays available under asterCode.

## Verification

```text
cargo test --locked -p aster-pager --lib apply_aster_slash_gate_hides_unsupported_builtins
→ 1 passed

cargo test --locked -p aster-pager --lib slash_gate
→ 4 passed

python3 scripts/verify-hermetic-perf-e2e.py --suite hg2_slash_gate_init
→ 1 suite / 1 passed
```

## Explicitly not claimed

- Meta Harness / headed daily-use Pass
- Studio H2 land
- Full slash catalog vs ACP advertise audit beyond this gate
