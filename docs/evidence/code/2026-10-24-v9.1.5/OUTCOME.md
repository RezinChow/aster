# Aster CLI 0.1.3 / Core and ACP 9.1.5

The user authorized the existing paired Aster CLI/ACP release channel. Rust SDK packages remain local and non-publishable. This source was prepared in an isolated worktree from bfdfb797de3dc373025c5469dded57be2acb0e91. Primary-worktree Studio, Gateway, Office and terminal feature changes are excluded. Three existing Gateway formatting errors are corrected as whitespace-only changes so the workspace format gate can run; no Gateway behavior is changed.

Current checks: 84 confirmation-related Core tests passed, including four original SDK scenarios (cancelled, approved, rejected, and unconfirmed host cleanup), receiver abandonment and consent identity conversion. The latter two checks are included through explicit test filters. Both isolated CLI/ACP packages pass locked offline checking; dependency boundary 6, paired installer/rollback 10 and static guest-linker 2 tests pass. Whole-workspace and scoped formatting checks pass. `checks.json` and the retained logs record the completed scope.

Commands: `cargo test --locked --offline -p a3s-code-core --lib -- confirmation approval_identity_tests an_abandoned_receiver_cannot_accept_or_publish_a_late_approval --nocapture --test-threads=1`; `cargo check --locked --offline -p aster -p a3s-code-acp`; `cargo fmt --all -- --check`; `python3.13 tests/workspace_dependencies.py`; `python3.13 tests/cli_pair_delivery.py`; `python3.13 tests/musl_linker_flags.py`.

The final isolated paired candidate passed actual ACP/conformance and compiler-VM qualification. Four platform archives and final publication are still pending. The workflow assembles a draft bound to its actual build commit; a later check publishes only the qualified release.

## Subsequent qualification

The isolated release source passed 741 relevant Core tests (two existing ignored), actual ACP20 (13 workflows plus7 auxiliary) and protocol10. Controlled H1 first failed before ACP launch because its owned artifact parent was absent; preparing that parent exposed a separate scripted-model assumption that the provider ID must remain `initial-check`. The model fixture now correlates the exact admitted command and its adjacent native result through their opaque IDs. Two positive/negative fixture tests pass. Production completion and verification gates are unchanged. A new paired build and actual qualification are required because the source identity includes fixture bytes.

The first four-platform CI run40092859072 stopped before compilation because its required private-Studio token was missing. A single-job macOS rerun confirmed this prerequisite. Dedicated deploy-key creation was refused by the repository policy; no deployment key was created or policy changed. The user requested automatic configuration and explicitly selected one-year validity for a restricted Studio-read token. Credential configuration and publication remain pending.

## Explicitly not claimed

The architecture goal remains active. Arbitrary unreturned store/export callbacks retain their original owner; their cancellation/settlement contract is unfinished. Crash/recovery faults, changed-argument or model-derived-output loops, complete 130-case coverage, GUI/multi-platform runtime/soak qualification and real-model Terminal Bench speed/token improvements are not proved. Current tests use controlled models and synthetic usage. No public release has been made at this checkpoint.

## Final local qualification and CI checkout correction

The final paired build `3c601c086ffef3b3e86a13c0f71d19b49abc3dae` passed actual ACP20 (13 product workflows plus7 auxiliary), protocol10 and controlled H1 with19 independent checks. The H1 workflow took34,453ms with8 tool calls and7 original approval requests; its18 synthetic tokens are not real billing. Binary, manifest, tester and compiled-source guards remained unchanged. Original Goal facts show6 created goals,10 admitted and10 settled slices,4 completed goals and2 intentionally stopped cases. No slice remains pending in that controlled cohort. `final-qualification.json` records the scope.

The user supplied a token; `STUDIO_READ_TOKEN` was saved and its GitHub metadata verified without persisting its value locally. New run40101228548 used source65ab9bb9 and passed Studio checkout on macOS, Linux and Windows. Kylin failed on original `fatal: detected dubious ownership`; the common resolver now grants per-command trust only to the explicit `GITHUB_WORKSPACE`. One hermetic test executes the original action shell, reproduces the failure, proves the exact workspace passes, rejects a different workspace and proves no global trust setting changes. The production Code input remains unchanged.

The supplied token currently has organization-wide code/metadata read-only access and was exposed in chat. Restriction to Studio and credential rotation remain required; no secret value is retained in these records. Four-platform release compilation and publication remain unfinished.
