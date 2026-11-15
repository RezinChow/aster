# Aster agent connection recovery

Date: 2026-11-15, Asia/Shanghai. Product fix for the diagnosis in
`docs/evidence/code/2026-11-15-agent-connection-diagnosis/OUTCOME.md`.

## Environment and identity

- macOS Darwin arm64; toolchain `1.97.1-aarch64-apple-darwin` from
  `rust-toolchain.toml`.
- Checkout HEAD at verification: `e74809409957718b1154fd222e3f871429c82c6e`.
- Rebuilt pair from this checkout (not the previously installed 9.2.4 pair):

```text
aster-cli-pair-v1:b31e1b132dff9c9a02c53a98321760ba4ab59f43:aarch64-apple-darwin
```

  Both `target/debug/aster --build-id` and `target/debug/aster-acp --build-id`
  returned that identical value after `cargo build --locked -p aster -p aster-acp`.

## What was fixed

1. **P1 — ACP stdin cancel safety.** `aster-acp` now wraps stdin with
   `aster_acp_lib::LineBufferedRead::spawn_local` so
   `agent-client-protocol`'s `select_biased!` + `read_line` cannot drop
   mid-frame UTF-8 bytes. Added path dependency on `aster-acp-lib`.
2. **P2 — Disconnect reason retention.** ACP logs structured `aster_acp::stdio`
   outcome before `agent.close()`. The pager bridge keeps a bounded stderr
   tail and annotates join failures with observed exit status + stderr
   summary (no console dump). TUI bail text points at ACP logs /
   `session_end.worker_join`.
3. **P3 — Cursor `tool_unavailable` correction.** Identity/protocol-valid
   catalog misses become a non-executing `__parse_error` correction (same
   path as malformed arguments). Provider/server/approval/protocol failures
   remain `NonRetryableLlmError`. Requested secret tool names are not echoed.

## Pre-fix defect (from diagnosis; not re-claimed here)

Installed `aster-acp 9.2.4` failed the fragmented UTF-8 stdin probe twice
(control OK / fragmented exit 1 with `stream did not contain valid UTF-8`).
See the diagnosis OUTCOME. Formal regression below asserts the repaired
product.

## Commands and counts

| Command | Result |
| --- | --- |
| `cargo fmt -p aster-acp -p aster-core -p aster-pager -- --check` | exit 0 |
| `cargo test --locked -p aster-acp --bin aster-acp` | 10 passed |
| `cargo test --locked -p aster-acp --test acp_conformance_stdio -- --test-threads=1` | 15 passed (includes `fragmented_utf8_session_new_survives_outbound_interleave`) |
| `cargo test --locked -p aster-core --lib cursor_account -- --test-threads=1` | 45 passed (includes unknown-catalog correction + repeated-miss fatal) |
| `cargo test --locked -p aster-pager --lib acp::aster_spawn::transport_tests -- --test-threads=1` | 5 passed (stderr bound + nonzero exit annotation) |
| `cargo test --locked -p aster-pager --lib input_recovery -- --test-threads=1` | 16 passed |
| `cargo test --locked -p aster-acp --lib -- --test-threads=1` | 526 passed, 10 ignored |
| `cargo test --locked -p aster-acp-lib --lib -- --test-threads=1` | 17 passed |
| `cargo clippy --locked -p aster-core -p aster-acp -p aster-pager --all-targets --no-deps` | exit 0 (pre-existing warnings only) |
| `cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp` | exit 0; pair BUILD_IDs match |
| `cargo check --locked -p aster-core --features deep-live` | exit 0 |
| `ASTER_TUI_BIN=…/aster ASTER_ACP_BIN=…/aster-acp cargo test --locked -p aster-acp --test shipped_tui_e2e shipped_tui_launch_resume_and_visible_commands -- --test-threads=1` | 1 passed |
| `git diff --check` on touched recovery paths | exit 0 |

### Prompt command adjustments

- Prompt listed `cargo check --locked -p aster-core --features advanced-harness,deep-live`.
  Package has `deep-live` but no `advanced-harness`; ran `--features deep-live` only.
- `cargo check --locked --workspace --all-targets` failed on pre-existing
  `aster-studio` missing fixture/`include_bytes!` paths under `apps/studio`.
  Not caused by this change; not claimed green.
- Full `shipped_tui_e2e` reported `25 passed; 1 failed; 1 ignored` on both
  this tree and a clean baseline stash of the same HEAD for
  `reasoning::delayed_catalog_keeps_draft_and_explicit_effort` (timeout
  waiting for `slow/gpt (none)`). Treated as pre-existing flake under load;
  solo runs of that case have also passed and failed on both trees. Not
  claimed fixed or regressed by this work.
- An earlier full-suite failure of `shipped_tui_launch_resume_and_visible_commands`
  was pair-identity skew after an intervening workspace check rebuild; after
  rebuilding aster+aster-acp together that case passed.

## Explicitly not claimed

- That the historical session `fadaf458-…` second disconnect was the UTF-8
  stdin defect (diagnosis left that trigger unknown).
- That Inkstone doctor/Vitest were re-run, or that user binaries were replaced.
- Full `cargo check --workspace --all-targets` green (studio fixture gaps).
- `advanced-harness` feature coverage (feature does not exist on `aster-core`).
- Full `shipped_tui_e2e` suite green, or a fix for
  `delayed_catalog_keeps_draft_and_explicit_effort`.
- Automatic connection recovery, infinite retries, or weakening of
  provider/server/approval fail-closed paths.
- Commit or push (not requested).

## agent-desktop visual companion (2026-11-15)

Private harness (not product source):
`.runtime/tui-full-e2e/agent-connection-recovery-agent-desktop-20261115/`.

Built and staged this checkout's `aster` + `aster-acp` into `bins/` with matching
BUILD_ID `aster-cli-pair-v1:b31e1b132dff9c9a02c53a98321760ba4ab59f43:aarch64-apple-darwin`.
Mock ACL only; no real model.

| Step | Oracle | Result |
| --- | --- | --- |
| Hermetic fragmented stdin reconfirm | `cargo test … fragmented_utf8…` | 1 passed |
| Launch Terminal via `open -a Terminal` + staged pair | agent-desktop `list-windows` / `focus-window` | window bound; pager ready (`Type a message` / `mock/gpt`) |
| Kill live `aster-acp` child | Terminal history | `Error: Agent connection closed; see ACP logs under …/logs and session_end.worker_join…` |
| Screenshot | `screencapture -R` from agent-desktop bounds | `evidence/after-kill.png` |

`has_resume_hint` was false: the pager was still on the welcome composer (no
session id), so no `--resume` line is expected. Disconnect + log-location copy
is what this companion asserted.

Commands:

```sh
cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp
cargo test --locked -p aster-acp --test acp_conformance_stdio fragmented_utf8_session_new_survives_outbound_interleave -- --test-threads=1
python3 .runtime/tui-full-e2e/agent-connection-recovery-agent-desktop-20261115/drive_connection_recovery.py
```

Drive result JSON: `ready_ok=true`, `has_connection_closed=true`,
`has_log_hint=true`, exit 0.

Follow-up execution prompt (authoritative handoff for review +
agent-desktop E2E; refreshed 2026-11-15 after kimi-01 case planning):
`docs/implementation-prompt-aster-agent-connection-recovery-agent-desktop-e2e.md`.

Case-plan references:
`E2E-CASES-KIMI01-PLAN.md` (kimi-01), `E2E-CASES-KIMI-PLAN.md` (quota fallback).

