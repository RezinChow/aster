# Review: staged read-only synthesis

Date: 2026-11-18 · scope: current local changes for production FactRun staged synthesis · source snapshot: uncommitted `bootstrap` checkout.

## Findings and corrections

1. **Initial production bypass** — the first soft-synthesis implementation lived only in the compatibility AgentLoop. Corrected by admitting intent in `fact_publish_plan`, applying the staged directive in `LiveCompletion::complete`, and observing tool responses on the same production path.
2. **Planning mode was incorrectly treated as intent** — an explicit planning-enabled coding task could have been capped. Corrected: Enabled now obtains structured intent when the policy is configured; GeneralPurpose never admits the gate. The regression test covers both Disabled and Enabled.
3. **Host role precedence** — explicit `prompt_slots.style` now wins over inferred intent. No prompt-style rewrite or permission change was introduced.
4. **Recovery boundary** — intent, wave count, Pending/Spent, and the finalization bit are serialized with defaults and restored before FactRun resume. Older checkpoints without intent fail closed to no staged gate.

No unresolved material source finding remains in the reviewed slice. This is not a whole-product Pass.

## Actual verification

- `cargo test --locked -p aster-core --lib agent_api::tests::read_only_delivery` — **4 passed / 0 failed**. Covers real AgentSession / file reads, production tool removal after the gap wave, GeneralPurpose in Disabled+Enabled, native task delegation, and checkpoint state restore.
- `cargo test --locked -p aster-core --lib agent::tests::no_count_limit` — **9 passed / 0 failed**.
- `cargo test --locked -p aster-core --lib planning::` — **57 passed / 0 failed**.
- `cargo test --locked -p aster-core --lib pre_analysis` — **11 passed / 0 failed**, including disabled-without-policy and cancellation behavior.
- `cargo test --locked -p aster-core --lib agent_api::tests::stream` — **19 passed / 0 failed**.
- `cargo test --locked -p aster-core --lib fact_control::no_count_limit` — **1 passed / 0 failed**.
- `cargo test --locked -p aster-acp --lib interactive_count_is_unbounded_without_an_explicit_limit_for_every_effort` — **1 passed / 0 failed**.
- `cargo test --locked -p aster-acp --lib interactive_explicit_acl_count_wins_over_every_effort_including_zero` — **1 passed / 0 failed**.
- `cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp` — **exit 0**.
- `cargo clippy --locked -p aster-core --all-targets --no-deps` and the ACP equivalent — **exit 0**, existing warnings retained.
- `python3 .kstudio/workflow/sync-k-skills.py --check` — **OK**.
- `python3 .kstudio/workflow/verify-ai-eng.py --level L3` — **PASS**; control-plane conformance only.
- `git diff --check -- crates/code/core/src crates/code/acp/src` — **exit 0**.
- `cargo fmt --all -- --check` — **exit 1** only for the pre-existing `examples/terminal_bench_runner.rs`; no current `core/src` difference remains. An attempted direct rustfmt recursively touched submodules; the standard workspace formatter restored those incidental changes while preserving the existing Terminal Bench file byte-for-byte.

## Evidence limits

- `python3 .kstudio/workflow/review.py` could not collect a receipt: `cannot fingerprint changed directory/submodule: apps/studio` (exit 2). The two configured checks were run directly instead; their actual results are above.
- Live original-kbox TUI comparison completed: first settled substantive answer **272.282 s**, 5 model waves / 12 executions, 126.7k cumulative display tokens; both synthesis directives are present and the final call offered zero tools. This is one observed slice, not a general SLO or independent answer-quality proof.
- Same-pair real `HI`: settled answer **19.400 s**, 0 tools, 8.7k cumulative display tokens; no hang, but no subsecond claim.
- Broad `agent_api::tests::fact_log`: **82 passed / 5 failed**; each failure was reproduced individually. These cases do not enable the new policy. They remain current-worktree product debt and were not hidden or attributed to a clean HEAD without isolation.
- No commit, push, install, branch/worktree, kbox copy, Windows native check, or release is claimed.
- Verification cost in USD/tokens: unavailable for the scripted checks; live TUI token display is recorded separately without treating it as exact billing.
