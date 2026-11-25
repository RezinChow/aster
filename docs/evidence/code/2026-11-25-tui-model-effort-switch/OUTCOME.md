# TUI effort during model selection

With the previous paired binaries, `reasoning::delayed_catalog_keeps_draft_and_explicit_effort` held the requested model's catalog response, submitted `/effort none`, and entered a draft. Releasing the response switched to `slow/gpt`, then switched back to `mock/gpt` with effort `none`. The test timed out waiting for `slow/gpt (none)`.

The pager now holds the latest submitted effort while that model selection is pending. It resolves the level against the confirmed model's catalog and sends the existing model/effort request for that model. The prompt queue stays held until the effort request completes. A failed selection discards the waiting effort and keeps the existing failure message. A new model selection or reconnect clears effort queued for the previous selection.

## Verification

Native macOS 27.2.1 arm64 with the repository's Rust 1.97.1 and default features.

- `cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp` built the pair with ID `aster-cli-pair-v1:bb223ed287bd65ba6fa7817e8f30160bea71ce83:aarch64-apple-darwin`. Both binaries reported this ID and were copied together for the process tests.
- The compiled `shipped_tui_e2e` test with `reasoning::delayed_catalog_keeps_draft_and_explicit_effort --exact --nocapture` passed, followed by three independent passes with `--exact`. It checks the preserved draft, the selected endpoint, the explicit wire effort, and one catalog fetch.
- `ASTER_TUI_BIN="$PAIR_DIR/aster" ASTER_ACP_BIN="$PAIR_DIR/aster-acp" target/debug/deps/shipped_tui_e2e-de5e7844d20a9a6c --test-threads=1` passed 34 and ignored 2 in 194.48 seconds.
- `RUST_MIN_STACK=8388608 cargo test --locked -p aster-pager --lib -- effort_during_model_switch switch_model model_switch reconnect_reload_clears_stuck_model_switch_pending slash::commands::effort app::dispatch::queue --test-threads=1` passed 113. The new dispatch case supplies an alias only in the confirmed catalog and checks that the prompt is held through both acknowledgments.
- `cargo fmt --all -- --check` and `git diff --check` passed. `cargo clippy --locked -p aster-pager --all-targets --no-deps` completed with warnings.
- `cargo check --locked --workspace --all-targets` reached the native capture build and failed because the local Xcode Command Line Tools lack the `SwiftUIMacros.StateMacro` plugin.

## Real model

```sh
ASTER_CONFIG_FILE="$PWD/../config.acl" \
ASTER_TUI_BIN="$PAIR_DIR/aster" ASTER_ACP_BIN="$PAIR_DIR/aster-acp" \
target/debug/deps/aster_tui_live_e2e-d7359b08cd0469f7 \
  kimi_01_tui_compacts_and_plans_then_reopens_the_same_goal --ignored --exact --nocapture
```

The first TUI run completed both turns across manual compaction. It reached the unchanged 90-second wait for `aster.goal.plan.accepted` and exited with a failed test result after 164.00 seconds. The rerun used identical inputs and passed in 147.64 seconds. In the rerun, `kimi-01/k3.1-pro` repeated the exact synthetic marker across compaction, produced an accepted Goal plan, and reopened and paused that Goal under the same session ID. Both TUI launches exited 0 and the operator ACL remained byte-identical.

`aster --trust --no-auto-update --model kimi-01/k3.1-pro --output-format json -p "$SYNTHETIC_PROMPT"` also ran with this pair and an isolated workspace and home. It exited 0 in 20.42 seconds, returned the exact marker in one JSON document, reported `stopReason=end_turn`, and left the operator ACL byte-identical.

## Explicitly not claimed

- Real-provider reproduction of the catalog delay. The hermetic process test controls the catalog response timing.
- A 90-second bound on real-provider Goal planning latency.
- Native Linux or Windows runs, Studio GUI validation, or release deployment.
