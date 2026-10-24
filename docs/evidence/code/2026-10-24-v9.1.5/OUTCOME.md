# Aster CLI 0.1.3 / Core and ACP 9.1.5

The user authorized the existing paired Aster CLI/ACP release channel. Rust SDK packages remain local and non-publishable. This source was prepared in an isolated worktree from bfdfb797de3dc373025c5469dded57be2acb0e91. Primary-worktree Studio, Gateway, Office and terminal feature changes are excluded. Three existing Gateway formatting errors are corrected as whitespace-only changes so the workspace format gate can run; no Gateway behavior is changed.

Current checks: 84 confirmation-related Core tests passed, including four original SDK scenarios (cancelled, approved, rejected, and unconfirmed host cleanup), receiver abandonment and consent identity conversion. The latter two checks are included through explicit test filters. Both isolated CLI/ACP packages pass locked offline checking; dependency boundary 6, paired installer/rollback 10 and static guest-linker 2 tests pass. Whole-workspace and scoped formatting checks pass. `checks.json` and the retained logs record the completed scope.

Commands: `cargo test --locked --offline -p a3s-code-core --lib -- confirmation approval_identity_tests an_abandoned_receiver_cannot_accept_or_publish_a_late_approval --nocapture --test-threads=1`; `cargo check --locked --offline -p aster -p a3s-code-acp`; `cargo fmt --all -- --check`; `python3.13 tests/workspace_dependencies.py`; `python3.13 tests/cli_pair_delivery.py`; `python3.13 tests/musl_linker_flags.py`.

An isolated paired candidate, actual ACP/conformance and compiler-VM qualification, four platform archives, and final publication are still pending. The workflow assembles a draft bound to its actual build commit; a later check publishes only the qualified release.

## Explicitly not claimed

The architecture goal remains active. Arbitrary unreturned store/export callbacks retain their original owner; their cancellation/settlement contract is unfinished. Crash/recovery faults, changed-argument or model-derived-output loops, complete 130-case coverage, GUI/multi-platform runtime/soak qualification and real-model Terminal Bench speed/token improvements are not proved. Current tests use controlled models and synthetic usage. No public release has been made at this checkpoint.
