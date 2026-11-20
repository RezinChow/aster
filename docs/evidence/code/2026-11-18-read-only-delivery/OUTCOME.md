# T2026-11-18-read-only-delivery

Updated: 2026-11-18 · scope: interactive read-only exploration / synthesis · **deterministic slice verified; live convergence failed** · **≠ Meta Harness Done**

## Problem and first-principles bound

A simple architecture question could spend many minutes in serial reads without a
first answer. Ordinary ACP sessions had no tool-round count ceiling and automatic
delegation was off by default. The required fix is not a larger context window or a
prompt-only request to be faster. The harness must bound waste, batch independent
reads, isolate scoped exploration, and preserve enough state to synthesize and resume.

Reference: openai/codex source `ca21fe65d18a9b6326759fb4263c65dfbb645aa5`.
The Codex main turn has no default 90-second synthesis rule; its useful mechanisms are
capability-aware parallel dispatch, scoped explorers, and bounded model history. Aster
adds the interactive synthesis policy separately; permission-mode YOLO is unrelated.

## Landed

1. **Parallel read scheduling**: `execute_tool_turn` admits a multi-call response only
   when every registered tool's `ToolCapabilities` explicitly permits parallel batch.
   Unknown/conservative calls stay sequential. Concurrency is the minimum of the
   session cap and each tool's `max_parallelism`; existing ordered parallel execution
   preserves result order and per-call governance. Parallel writes keep their distinct
   path check. The shared dispatch function has a scoped, reasoned lint expectation.
2. **Built-in explore**: the existing native Agent is now explicitly single-question,
   read-only, limited to 8 steps, batches independent reads, reuses supplied findings,
   and returns concise `file:line` evidence plus remaining gaps. No second orchestration
   framework was added.
3. **Soft synthesis prompt**: `SessionOptions::with_read_only_synthesis_rounds` adds an
   optional one-shot policy. Interactive ACP uses 2 read-only tool responses; Core and
   unattended defaults remain disabled. The state machine is
   `Collecting → Pending → Spent`; a non-read-only response resets the consecutive wave
   count, while an actual workspace mutation makes the run `Ineligible`. `Pending`/`Spent`
   and the wave count survive loop checkpoints. At the budget point Core injects a
   user-wire request to state supported conclusions, evidence, gaps, and whether more
   work is needed. **Tools remain available**: the model may answer or continue only
   for a named gap. Existing `max_tool_rounds`, duplicate-call finalization and
   zero-means-unlimited behavior stay independent.
4. **Waste and compaction guards**: same-response identical calls execute once and keep
   a synthetic duplicate result; cross-round duplicate finalization remains. Existing
   durable-source compaction protection was exercised: changed source or foreign writer
   refuses the append. Aster has no background compaction candidate in this path, so no
   speculative stale-candidate race mechanism was added.

## Verification

Host: macOS ARM64 · pinned Rust 1.97.1 · repository root `/Users/roylin/code/aster`.
All commands used `--locked` and the root workspace.

| Command / suite | Actual result |
| --- | --- |
| `cargo test -p aster-core --lib read_only_tool_batch_overlaps_only_with_explicit_parallel_capabilities` | **1 passed / 0 failed**; parallel probe overlap=2, conservative fallback=1 |
| `cargo test -p aster-core --lib parallel_write_batch_fast_path_is_only_a_data_race_check` | **1 passed / 0 failed** |
| `cargo test -p aster-core --lib test_agent_registry_get` | **1 passed / 0 failed**; native explore max_steps=8 and write=Deny |
| `cargo test -p aster-core --lib prompts::tests` | **48 passed / 0 failed** |
| `cargo test -p aster-core --lib agent::tests::no_count_limit` | **9 passed / 0 failed** final group rerun; includes soft prompt with tools retained |
| `cargo test -p aster-core --lib read_only_synthesis_checkpoint_preserves_pending_and_spent_states` | **1 passed / 0 failed**; pending and spent survive restore |
| `cargo test -p aster-core --lib identical_calls_in_one_response_execute_only_once` | **1 passed / 0 failed**; two unique executions plus duplicate result |
| `cargo test -p aster-core --lib compact_append_refuses_foreign_writer_and_changed_source` | **1 passed / 0 failed** |
| `cargo test -p aster-core --lib agent_api::tests::read_only_delivery` | **2 passed / 0 failed** on final semantics; real AgentSession, real file reads and real task delegation with scripted model |
| `cargo test -p aster-acp --lib interactive_count_is_unbounded_without_an_explicit_limit_for_every_effort` | **1 passed / 0 failed**; interactive synthesis=2 while max_tool_rounds=0 |
| `cargo test -p aster-acp --lib interactive_explicit_acl_count_wins_over_every_effort_including_zero` | **1 passed / 0 failed** |
| `cargo clippy -p aster-core --all-targets --no-deps` | **exit 0**; existing unrelated warnings retained |
| `cargo clippy -p aster-acp --all-targets --no-deps` | **exit 0**; existing unrelated warnings retained |
| `git diff --check -- crates/code/core/src crates/code/acp/src` | **exit 0** after the final lint edit |

`cargo fmt --all -- --check` still exits 1 only for the pre-existing modified
`crates/code/core/examples/terminal_bench_runner.rs`. None of this task's Rust files
appears in its final diff output. Full `git diff --check` also reports the pre-existing
trailing whitespace in `.kstudio/skills/README.md`. Existing Terminal Bench files were
preserved byte-for-byte; no unrelated test or gate was weakened.

## Live-provider result

Historical result for the soft-only build; the production staged-synthesis successor is
`docs/evidence/code/2026-11-18-staged-read-only-synthesis/OUTCOME.md` (one live answer at
272.282 seconds). The earlier comparison did **not** pass:
three reads did execute concurrently, but the final soft-synthesis build still had no
settled answer at 600 seconds, after 15 tool calls and a 247.4k session-cumulative TUI
token display. No speedup or token improvement is claimed. Full records:
`.kstudio/evidence/T2026-11-18-kbox-real-tui-comparison/OUTCOME.md` and
`docs/evidence/code/2026-11-18-kbox-real-tui-comparison/OUTCOME.md`.

## Explicitly not claimed

- No real-provider latency or answer-quality Pass. The deterministic E2E tests are not
  a wall-clock SLO; the live kbox comparison is explicitly negative.
- No broad multi-agent rewrite, new scheduler framework, background-compaction race,
  Windows native check, Studio change, installation, commit, push, or release.
- Slice verification is not Meta Harness overall Done or product-wide Pass.
