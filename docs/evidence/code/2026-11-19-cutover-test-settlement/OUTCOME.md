# T2026-11-19-cutover-test-settlement

Updated: 2026-11-19T08:57:31+08:00 · scope: settle the Core cutover blocker and independently exposed failures · **full Core lib passed** · **≠ product Pass**

## Result

The cutover wait was a test-evidence/synchronization defect, not a production deadlock. The generic `task` description no longer carries registry versions; the fixture returned an error before releasing `old_surface_observed`, leaving the waiter blocked. Version assertions remain at the actual response and child-Agent prompt surfaces. The formerly blocked test now settles in **0.82 seconds**.

The subsequent failures were isolated into seven concrete classes. Most were fixture-contract corrections; the question-cap defect required a production fix:

1. **Stale package identities** — five fixtures now use `package_binding_for_generation`, so each capability snapshot digest binds its package, generation, and Knowledge surface.
2. **Missing fixture admission** — plan, path-instruction, worktree, and deterministic-shell fixtures explicitly allow only their required `update_plan`, `read`, `git`, or `bash` calls. The path negative control now performs a real read rather than passing because no tool ran.
3. **Retired output projection** — affected assertions now read canonical `receipt.output` rather than the empty compatibility top-level `output`. No production output was duplicated or backfilled.
4. **Generic task-description drift** — cutover and worker-catalog fixtures assert live registry data in the response, child prompt, and agent schema rather than requiring registry versions in generic tool prose. Worker removal is checked in both schema description and examples.
5. **Pre-migration identity goldens** — commit `0935a85a6` changed public schema/digest domains from `a3s` to `aster` without updating UI and WorkPolicy goldens. The identities now match the current domains; asset bytes, policy content, and digest algorithms remain unchanged.
6. **Dead feature-gated code** — an orphan `RecordingExecutor` impl referenced a type and trait that no longer existed and had no callers. Removing that impl restored `deep-live` test compilation; no test was removed.
7. **Cross-Run question-cap bypass** — unnamespaced cap-check elicitation IDs collided across Runs, rolling back the question count. A new two-Run test failed before the fix. Production cap-check IDs are now Run-namespaced; the counterexample and associated suites pass.

A separate hook cutover race was also closed: blocking errors may return before guardian retirement, so the fixture now waits up to five seconds for the original Run to retire before starting the next send. Production error-return behavior was not changed.

No test was newly skipped or removed, and no acceptance assertion was weakened. The full suite's **33 existing ignored cases remain ignored**.

## Final full-Core verification

```bash
cargo test --locked -p aster-core --lib -- --test-threads=1 > artifacts/kbox-real-comparison/evidence/core-lib-serial-final-2026-11-19.log 2>&1
```

Observed result against the final frozen sources, with no parallel Cargo jobs:

- **5975 passed; 0 failed; 33 ignored; 0 filtered out; finished in 608.96s**.
- This is a completed `aster-core --lib` result, not a focused-filter or zero-match success.

Earlier red/partial runs are retained only as diagnostics: `core-lib-serial-prefinal-failures-2026-11-19.log`, `core-lib-serial-second-five-failures-2026-11-19.log`, `core-lib-serial-third-parallel-timing-2026-11-19.log`, and `core-lib-serial-fourth-mcp-timing-2026-11-19.log`. The second complete sweep had 5970 passed / 5 failed; those five were fixed before the final run.

## Focused and associated verification

- Cutover test `active_run_keeps_n_agent_registry_task_binding_and_use_lease_across_cutover`: **1/1, 0.82s**.
- Complete capability-runtime suite after the retirement-boundary fix: **74/74**.
- Prior associated regressions: agent_projection **2/2**, access_projection **4/4**, direct governed **9/9**.
- Context binding: **1/1**; detached pinned package/control identity: **1/1**.
- Plan snapshot and resume: **1/1**; live worker catalog: **1/1**.
- Complete long-horizon module: **18/18** serially, including real edit/suite runs, crash/resume, failed-read budgets, canonical receipts, and final-text settlement.
- Path instructions: **3/3**; worktree creation and settlement cleanup: **1/1**.
- Capability projection and UI golden identity: **1/1 each**.
- Run tests: **56 passed / 2 ignored**.
- FactControl: **59/59**; agent fact_log: **87/87**; ask_user: **8/8**; WorkPolicy: **8/8**.
- `cargo test --locked -p aster-core --features deep-live --lib opcov_package_current`: **1/1**. Two earlier default-feature filters matched 0 tests and are not counted as verification.
- Final Core Clippy `--all-targets --no-deps`: **exit 0** (`cutover-clippy-final-2026-11-19.log`), with existing warnings retained; this is not a warning-free claim.
- Final paired Aster + ACP build: **exit 0** (`cutover-build-final-2026-11-19.log`).
- `git diff --check -- crates/code/core/src`: **exit 0**.

## Format limitation

`cargo fmt --all` was run and the pre-existing `terminal_bench_runner.rs` edits were restored byte-for-byte from `terminal_bench_runner.pre-cargo-fmt.rs`; `cmp` confirms the restoration. The final `cargo fmt --all -- --check` remains **exit 1 only for that preserved file** (`cutover-fmt-final-2026-11-19.log`). No `crates/code/core/src` file is implicated by that check, and `git diff --check` passes. This is not reported as a workspace formatting pass.

## Explicitly not claimed

- The Core lib suite is green, but this is **not whole-product Pass, Meta Harness completion, release approval, or a live-provider SLO**.
- No real model was called and no kbox copy was created for this deterministic settlement. Previously recorded real-model latency/token results were not rerun or rewritten.
- No commit, push, branch, worktree, stash, release, or Windows native check was performed. A worktree created inside a temporary fixture by the settlement test was removed by that test; this is not a repository worktree operation.
- Environment: macOS arm64 (`aarch64-apple-darwin`), Rust 1.97.1. Deterministic USD/token cost is unavailable.
