# Core, ACP and TUI recovery

The default-feature CLI pair was built with Rust 1.97.1 on native macOS 27.2.1 arm64. Both binaries reported `aster-cli-pair-v1:a5eb22fbed82818445a95ba5c6cb20a78569e33c:aarch64-apple-darwin`. The process tests used a fixed copy of this pair.

| Failure reproduced before the repair | Behavior verified after the repair |
| --- | --- |
| A connector supplied by one ACP session appeared in another session's model request. | The originating session's request includes the tool. The independent session's request omits it. Core carries the same admitted registration set into inherited tool sources. |
| Invalid harness metadata triggered MCP initialize and tools/list before the rejection. | ACP returns `-32602` and the connector receives zero connections. |
| Two simultaneous cold opens for one model issued two catalog requests. | Both opens finish with one GET. The selected discovery data remains available for warm opens. |
| An HTTP 200 stream containing a partial delta, a provider error, and `[DONE]` finished successfully with the partial reply. | Core interrupts the faulty attempt. The fixture observes a retry and only the completed attempt is committed to the log. |
| A malformed legacy Goal on `session/load` stranded the old live session. | The load returns a validation error. A new prompt to the original ID completes and the original transcript remains present. |
| Goal planning admitted a request with approximately 11,979 input tokens and a 1,024-token output budget on a 12,288-token context. | ACP reports the capacity refusal before the first planning request or a durable Goal definition. The planner still recovers the verified original scope after manual compaction when it fits. |
| The headless CLI remained active after its stdout reader closed and stalled on one interrupt while the pipe was full. | A closed consumer exits with status 0 while the provider holds the terminal marker. A full, still-open pipe exits with status 130 on the first SIGINT. |
| An optimistic Thinking block interfered with identifying the server-started prompt and matching the queued echo. | The pager uses the admitted turn and real replayed activity when adopting a prompt. Locally submitted prompts still display Thinking immediately. |

The focused operation fixtures and the before/after probes used only local synthetic traffic. The real-model runs used an isolated workspace and home, a synthetic marker, and read-only access to the operator ACL.

## Local verification

- `cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp` built the pair recorded above.
- `cargo test --locked -p aster-acp --test shipped_tui_e2e operation_liveness:: -- --test-threads=1` passed 7 tests in 6.74 seconds.
- The full compiled `shipped_tui_e2e` suite with `--test-threads=1` passed 33, failed 1, and ignored 2 in 232.42 seconds. The one failure, `reasoning::delayed_catalog_keeps_draft_and_explicit_effort`, also failed when run individually with the preceding pair `aster-cli-pair-v1:cf90b1b65953f54abb652f6f3a53001222008c34:aarch64-apple-darwin`. Both pairs switched to `slow/gpt`, then applied `/effort none` to `mock/gpt` and timed out waiting for `slow/gpt (none)`. The concurrent cold-open contract is covered by a separate passing ACP test.
- `cargo test --locked -p aster-core --lib -- llm::openai::tests::stream_text mcp::manager::tests agent_api::agent_sessions::owner_identity_tests agent_api::goal_facade::tests agent_api::tests::async_mcp --test-threads=2` passed 195 tests.
- `cargo test --locked -p aster-acp --lib -- --test-threads=1` passed 555 tests with 10 ignored. This includes the concurrent selected-model catalog check.
- `cargo test --locked -p aster-acp --test acp_conformance_stdio -- --test-threads=1` passed 15 tests.
- `cargo test --locked -p aster-acp --test unattended_e2e -- fresh_review a_continuation_attempt_never_outlives_the_run_deadline convergence cycle original_refusals child_refusal --test-threads=1` passed 8 tests.
- `RUST_MIN_STACK=8388608 cargo test --locked -p aster-pager --lib -- app::dispatch::queue headless:: --test-threads=1` passed 260 tests. All eight pager queue failures from the review are covered by this run.
- `cargo clippy --locked -p aster-core -p aster-acp -p aster-pager --all-targets --no-deps` completed with warnings.
- `cargo check --locked -p aster-core --features ci-all,deep-live` passed.
- `cargo check --locked --workspace --all-targets` reached the capture build and failed because this SDK could not load the SwiftUI macro plugin.
- `cargo fmt --all -- --check` and `git diff --check` passed.
- Python 3.12 passed `tests/workspace_dependencies.py` (7), `tests/cli_pair_delivery.py` (23), and `tests/cli_release_workflow.py` (21). The macOS system Python 3.9 lacks `tomllib`.

## Real model

`aster --trust --no-auto-update --model kimi-01/k3.1-pro --output-format json -p "$SYNTHETIC_PROMPT"` exited 0 in 19.16 seconds. The result parsed as one JSON document, returned the exact synthetic marker, reported `stopReason=end_turn`, and included a session ID. The ACL bytes matched at the end.

```sh
ASTER_CONFIG_FILE="$PWD/../config.acl" \
ASTER_TUI_BIN="$PAIR_DIR/aster" ASTER_ACP_BIN="$PAIR_DIR/aster-acp" \
cargo test --locked -p aster-acp --test aster_tui_live_e2e \
  kimi_01_tui_compacts_and_plans_then_reopens_the_same_goal -- --ignored --exact --nocapture
```

The first PTY run recalled the marker across compaction and reached the test driver's 90-second wait for `aster.goal.plan.accepted`. Rerunning the compiled test with identical inputs and the same paired binaries passed in 144.82 seconds. The real provider returned the exact marker in both turns across `compaction.done`. The run recorded `aster.goal.plan.accepted` for the requested objective, restarted the TUI under the same session ID, and recorded `aster.goal.paused`. Both TUI processes exited 0 and the ACL bytes matched at the end.

## Explicitly not claimed

- Native Windows or Linux runtime coverage, any additional provider models, or release publication.
- A 90-second latency bound for Goal planning on the live provider.
- Resolution of the existing delayed-catalog effort race described above.
- A Studio GUI run. The Studio build from this checkout failed at the local Xcode Command Line Tools' `SwiftUIMacros.StateMacro` dependency for `capture-helper`. See [Operation cancellation, deadlines and session startup](../2026-11-25-operation-liveness/OUTCOME.md).
