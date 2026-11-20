# T2026-11-17-c1-verify-stub-fail-closed

Updated: 2026-11-17 · C1 honesty knife · stub `verify_*` fail-closed · ≠ C1 Pass · ≠ Meta Done

## Change

`aster-confine` compatibility stub no longer reports green `verify_*` success:

- `verify_hook_write_deny_enforced` / `verify_read_deny_enforced` / `verify_data_write_deny_enforced` → `Err(STUB_NOT_ENFORCEMENT)`
- `is_enforcement_authority() -> false`
- Module docs updated: green check ≠ enforcement
- Shell startup still safe: stub `requires_*` remain `false`, so existing verify call sites stay unreachable
- Shell emits a one-line `note:` when a non-`off` profile is requested on the stub (does not claim enforcement)

## Verification

```text
cargo test --locked -p aster-confine --lib
→ 2 passed (authority + verify fail-closed)
cargo fmt -p aster-confine
→ ok
python3 scripts/verify-hermetic-perf-e2e.py --suite hg2_c1_confine_verify_stub
→ 1/1
```

## Explicitly not claimed

- C1 closed as OS enforcement (still intentional non-authority stub; real isolation = Core/ksandbox)
- Shell/UI no longer surfaces configured profile names
- Meta Harness Done / daily-use Pass
