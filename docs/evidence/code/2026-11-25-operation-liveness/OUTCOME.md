# Operation cancellation, deadlines and session startup

## Confirmed failures and repair boundaries

The local OpenAI-compatible and MCP fixtures reproduced the original waits with the shipped ACP process. This establishes a host-side failure mode independent of a live provider.

| Operation | Before | Contract verified after the repair |
| --- | --- | --- |
| Manual compaction | The ACP cancel notification returned while the provider request stayed open, and releasing the provider appended a summary. | The operation's cancellation signal reaches the provider. A cancelled request keeps the original log, and the same session accepts a new prompt. A committed summary retains its success response. |
| Unattended execution | A five-second task waited for a separate fresh-review compaction service. | One elapsed-time budget covers Core admission, active runs, continuation previews, provider retry delays and fresh review. The result reports `deadline_exceeded` while the fixture still holds the compaction response. The original Run owns any cleanup that continues after the bounded join. |
| Goal setup | A small number of large facts could bind a Goal even when the first planning request could never fit. Its original scope made another attempt fail after compaction. | Capacity accounts for the system prompt and schema before a new definition is appended. A bound Goal may use a verified manual compaction of its original scope and retains the original user and answer facts, objective and binding. Exact input that still exceeds the window asks for a larger context window. |
| SSE stream | Comments every 80 ms kept a stream alive past a 250 ms idle limit. | A bytes-only heartbeat stream reaches the existing interruption retry path. An equally long stream delivering reasoning deltas completes normally. |
| Session MCP | Two failed handshakes started about ten seconds apart. An unrelated session waited behind them. | Both handshakes start together. An unrelated session opens while they are held. A pending same-name conflict is refused, and the first prompt of the originating session includes the healthy connector's tool. An obsolete registration cannot publish a client under a replacement name. |
| Model catalog | A second session with the same model and endpoint issued a second GET and waited about ten seconds for it. | New and restored sessions reuse a successful discovery in the same host process. Selected limits and explicit refresh retain their existing behavior. |

The session model, durable Goal authority, accepted progress, terminal protocol and release pairing still use their existing owners. The timeout uses the existing stream-idle control. The Goal estimate uses the same local estimator and the first structured request produced by the planner.

## Verification

Native macOS 27.2.1 on arm64 with the repository-pinned Rust 1.97.1 and default CLI features.

- `cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp` produced the matching pair `aster-cli-pair-v1:cf90b1b65953f54abb652f6f3a53001222008c34:aarch64-apple-darwin`. The native PTY tests used a fixed copy of both binaries.
- `cargo test --locked -p aster-acp --test shipped_tui_e2e -- goal_setup::goal_setup_reports_progress_and_resumes_after_cancellation operation_liveness --test-threads=1 --nocapture` passed five cases. The Goal setup cancellation returned in 0.44 seconds.
- The full `cargo test --locked -p aster-acp --test shipped_tui_e2e -- --test-threads=1` passed 31 with two ignored on the fixed pair. An earlier run caught mixed development build identities and was superseded by the fixed-pair run.
- `cargo test --locked -p aster-acp --lib -- --test-threads=1` passed 555 tests with ten ignored.
- `cargo test --locked -p aster-pager --lib -- compact session_controls --test-threads=1` passed 108 tests.
- `cargo test --locked -p aster-acp --test unattended_e2e -- fresh_review a_continuation_attempt_never_outlives_the_run_deadline --test-threads=1` passed two cases.
- `cargo test --locked -p aster-acp --test unattended_e2e -- convergence cycle original_refusals child_refusal --test-threads=1` passed six cases.
- `cargo test --locked -p aster-acp --test acp_conformance_stdio -- --test-threads=1` passed fifteen cases.
- `cargo test --locked -p aster-core --lib -- goal_facade::tests compaction::tests compaction_budget_tests compaction_carry agent_api::tests::compact async_mcp mcp::manager::tests llm_invoker --test-threads=1` passed 290 cases. Rust tests used `RUST_MIN_STACK=8388608`.
- `cargo fmt --all -- --check` and `git diff --check` passed. `cargo clippy --locked -p aster-core -p aster-acp -p aster-pager --all-targets --no-deps` completed with warnings. The Python 3.12 workspace dependency, release workflow and pair delivery checks passed 7, 7 and 23 tests.

## Real model

```sh
ASTER_CONFIG_FILE="$PWD/../config.acl" \
ASTER_TUI_BIN="$PAIR_DIR/aster" ASTER_ACP_BIN="$PAIR_DIR/aster-acp" \
cargo test --locked -p aster-acp --test aster_tui_live_e2e \
  kimi_01_tui_compacts_and_plans_then_reopens_the_same_goal -- --ignored --exact --nocapture
```

One test passed in 122.34 seconds with the explicitly selected `kimi-01/k3.1-pro` model. A synthetic UUID marker returned verbatim in two independent turns across a durable `compaction.done` fact. The live provider's proposal produced `aster.goal.plan.accepted` for the exact objective. A fresh TUI process reopened the same session and persisted `aster.goal.paused`. Both TUI launches exited with status zero. The acceptance driver verified that the operator ACL bytes matched at the end. An earlier run reached the test driver's 90-second wait for a plan. Single-run latency is outside this qualification.

## Explicitly not claimed

- Studio's renderer built from this checkout with `ASTER_TENANT_SLUG=aster STUDIO_RENDERER_DIST=.studio/dist/aster npm exec --yes --package=pnpm@12.6.0 -- pnpm exec rsbuild build`. The native `just build-studio` failed when `capture-helper` could not load `SwiftUIMacros.StateMacro`. The installed Xcode Command Line Tools reported SDK 27.2 and Swift 6.4.2. No Studio window was launched for verification.
- Native Linux and Windows execution.
- Qualification of other provider accounts or model variants, changes to operator ACL, installation of the debug pair or a release publication.
