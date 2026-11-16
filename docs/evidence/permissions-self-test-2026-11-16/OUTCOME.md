# permissions-self-test-2026-11-16 (P0-1)

## Task

Absorb Codex-style rule self-tests into Aster permissions: embedded `match` / `not_match` examples reject bad policies at load. Wiki DoD: `.kstudio/wiki/Codex-Aster-Absorption.md` §P0-1.

## DoD checklist

| # | Criterion | Result |
| --- | --- | --- |
| 1 | ≥1 sample policy with must-match / must-not-match | `crates/code/core/src/permissions/fixtures/policy_self_test.example.json` |
| 2 | Bad `not_match` → load/validate non-zero exit | example binary exit **2** (see below) |
| 3 | Hermetic tests cover allow/ask/deny merge | `permissions::self_test_examples_tests` 5 passed |
| 4 | This OUTCOME records commands + exit codes | yes |

## Commands and results

Branch: `main` · machine: local `/Users/roylin/code/aster`

```bash
cargo test --locked -p aster-core --lib permissions::self_test_examples_tests -- --nocapture
# exit 0
# test result: ok. 5 passed; 0 failed; …

cargo run --locked -p aster-core --example permission_policy_self_test -- \
  crates/code/core/src/permissions/fixtures/policy_self_test.example.json
# exit 0
# ok: …/policy_self_test.example.json

cargo run --locked -p aster-core --example permission_policy_self_test -- \
  crates/code/core/src/permissions/fixtures/policy_self_test.bad_not_match.json
# exit 2
# error: json: rule `Bash(git status:*)` not_match[0] unexpectedly matches …

cargo clippy --locked -p aster-core --lib --examples --no-deps -- -A warnings
# exit 0
```

## Code landing

- `crates/code/core/src/permissions/rule.rs` — `RuleMatchExample`, `match`/`not_match`, `validate_examples`
- `crates/code/core/src/permissions/policy.rs` — `validate_rule_examples` on deserialize
- `crates/code/core/src/permissions/self_test_examples_tests.rs`
- `crates/code/core/examples/permission_policy_self_test.rs` (exit 0 ok / 2 validate fail / 1 usage)

## Explicitly not claimed

- Product Pass / daily-stable use
- Codex feature parity or Starlark execpolicy DSL
- P0-2+ mechanisms
- Studio / unrelated surfaces
- Full `cargo test --workspace` green
