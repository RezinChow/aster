# T2026-11-18-staged-read-only-synthesis

Updated: 2026-11-18 · scope: production read-only analysis convergence · **deterministic + one live TUI slice verified** · **≠ Meta Harness Done**

## Causal gap

The earlier parallel scheduler worked, but the soft-synthesis policy lived only in the
compatibility AgentLoop. Real TUI sessions use FactRun / LiveCompletion, so the real
provider never entered that state machine. In addition, `--no-plan` suppressed the
structured pre-analysis needed to distinguish read-only analysis from coding work.

## Landed

1. `fact_publish_plan` binds structured `Plan` / `Explore` / `CodeReview` intent to the
   production run. `GeneralPurpose` and `Verification` do not admit the policy.
   Explicit host `prompt_slots.style` wins over inference. Planning Enabled uses
   structured intent too; planning mode is not treated as proof of read-only intent.
2. `--no-plan` still skips plan execution. When interactive staged synthesis is
   configured, it no longer suppresses the intent-only pre-analysis call. Sessions
   without that configured policy retain the old no-call behavior.
3. LiveCompletion counts model tool waves, not individual calls. After 2 waves it
   injects a synthesis request with tools retained. If the model requests a further
   wave, exactly one gap wave is admitted; the next call carries a finalization request
   and an empty tool list. A tool call returned despite that empty list is not executed.
4. Intent, wave count, Pending/Spent, and finalization-pending state enter loop
   checkpoints with backward-compatible defaults and are restored before FactRun resume.
5. Existing parallel dispatch, native explore delegation, mutation governance,
   `max_tool_rounds`, and zero-means-unlimited behavior remain independent.

## Real before/after evidence

Controls: original `/Users/roylin/code/kense/kbox`, no copy and no source modification;
`deepseek/deepseek-flash`; prompt `分析下 ./kbox 技术架构`; agent-desktop drove a fresh
Terminal using the newly built paired binaries. Aster 0.4.0 / ACP 9.3.0; BUILD_ID
`aster-cli-pair-v1:1bf6b848ad7b4c1a3fe943863e8406fbe6de9aff:aarch64-apple-darwin`.

| Version | First settled substantive answer | Tool activity | TUI cumulative token display |
| --- | --- | --- | --- |
| User baseline screenshot | None visible at 736 s | Not recoverable | 216.8k |
| Previous soft-only build | None at 600 s deadline | 13 execution groups / 15 calls | 247.4k |
| **Staged production build** | **272.282 s** | **5 model waves / 12 actual executions** | **126.7k** |

The 12 executions include one `program` wave's seven nested calls. The log proves
`directive=Synthesize tools_offered=26`, then one read, then
`directive=Finalize tools_offered=0`. The settled screen contains architecture paths,
remaining verification gaps, and an overall judgment; `Worked for 4m26s` agrees with
the driver measurement within display rounding.

Primary records:

- `artifacts/kbox-real-comparison/evidence/staged-summary.json`
- `artifacts/kbox-real-comparison/evidence/staged-history.txt`
- `artifacts/kbox-real-comparison/evidence/screens/staged-first-answer.png`
- `artifacts/kbox-real-comparison/logs/after-staged/aster-acp.20775.log`
- Driver: `artifacts/kbox-real-comparison/drive_staged.py`

This single live sample establishes that the mechanism executed and the previously
non-converging scenario now produced an answer. It is not a statistical speedup,
per-turn billing measurement, general SLO, or independent architecture-quality audit.
The token displays are session-cumulative and the observation windows differ.

## HI regression on the same pair

A separate real `HI` turn produced a settled answer in **19.400 s**, with **0 tool calls**
and 8.7k cumulative display tokens. The TUI's main-turn display was `Worked for 2.8s`;
the driver total includes the intent-analysis phase. Records are `evidence/hi-summary.json`,
`evidence/hi-history.txt`, `evidence/screens/hi-answer.png`, and `logs/hi-latest/`.
This establishes no hang on the original simple-input scenario, not a subsecond SLO.

## Verification

- `cargo test --locked -p aster-core --lib agent_api::tests::read_only_delivery` — **4 passed / 0 failed**: real AgentSession/file tools, one gap then tools-off finalization, GeneralPurpose under Disabled+Enabled, checkpoint restore, and native task delegation.
- `cargo test --locked -p aster-core --lib agent::tests::no_count_limit` — **9 passed / 0 failed**.
- `cargo test --locked -p aster-core --lib planning::` — **57 passed / 0 failed**.
- `cargo test --locked -p aster-core --lib pre_analysis` — **11 passed / 0 failed**.
- `cargo test --locked -p aster-core --lib agent_api::tests::stream` — **19 passed / 0 failed**.
- `cargo test --locked -p aster-core --lib fact_control::no_count_limit` — **1 passed / 0 failed**.
- ACP interactive count-limit tests — **1 + 1 passed / 0 failed**.
- `cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp` — **exit 0**.
- Core and ACP `cargo clippy --locked ... --all-targets --no-deps` — **exit 0**.
- Skill sync — **OK**; engineering L3 — **PASS** (not product Pass).
- `git diff --check -- crates/code/core/src crates/code/acp/src` — **exit 0**.
- `cargo fmt --all -- --check` still exits 1 only for the pre-existing
  `examples/terminal_bench_runner.rs`; no current `core/src` formatting difference.

An additional broad `agent_api::tests::fact_log` run was **82 passed / 5 failed**.
The five stable failures are usage accounting, restored image bytes, no-governance tool
projection, skill visibility, and diagnostic error fidelity. Those tests do not enable
`read_only_synthesis_rounds`; they are retained as current-worktree failures, not counted
as this slice's Pass and not attributed to a clean HEAD without a baseline isolation run.
They did not weaken the observed staged-synthesis acceptance. The five cases were
subsequently repaired and the suite reached 87/87; see
`.kstudio/evidence/T2026-11-18-fact-log-five-repairs/OUTCOME.md`.

## Explicitly not claimed

- No whole-product or Meta Harness Done, no general latency/token SLO, no statistical
  improvement claim, no proof that all models classify intent identically.
- No kbox copy/edit, commit, push, install, release, new branch/worktree, Windows native
  check, or Studio change.
