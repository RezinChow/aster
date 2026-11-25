# Interactive Goal setup latency

The reported session waited 156.6 seconds for context compaction, then spent
264.8 seconds in Goal setup before the prompt returned. Before compaction its
log contained 73 user and model records. Fifty-two were tool calls with no
public assistant prose. Including user answers captured outside user-message
records, the conversation fits in 24 original source references. This was a
read-only count of the local log.

Goal setup now binds original conversation facts. It carries forward user
requirements, questions and answers, assistant text, and any public prose
attached to a tool call. A conversation that fits the 32-reference limit goes
straight to planning. The existing compaction path still preserves original
obligations when the conversation itself exceeds that limit.

After the prompt leaves the queue, interactive setup shows the active phase and
shares a 120-second deadline across summarization and planning. If planning is
interrupted after creation, the saved Goal can resume directly at planning. The
unattended path uses its existing host deadline.

## Verification

macOS arm64, pinned Rust 1.97.1, default development features. The terminal
scenarios run the freshly built sibling `aster` and `aster-acp` binaries in a
pseudo-terminal with an isolated workspace and a loopback model endpoint.

| Command | Result |
| --- | --- |
| `cargo build --locked -p aster -p aster-acp` | Passed. Both binaries report the same paired build ID. |
| `cargo test --locked -p aster-acp --lib agent::goal_tests::planning -- --nocapture` | 6 passed. The 40-tool-call regression sends one plan request and zero compactions. The long-dialogue fixture sends one compaction and one plan request while retaining the first and last authorized obligations. |
| `target/debug/deps/aster_acp-6e2b9cbac139c696 agent::goal_tests --test-threads=4` | 15 passed. Two live-provider tests ignored. |
| `cargo test --locked -p aster-core --lib -- agent_api::goal_facade::tests fact_control:: goal_control:: hitl:: tool_confirmation:: --test-threads=4` | 494 passed. |
| `cargo test --locked -p aster --bin aster -- --test-threads=4` | 57 passed. |
| `ASTER_TUI_BIN="$HOME/.local/bin/aster" target/debug/deps/shipped_tui_e2e-de5e7844d20a9a6c goal_setup::goal_setup_reports_progress_and_resumes_after_cancellation --exact --nocapture` | The installed 0.4.0 pair reproduced the missing progress notification while the loopback endpoint held the response. The test stopped at its progress assertion. |
| `cargo test --locked -p aster-acp --test shipped_tui_e2e goal_setup:: -- --nocapture --include-ignored` | 2 passed. The terminal displayed the planning phase before any response. Ctrl+C closed the held request in 0.36 s from prompt submission. The deadline scenario returned in 120.22 s. Both reopened the same Goal and accepted its plan on `/goal resume`. |
| `target/debug/deps/shipped_tui_e2e-de5e7844d20a9a6c shipped_agent_session_wire --exact --nocapture` | 1 passed. |
| `cargo clippy --locked -p aster-core -p aster-acp --all-targets --no-deps` | Passed with existing warnings in other code. Examples include lock guards held across awaits in `crates/code/acp/src/document_run_tests.rs` and `crates/code/core/src/agent_api/goal_facade/tests/execution/language.rs`. No diagnostics pointed to the changed Goal code. |
| `python3.12 tests/workspace_dependencies.py` and `python3.12 tests/cli_pair_identity.py` | 7 and 3 passed. The system Python 3.9 lacks `tomllib`, so the commands use the available Python 3.12. |
| `cargo fmt --all -- --check` and `git diff --check` | Passed. |

## Explicitly not claimed

- Live Kimi timing, provider-fault attribution, or a real-provider speedup
  measured by replaying the reported session.
- Linux or Windows native runtime coverage, a release build, or installation
  over the user's existing CLI pair.
