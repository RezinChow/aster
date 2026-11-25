# Inline Mermaid previews in chat

The existing Markdown character renderer supplies a bounded flowchart preview for agent messages. The chat path requires a syntactically closed fence and a known content width. The rendered message falls back to the ordinary Mermaid code spans when the preview cannot fit or the syntax or resource budget is unavailable. Changing the setting invalidates the held scrollback layout. Width, theme and output changes continue through the existing Markdown and scrollback caches.

The chat subset accepts `flowchart` and `graph`, LR and TB (including TD and the default top-down direction), bare nodes, rectangular, rounded and decision labels, and directed `-->` edges. It accepts simple quoted labels and Unicode labels whose cell widths can be represented by the canvas. Other diagram types, subgraphs, style and initialization directives, groups, labeled and alternate arrow types, and other directions use source fallback. Input is limited to 8 KiB, 24 nodes, 32 edges, 48 label columns and 240 preview columns. Control characters in the rendered spans are removed independently of the retained fence body.

The source is still carried by the detection metadata, including when displayed as art. The existing Open Image, Copy Image Path and Copy Source actions use that metadata. The PNG worker implementation remains its existing subprocess pipeline.

## Verification

Native macOS 27.2.1 arm64 with pinned Rust 1.97.1 and default features.

- `RUST_MIN_STACK=8388608 cargo test --locked -p aster-markdown --lib -- --test-threads=1` passed 498.
- `RUST_MIN_STACK=8388608 cargo test --locked -p aster-pager --lib -- mermaid affordance_row_adds_one_row_per_diagram --test-threads=1` passed 73. The additional cases exercise streamed opening and closing, narrow reflow and wider recovery with Chinese labels, Off after rendering, refusal of unsupported and oversized syntax, literal source retention, and control-free drawn spans.
- `RUST_MIN_STACK=8388608 cargo test --locked -p aster-mermaid --lib -- --test-threads=1` passed 53, including the existing SVG and PNG checks.
- `cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp` passed. Both binaries reported `aster-cli-pair-v1:6aec7b2496a493df100161ebe8e94a065b515e48:aarch64-apple-darwin`.
- `ASTER_TUI_BIN="$PAIR_DIR/aster" ASTER_ACP_BIN="$PAIR_DIR/aster-acp" target/debug/deps/shipped_tui_e2e-de5e7844d20a9a6c shipped_tui_launch_resume_and_visible_commands --exact --nocapture` passed with the paired binaries in 87.68 seconds.
- `cargo fmt --all -- --check` and `git diff --check` passed. `cargo clippy --locked -p aster-markdown -p aster-pager --all-targets --no-deps` completed with warnings.
- `cargo check --locked --workspace --all-targets` failed at the native capture helper because the local Swift toolchain could not load `SwiftUIMacros.StateMacro`.

## Native Terminal with agent-desktop

`cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp` ran again from this checkout. Both staged binaries reported the same build ID above. The Terminal test launched the staged CLI with `--cwd "$FIXTURE_WORKSPACE" --no-auto-update --no-plan --trust --fullscreen --model fixture/mermaid '请展示请求处理流程图。'`. The model fixture listened on loopback and sent an HTTP/1.1 stream in two controlled phases. The `Off` window used an isolated `$ASTER_HOME/config.toml` with `[ui] render_mermaid = "off"`.

On macOS 27.2.1, `agent-desktop` 1.3.1 used `list-windows`, `focus-window`, `resize-window`, `snapshot`, and per-window `screenshot`. Terminal snapped requested pixel sizes to its character grid. When the resize command reported delivery without verification, a subsequent `list-windows` call confirmed the actual size before the content assertion and capture.

| Stage | Observed in Terminal | Artifact |
| --- | --- | --- |
| Streaming | The still-open fence displayed `flowchart LR` and the arrows as source while the turn was responding. | [PNG](agent-desktop/01-streaming-source.png) |
| Closed | The 149-column window displayed four connected character boxes with Chinese labels. Copy Source and both PNG actions were visible. | [PNG](agent-desktop/02-closed-preview.png) |
| Narrow | The same message switched back to source after the window resized to 50 columns. | [PNG](agent-desktop/03-narrow-fallback.png) |
| Restored | The inline preview returned after the same window resized back to 149 columns. | [PNG](agent-desktop/04-wide-restored.png) |
| Off | The completed block displayed source in a wide window and the trailing sentence remained visible in the controlled two-phase run. | [PNG](agent-desktop/05-off-source.png) |
| Open Image | `agent-desktop --headed mouse-click --xy 244,322` on the bound wide-window button generated a 2560×226 PNG in the isolated session cache. | [Generated PNG](agent-desktop/06-open-image.png) |

An additional ungated `Off` run displayed the completed fence body but omitted the following sentence from the visible transcript, including after a redraw. The durable `model.turn` fact retained the full sentence. The gated `Off` run displayed it. These observations leave the fast-delivery display discrepancy open. [Fast-delivery screenshot](agent-desktop/07-fast-stream-followup.png)

## Explicitly not claimed

- Mermaid grammar beyond the listed chat subset, native Windows or Linux runtime verification, or Studio GUI verification.
- Visual verification of the generated document inside an external image viewer. The generated image was independently reopened and inspected as a PNG artifact.
- A passing result from the earlier standalone PTY probe. The headed Terminal captures above used `agent-desktop` and the staged pair.
