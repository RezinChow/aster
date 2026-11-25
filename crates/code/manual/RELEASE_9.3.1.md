# Core / ACP 9.3.1 and Aster CLI 0.4.1

## Core and ACP

- Cancellation reaches in-flight manual compaction. An interrupted operation
  preserves the original transcript and the session can accept a new prompt.
  Unattended runs share their deadline across retries, continuation previews
  and completion review.
- Provider errors interrupt streamed attempts even when the provider later
  sends a normal end marker. Transport-only heartbeats do not extend a
  stalled model stream. Reasoning deltas still count as model activity.
- Session-scoped MCP tools stay isolated. Connector admission validates
  configuration before connecting, and independent registrations can progress
  concurrently. Sessions with the same model and endpoint reuse a successful
  catalog lookup within the host.
- Interactive Goal setup binds the original conversation, checks context
  capacity before saving a new Goal, and displays the active setup phase.
  Recovery from a compacted scope retains the original obligations and answers.

## Aster CLI

- Common Mermaid flowcharts display a character preview in chat once the
  fence closes. Narrow windows, unsupported syntax and the Off setting show
  source. Copy Source and the on-demand PNG actions remain available.
- The terminal applies streamed updates before ending the prompt. Fast replies
  keep the text following a closing Mermaid fence.
- An effort change requested during model selection is applied to the selected
  model before the prompt queue resumes. The draft stays in the editor.
- Headless output exits cleanly when its consumer closes the pipe. SIGINT can
  interrupt a headless run even while the output pipe is full.
- The Unix installer adds its binary directory to the startup configuration
  for zsh and Bash. Pass `--no-modify-path` to leave startup files untouched.

## Delivery

Core remains a local Rust SDK. Core and ACP share the source tag
`aster-acp-v9.3.1`. CLI uses `aster-cli-v0.4.1` and ships the matching
`aster` and `aster-acp` with their shared build identity, checksums and offline
embedding assets. Windows, macOS and both Linux architectures follow the
existing release workflows, including both static musl CLI builds.

CLI and Core/ACP releases use `--latest=false`. The CLI stable manifest and
the legacy installer manifest on the desktop Latest release are updated
after publication. [Release governance](../../../docs/release-governance.md)
