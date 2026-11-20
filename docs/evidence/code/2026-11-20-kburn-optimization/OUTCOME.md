# T2026-11-20-kburn-optimization

Updated: 2026-11-20T11:02:00+08:00 · scope: named YOLO slice = KBurn optimization P0–P2 · **mechanism slice verified; clean A/B and product Pass not claimed** · **≠ Meta Harness Done**

## Changes in this slice

- Added a KBurn settlement-stall guard in the Terminal-Bench adapter. Six canonical completion-gate diagnostics are classified; one observation per stream attempt; the second identical observation stops the run with `reward_valid=false`. Unrelated errors are not classified and do not trigger the stop.
- Added machine-readable `reward_valid` to the adapter result JSON. A stopped run is now explicitly marked invalid for reward comparisons.
- Host-driven `drive_running_loop` now runs before every non-terminal, non-finish settlement nudge, not only the `RetryNonTerminal` branch. A successful advance resets the stall tracker; `Finish` and `SameDigestStillOpen` stay fail-closed. Semantic review and `task_accepted` remain model work.
- Extended the KBurn priority prompt with an explicit `Skill("loop")` bootstrap: write `<task-id>.spec.json`, start the controller, and confirm `status=running` before product writes; never use the controller state filename for a spec; only declared checks with covering `paths` can accept product files; `task_accepted` needs a real review receipt and current source hashes.
- Added a prompt regression assertion for the bootstrap contract.

Files touched by this slice (all were already modified or untracked in the dirty working tree before this slice; unrelated existing work was preserved):

- `crates/code/core/examples/terminal_bench_runner/kburn.rs`
- `crates/code/core/examples/terminal_bench_runner/result.rs`
- `crates/code/core/examples/terminal_bench_runner.rs`
- `crates/code/core/prompts/common/kburn_catalog_header.md`
- `crates/code/core/src/context/skill_catalog_provider.rs`

## Commands and counts

All Rust commands used `CARGO_TARGET_DIR=/tmp/aster-kburn-opt-target CARGO_INCREMENTAL=0`; the default `target/` was not used.

| Command | Result |
| --- | --- |
| `cargo test --locked -p aster-core --lib kburn -- --nocapture` | **12 passed / 0 failed / 0 ignored / 6015 filtered** |
| `cargo test --locked -p aster-core --lib kstudio::tests -- --nocapture` | **24 passed / 0 failed / 0 ignored / 6003 filtered** |
| `cargo test --locked -p aster-core --example terminal_bench_runner -- --nocapture` | **34 passed / 0 failed / 0 ignored** after adding the hermetic result-file test |
| `cargo clippy --locked -p aster-core --all-targets --no-deps` | **exit 0** with pre-existing warnings |
| `rustfmt --edition 2024 --check` on the changed Rust files | **exit 0** |
| `git diff --check` on the changed files | **exit 0** |
| `cargo fmt --all -- --check` | **exit 1** on pre-existing ACP test formatting diffs (`attempt_tests.rs`, `commands.rs`, `count_limit_tests.rs`, `emit_tests.rs`, `engineering_tests.rs`, …). Targeted rustfmt check showed no formatting diff for files in this slice. |

Clippy warnings already present in the touched runner include `manual_pattern_char_comparison` (line 250), `ptr_arg` (line 326), and `too_many_arguments` (line 444); none were introduced to obtain a green result and none were changed in this slice.

### Broader checks

| Command | Result |
| --- | --- |
| `cargo test --locked -p aster-core --lib -- --test-threads=1` | **5981 passed / 13 failed / 33 ignored / 689.59s** — the 13 failures are sandbox/native-execution tests with `sandbox-exec: sandbox_apply: Operation not permitted` or missing `setsid` descendants; none touch files changed in this slice |
| `cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp` in an isolated target | **exit 0**; both binaries report `aster-cli-pair-v1:f2924bf8ba24796d1219cc25fa584ca03dbdd038:aarch64-apple-darwin` |
| `cargo test --locked -p aster-acp --test tui_913_hermetic -- --nocapture` | **12 passed / 3 failed / 125.08s**. All four KBurn-specific cases passed: `.aster` auto-arm + natural-language `Skill`, legacy `.kstudio` no auto-arm, `kburn=false`, explicit `kburn=true`. The three failures are `shipped_binaries_report_current_version` (default-target binary ID `2e23c3…` vs isolated-build ID `f2924b…`), `three_turns_fix_the_bug_they_diagnosed` and `long_task_repairs_the_check_after_a_failure` (mock harness timeout / `tool_refusal_cycle` in this environment), none KBurn-specific. |

The full-suite failures are recorded as environmental/pre-existing and are not represented as fixed. The paired BUILD_ID is for this dirty source tree; it is not compared with the clean baseline identity from earlier evidence.

### Hard baseline proof for the 13 failures

- `/usr/bin/sandbox-exec -p '(version 1) (allow default)' /bin/echo sandbox-ok` → `sandbox-exec: sandbox_apply: Operation not permitted`, exit 71. Even an allow-all profile cannot be applied in this host environment. The same probe with the tool sandbox disabled also returned 71, so disabling the agent sandbox does not unlock it.
- Exported `HEAD` with `git archive` into `/tmp/aster-head-baseline` (no worktree, no changes to the current checkout), copied only `apps/studio` submodule files needed for workspace parsing, and reran the same 13 exact tests from that clean source with `CARGO_TARGET_DIR=/tmp/aster-head-baseline-target`. **All 13 failed identically**, with the same `Operation not permitted` / missing `setsid` readiness messages. This proves the failures are baseline/environmental, not introduced by this slice.
- Fixing them would require weakening or bypassing the sandbox contract, which is explicitly out of scope and prohibited by the repository rules. No test or gate was weakened.

### Hermetic E2E correction

- Added a hermetic result-file test for P0: `settlement_stall_writes_an_invalid_reward_result` drives the same `settlement_stall` helper used by the runner, persists the report through `persist_result`, and asserts `reward_valid=false`, `outcome=failed`, and the stop diagnostic in `lastError`. The runner example suite is now **34/34**.
- The earlier `tui_913_hermetic` BUILD_ID failure was caused by pointing the test at stale default-target binaries while the test itself was built in an isolated target. Rerunning with `ASTER_TUI_BIN` and `ASTER_ACP_BIN` set to the freshly paired binaries from `/tmp/aster-kburn-pair-target/debug/` changed the result from **12/15** to **13/15**.
- All four KBurn-specific E2E cases pass in that run: `.aster` auto-arm with natural-language `Skill`, legacy `.kstudio` no auto-arm, `kburn=false`, explicit `kburn=true`.
- The remaining two failures are `three_turns_fix_the_bug_they_diagnosed` and `long_task_repairs_the_check_after_a_failure`: both timed out after the mock model's `bash` calls were refused by the same unavailable host sandbox (`tool_refusal_cycle` / `history-missing`). Rerunning each with `--test-threads=1 --exact` still failed (91.26s and 120.35s), so this is not a concurrency artifact. No code change in this slice can make `sandbox-exec` work here.

Failed full-suite tests: `agent_api::session_sandbox::tests::default_native_adapter_executes_via_ksandbox`, `agent_api::session_sandbox::tests::installed_default_sandbox_enforces_workspace_and_aster_boundary`, `agent_api::tests::session_construction::test_local_session_installs_native_sandbox_by_default`, `sandbox::native::lifetime_tests::both_native_apis_execute_uniformly`, `sandbox::native::tests::probe_and_exec_run_inside_ksandbox`, `tools::builtin::background::tests::escape::foreground::native_foreground_completion_contains_a_setsid_descendant`, `tools::builtin::background::tests::escape::native_run_settlement_contains_a_setsid_descendant`, `tools::builtin::background::tests::native_background_denies_outside_and_control_metadata_writes`, `tools::builtin::background::tests::native_background_denies_ungranted_network_egress`, `tools::builtin::background::tests::native_macos_background_runs_under_ksandbox`, `tools::builtin::bash::tests::macos_native_ksandbox_executes_workspace_writes`, `tools::builtin::bash::tests::sandboxed_readonly_git_does_not_take_a_parallel_commit`, `tools::builtin::bash::tests::sandboxed_readonly_git_without_local_write_ignores_parallel_commit`.

## One failed intermediate check

The first `kburn` filtered run had **11 passed / 1 failed**: `context::skill_catalog_provider::tests::kburn_skills_add_a_bounded_priority_hint` expected the prompt phrase `before generic planning or orchestration tools`, which the untracked prompt file did not contain. The prompt was amended to state that phrase explicitly, the bootstrap assertion was added, and the final rerun was **12/12**.

## Parked / not run

- **P3 clean A/B**: no real provider call, no Terminal-Bench run, no factory-seed image check, no k=3 off/on repetition. This needs explicit authorization for provider spend. No reward, verifier, or efficiency result is claimed for the optimized candidate.
- **P1 full PTY matrix**: the 10/10 PTY bootstrap acceptance was not executed. `tui_913_hermetic` ran twice: 12/15 with a stale-binary BUILD_ID mismatch, then **13/15** with fresh paired binaries; all 4 KBurn-specific cases pass. The remaining 2 long-task cases are blocked by the same host sandbox limitation. That is not a full 10/10 matrix.
- **P4 land checks**: Core lib full serial regression ran with 13 environmental sandbox failures; no ACP full regression, commit, push, branch, worktree, install, or release. Paired build and BUILD_ID verification were completed in an isolated target.
- No Studio synchronization, Windows native check, daily-use evidence, or product Pass was attempted.

## Explicitly not claimed

- No KBurn performance or task-success improvement. The earlier 5/5 continuation-with-overlay result remains invalid as general evidence.
- No Meta Harness Done. Near-term hard goals and green checks are not Pass; `%≠Pass`.
- No USD cost figure; token counts in earlier evidence were cumulative provider-reported usage, not billing.
- No commit or push. Submission requires separate authorization.
