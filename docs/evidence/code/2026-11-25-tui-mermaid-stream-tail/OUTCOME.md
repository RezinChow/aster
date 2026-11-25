# Preserve streamed text through prompt completion

The previous macOS Terminal run displayed the Mermaid source and the completed-turn marker without the last sentence. Both text chunks were present in the durable turn fact. [Original screenshot](../2026-11-25-tui-inline-mermaid/agent-desktop/07-fast-stream-followup.png)

The focused regression sends both updates and the prompt response in one stdio write. The old bridge resolved the prompt with zero of the two updates in the pager queue at that point. The RPC reader resolved responses inline and spawned callbacks for notifications. Fast delivery could therefore let completion clear the current prompt before its trailing output was applied.

The pager bridge now enqueues standard session updates and supported extension notifications as it reads their complete frames. It preserves the read boundary in both directions, including a notification that follows an earlier response. If terminal input temporarily defers the ACP receive arm, the event loop applies the queued prefix in its existing bounded batches before dispatching the prompt completion.

## Changed files

- The frame reader and its ordering test are in [line_reader.rs](../../../../crates/terminal/crates/codegen/aster-acp-lib/src/line_reader.rs).
- The pager routes the ordered stdio notifications in [aster_spawn.rs](../../../../crates/terminal/crates/codegen/aster-pager/src/acp/aster_spawn.rs) and drains the queued prefix in [event_loop.rs](../../../../crates/terminal/crates/codegen/aster-pager/src/app/event_loop.rs).
- The buffered stdio regression and the two-chunk Off rendering case are in [transport_tests.rs](../../../../crates/terminal/crates/codegen/aster-pager/src/acp/aster_spawn/transport_tests.rs) and [agent_mermaid_tests.rs](../../../../crates/terminal/crates/codegen/aster-pager/src/scrollback/blocks/agent_mermaid_tests.rs).

## Verification

Native macOS 27.2.1 arm64, pinned Rust 1.97.1, default features.

- `RUST_MIN_STACK=8388608 cargo test --locked -p aster-pager -p aster-acp-lib --lib -- mermaid acp::aster_spawn::transport_tests session_load_barrier line_reader --test-threads=1` passed 93 pager tests and 7 line-reader tests. Coverage includes the buffered prompt response, line-filter ordering, partial-frame cancellation, replay, and Mermaid display and source actions.
- `RUST_MIN_STACK=8388608 cargo test --locked -p aster-markdown -p aster-mermaid -p aster-acp-lib --lib -- --test-threads=1` passed 498 Markdown tests and 53 Mermaid tests. Both of those packages were unchanged by this fix.
- `cargo test --locked -p aster-acp-lib --lib -- --test-threads=1` passed all 23 ACP transport-library tests with the final reader.
- `ASTER_TUI_BIN="$PAIR_DIR/aster" ASTER_ACP_BIN="$PAIR_DIR/aster-acp" target/debug/deps/shipped_tui_e2e-de5e7844d20a9a6c shipped_tui_launch_resume_and_visible_commands --exact --nocapture` passed against the final staged pair in 88.33 seconds.
- `cargo fmt --all -- --check` and `git diff --check` passed. `cargo clippy --locked -p aster-pager -p aster-acp-lib --all-targets --no-deps` completed with warnings.
- `cargo check --locked --workspace --all-targets` stopped in the existing `capture` build because the local Swift toolchain could not load `SwiftUIMacros.StateMacro`.

## Native Terminal and Preview

Built from this checkout with `cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp`. Both staged binaries reported `aster-cli-pair-v1:8501cbc35b31bfbc87fbde8877bc855944183f70:aarch64-apple-darwin`. The launcher used the staged pair with `aster --cwd "$FIXTURE_WORKSPACE" --no-auto-update --no-plan --trust --fullscreen --model fixture/mermaid '请展示请求处理流程图。'`. A local HTTP/1.1 SSE fixture controlled both text chunks and the finish marker. The Off runs used `[ui] render_mermaid = "off"` in their isolated Aster homes. The batched run also forwarded the closing text and completion response in a single stdio write.

The desktop runs used `agent-desktop` 1.3.1 to bind windows, read their visible text, resize, capture screenshots, and exercise the terminal actions. Actual window dimensions were checked after Terminal snapped to its character grid.

| Scenario | Observed result | Artifact |
| --- | --- | --- |
| Off with fast delivery | Mermaid source and the final sentence both visible | [Terminal screenshot](agent-desktop/01-fast-off-fixed.png) |
| Off with batched stdio delivery | Same final sentence visible before the completion marker | [Terminal screenshot](agent-desktop/02-burst-off-fixed.png) |
| Open fence | Source visible while the turn is running | [Terminal screenshot](agent-desktop/03-streaming-source.png) |
| Closed fence | Inline boxes, final sentence, and Mermaid actions visible | [Terminal screenshot](agent-desktop/04-closed-preview.png) |
| Narrow then wide | Same message switches to source and back to boxes | [Narrow](agent-desktop/05-narrow-fallback.png), [wide](agent-desktop/06-wide-restored.png) |
| Open Image | The button generated a 2560×226 PNG and opened the matching document in Preview | [PNG](agent-desktop/07-open-image.png), [Preview screenshot](agent-desktop/08-preview-app.png) |
| Copy original | Typing `/copy copied.md` and pressing Return wrote all 181 original UTF-8 bytes, including both fences and the final sentence | |

## Explicitly not claimed

- External model service qualification, native Windows or Linux runtime verification, or Studio GUI verification.
- A desktop click on Copy Image Path. Its existing control is visible and the Mermaid affordance tests ran.
- New Mermaid syntax coverage. Diagram types outside the existing flowchart subset, including sequence diagrams, subgraphs, styling directives and labeled edges, keep the source fallback.
