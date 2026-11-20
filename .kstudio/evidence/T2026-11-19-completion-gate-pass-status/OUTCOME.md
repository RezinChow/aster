# T2026-11-19-completion-gate-pass-status

Updated: 2026-11-19T13:50:24+08:00 · scope: completion attestation / effect-digest binding · **overall report must be Passed** · **≠ Meta Harness Done**

## Result

The completion gate accepted an inconsistent host report when its effect digest matched and every required check was `Passed`, even if the report's overall status was `Skipped`. The old predicate rejected only `Failed` and `NeedsReview`.

`report_binds_pass` now requires all three conditions: the exact mutation effect digest, at least one required check with every required check `Passed`, and overall `report.status == VerificationStatus::Passed`. The `CompletionAttestor` contract documentation states the same boundary. `read_only_verifier::accept_report` remains an author-admission filter; the central completion gate makes the final proof decision.

The new `skipped_report_is_not_a_pass` counterexample uses a matching digest and a passed required check but an overall `Skipped` status. Before the fix, `decide_completion` returned `Allow(Verified)`; after the fix it returns `Incomplete`. No assertion was weakened.

## Verification

- New counterexample: **red before / green after**, focused result **1/1**.
- `harness_loop`: **89/89**; `completion_attestor`: **18/18**; `read_only_verifier`: **5/5**.
- Deterministic ACP/TUI suites: **70 passed / 0 failed / 1 ignored / 235.32s** (`deterministic-summary-rerun.json`).
- Final serial Core: **5982 passed / 0 failed / 33 ignored / 616.74s** (`core-lib-serial.log`).
- Core Clippy all targets: **exit 0** (`core-clippy.log`); ACP Clippy all targets: **exit 0** (`acp-clippy.log`). Existing warnings are not claimed as cleaned.
- Final paired build: **exit 0**; both binaries report `aster-cli-pair-v1:27e4777d7cdc3b811b04e1733b0f93c3842f6245:aarch64-apple-darwin`.
- `git diff --check`: **exit 0** for Core/ACP sources, ACP tests, and the verification artifacts.

The first TUI attempt was **69 passed / 1 failed / 1 ignored**. A documentation-only edit after the paired build caused the next ACP test build to advance only one side of the pair, so `shipped_binaries_report_current_version` observed different BUILD_IDs. The failed summary and logs are retained. Rebuilding Aster and ACP together and rerunning all three suites produced the accepted 70/0/1 result; the test was not changed.

`cargo fmt --all` was run and the existing `terminal_bench_runner.rs` edits were restored byte-for-byte. Final `cargo fmt --all -- --check` remains **exit 1 only for that pre-existing file** (`fmt-check.log`); no Core/ACP source or ACP test formatting difference was reported.

## Explicitly not claimed

- No real model was run for this completion-gate slice. The deterministic host-report counterexample establishes gate behavior, not provider behavior or a release SLO.
- No Windows native check, commit, push, branch, worktree, install, release, or external workspace edit was performed. USD/token cost is unavailable.
- This closes the named completion-proof slice, not the overall Meta Harness goal. Studio synchronization and daily-use release evidence remain outside this slice.
