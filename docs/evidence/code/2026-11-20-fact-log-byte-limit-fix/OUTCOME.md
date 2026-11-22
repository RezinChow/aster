# T2026-11-20-fact-log-byte-limit-fix

Scope: fix the fact-log 16 MiB byte-limit overflow on long-running sessions —
`tool.prepared` baseline bytes were invisible to compaction triggering, and
`compacted_prefix()` cannot prune without a `compaction.done` anchor.

## Problem (first-principles root cause)

A long run failed with:

```
fact schema: fact log byte limit exceeded:
no transcript covered by a compaction summary is left to prune
(limit 16777216 bytes, 419 facts, appending 1 facts / 225837 bytes,
largest kind: tool.prepared 14123418 bytes)
```

Causal chain, verified from source (not inferred from the rendered error text):

- `crates/effect/src/log.rs` enforces `MAX_LOG_BYTES = 16 MiB`; pruning is only possible when a `compaction.done` anchor exists — `compacted_prefix()` returns `None` without one.
- Compaction triggering in `crates/effect/src/coding.rs` only observed provider `prompt_tokens` or `state.size()` (summary/messages/background). `tool.prepared` baseline bytes live in `state.preparations` and were invisible to the trigger.
- `fact_control.rs` resets prompt tokens every completion (per-call, not cumulative), so even 19.5M cumulative tokens never satisfied the ~800k single-call watermark.
- The longer loop merely amplified an existing robustness gap: fact-log byte growth was invisible to compaction decisions, and the runner kept issuing attempts after the byte-limit error.
- `largest kind: tool.prepared 14123418 bytes` is an **aggregate** over that fact kind, not a single 14 MB fact; the failing append was `1 facts / 225837 bytes`.

## Fixes applied (typed, not text-matched)

| File | Change |
| --- | --- |
| `crates/effect/src/error.rs` | Added `ActorError::FactLogByteLimit { detail }` typed variant. |
| `crates/effect/src/log.rs` | Added `DEFAULT_COMPACT_AFTER_PRUNABLE_BYTES = MAX_LOG_BYTES * 3/4`; `byte_limit_error()`; prunable-kind/JSON-length helpers; `is_byte_limit_error()` now matches the typed variant; `validate_regular()` and `encode_facts()` emit the typed error. |
| `crates/effect/src/coding.rs` | `HarnessConfig::compact_after_prunable_bytes` + builder; `SchedulerState::prunable_fact_bytes`; `after_input()` triggers compaction on byte pressure **independently of `prefix.is_empty()`**; `step()` accumulates only `SUMMARIZED_KINDS` fact bytes and resets on `compaction.done`. |
| `crates/effect/src/log_tests.rs` | Byte-limit test matches the typed error and asserts Display prefix. |
| `crates/effect/src/coding/context_pressure_tests.rs` | New `prunable_byte_pressure_compacts_without_a_message_prefix`. |
| `crates/effect/tests/byte_limit_compaction.rs` | New `large_prepared_baselines_force_a_compaction_before_the_byte_limit` via `ToolRunner::prepare()` + `BigPreparedBaseline`; closes the 16 MiB loop without token/char pressure. |
| `crates/code/core/src/agent.rs` | New `AgentEvent::FactLogByteLimit`; `execution_error()` downcasts `ActorError` to the stable event. |
| `crates/code/core/src/event_protocol.rs` | New `AgentEventTypeV1::FACT_LOG_BYTE_LIMIT = "fact_log_byte_limit"` + mapping test. |
| `crates/code/core/examples/terminal_bench_runner.rs` | Handle typed `AgentEvent::FactLogByteLimit` as storage fatal; early-close session; `bail!` instead of burning more attempts. |
| `crates/code/core/examples/terminal_bench_runner/result.rs` | Added `storage_fatal` field + `mark_storage_fatal()`; result-file test. |

Explicitly **not** done: no raising the 16 MiB limit, no deleting baselines, no text-matching on rendered errors (would violate AGENTS.md), no blanket `!prefix.is_empty()` gate on byte pressure, no counting non-prunable bytes (would loop), no shared-baseline pruning (would dangle references).

## Local verification

All Rust commands used isolated `CARGO_TARGET_DIR=/tmp/aster-kburn-fix-target CARGO_INCREMENTAL=0`; default `target/` was not touched.

| Command | Result |
| --- | --- |
| `cargo test --locked -p aster-effect` | lib **101 passed / 1 ignored**; `byte_limit_compaction` **5/5**; all integration tests pass |
| `cargo test --locked -p aster-core --lib typed_fact_log_byte_limit_maps_to_a_stable_event` | **passed** |
| `cargo test --locked -p aster-core --example terminal_bench_runner` | **35 passed / 0 failed** |
| `cargo check --locked -p aster-core --all-targets` | **exit 0** |
| `cargo clippy --locked -p aster-effect -p aster-core --all-targets --no-deps` | **exit 0** (pre-existing warnings only) |
| `git diff --check` on changed files | **exit 0** |
| `cargo zigbuild --locked --release --target x86_64-unknown-linux-musl -p aster-core --example terminal_bench_runner` | **exit 0** (host lacks `x86_64-linux-musl-gcc`; zig toolchain used) |

One intermediate failure: `large_prepared_baselines_force_a_compaction_before_the_byte_limit` first failed with `left: Some("budget") right: Some("finished")` because `with_step_limit(None)` still left budget=8; fixed by `.without_count_limits()`. One byte-limit unit assertion failed on `ends_with("largest kind: tool.result")`; corrected to `contains(...)`.

## Hermetic E2E (fresh paired binaries)

```
CARGO_TARGET_DIR=/tmp/aster-kburn-fix-target \
ASTER_TUI_BIN=/tmp/aster-kburn-fix-target/debug/aster \
ASTER_ACP_BIN=/tmp/aster-kburn-fix-target/debug/aster-acp \
cargo test --locked -p aster-acp --test tui_913_hermetic
```

Result: **13 passed / 2 failed / 137.62s**. `shipped_binaries_report_current_version` passed with the paired BUILD_ID. The 2 failures are the pre-existing host-sandbox cases (`three_turns_fix_the_bug_they_diagnosed`, `long_task_repairs_the_check_after_a_failure`), independently proven environmental.

## Provider re-run: byte-limit path gone

Same task/model/ACL/runner across arms; only the engineering-pack setting differed. Runner binary: `/tmp/aster-kburn-fix-target/x86_64-unknown-linux-musl/release/examples/terminal_bench_runner`.

- The original fact-log byte-limit failure path is **gone on both arms** (no `byte limit exceeded`, `storage_fatal=false`). The runner no longer burns to 17 attempts / 19.5M tokens after a fatal storage error. This is the fix's decisive validation.
- No USD cost figure; token counts are provider-reported cumulative usage, not billing.

## Parked / not claimed

- Host bash/sandbox execution channel — environmental, needs host fix, not a code patch here.
- Full 10/10 PTY matrix, full Core lib serial suite, Studio sync, Windows native, product Pass.
- `%≠Pass`; ≠ Meta Harness Done.
