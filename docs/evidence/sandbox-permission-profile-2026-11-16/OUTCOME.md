# sandbox-permission-profile-2026-11-16 (P0-3)

## Task

Add a single `PermissionProfile` intersection API and stable sandbox violation codes to `aster-core`, and declare the `aster-confine` stub a non-authority. ksandbox stays the only execution backend. Wiki DoD: `.kstudio/wiki/Codex-Aster-Absorption.md` §P0-3.

## Contract

- `crates/code/core/src/sandbox/permission_profile.rs`
  - `PermissionProfile { network: SandboxNetworkMode, network_allow: Vec<NetworkGrant> }`, private fields. `Deny` carries no grants; `Mediated` needs at least one (`PermissionProfile::new` refuses otherwise).
  - `intersect_permission_profiles(&[..])`: result ⊆ every input. Any `Deny` → `Deny` with no grants. All-`Mediated` → allowlist intersection (exact host; a port pin narrows an unpinned grant; different pins drop). Empty input or empty result → `ProfileIntersectError` (closed set); the caller refuses, no wider fallback.
  - `intersect_profile_with_request(base, request)` = request ∩ base.
  - Codes (`violation_code::*`, `SandboxViolationCode`): `sandbox.violation.filesystem_denied`, `network_denied`, `lifetime_unqualified`, `profile_intersect_refused`.
  - Typed `SandboxViolation` (carried in `anyhow::Error`); `violation_code_of` finds it through context. A backend returning it asserts the command did not start.
- `bash` tool: a pre-spawn refusal carrying a code sets `metadata.sandbox_violation.code` (`command_started: false`, `ToolErrorKind::Unsupported`). `NativeProcessLifetimeUnqualified` maps to `lifetime_unqualified`. Message text alone never yields a code.
- Docs: `crates/code/core/src/sandbox.rs` module docs and `crates/terminal/crates/codegen/aster-confine/src/lib.rs` + `Cargo.toml` description state the confine crate is an API-compat stub, not execution authority, and name ksandbox as the backend.

## DoD checklist

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Single intersect API, fail-closed | `sandbox::permission_profile::tests::{disjoint_mediated_allowlists_refuse_instead_of_opening_network, empty_input_is_refused, host_matching_is_exact_with_no_aliasing, request_wider_than_base_is_narrowed_or_refused}` |
| 2 | Stable codes in tool metadata | `bash::tests::{typed_sandbox_violation_sets_a_stable_code_without_starting_the_command, typed_pre_spawn_lifetime_refusal_settles_as_a_tool_failure}` |
| 3 | Hermetic deny / refuse tests | 10 `permission_profile` tests + 3 bash tests, no platform sandbox needed |
| 4 | Confine stub non-authority | docs above |
| 5 | This OUTCOME | yes |
| 6 | `.kstudio` pointer, Tasks.md, wiki §P0-3 | updated |

## Commands and results

Branch `main` · mac-dev `/Users/roylin/code/aster` · darwin, toolchain from `rust-toolchain.toml`

```bash
cargo test --locked -p aster-core --lib sandbox::permission_profile
# exit 0 · 10 passed; 0 failed
cargo test --locked -p aster-core --lib tools::builtin::bash::tests::typed_
# exit 0 · 2 passed; 0 failed
cargo test --locked -p aster-core --lib tools::builtin::bash::tests::violation_code
# exit 0 · 1 passed; 0 failed
cargo test --locked -p aster-core --lib tools::builtin::bash::tests
# exit 0 · 77 passed; 0 failed; 1 ignored
cargo clippy --locked -p aster-core --lib --no-deps -- -A warnings
# exit 0
cargo clippy --locked -p aster-core --lib --tests --no-deps
# exit 0 · no warning in permission_profile.rs / sandbox.rs; existing warnings in bash/windows_shell.rs and bash/tests.rs (outside the lines added here)
cargo clippy --locked -p aster-confine --no-deps
# exit 0
rustfmt --check --edition 2021 crates/code/core/src/sandbox/permission_profile.rs crates/code/core/src/sandbox/permission_profile/tests.rs
# exit 0
git diff --check -- crates/code/core crates/terminal
# exit 0
```

## Explicitly not claimed

- Product Pass / daily-stable use
- That ksandbox itself reports filesystem or network denials with these codes: `filesystem_denied` and `network_denied` exist and are tested through a mock backend, but the native ksandbox adapter does not yet return a typed `SandboxViolation` for them. The existing stderr-based `sandbox_failure_hint` is unchanged and is not a code source.
- Violations that happen after the process starts (exit-code denials) carry no code
- Wiring `intersect_*` into session/ACP network-grant application (API only; `apply_network_grant` unchanged)
- Effect-log / ACP wire propagation of the code beyond tool-result metadata
- Filesystem fields in `PermissionProfile` (network authority only)
- Linux / Windows runs; native macOS ksandbox end-to-end deny
- `cargo test --workspace`; repo-wide `cargo fmt --all -- --check` (pre-existing diffs outside this change)
- Reviving `aster-confine` enforcement, MicroVM/kbox, or a Codex bwrap binary (none added)
