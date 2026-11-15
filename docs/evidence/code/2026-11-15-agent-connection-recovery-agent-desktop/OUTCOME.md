# Aster connection recovery — review + agent-desktop E2E

Date: 2026-11-15 (Asia/Shanghai). Execution contract:
`docs/implementation-prompt-aster-agent-connection-recovery-agent-desktop-e2e.md`.

Cross-reference (do not overwrite):
`docs/evidence/code/2026-11-15-agent-connection-recovery/OUTCOME.md` (P0–P5 product fix).
Diagnosis boundary remains
`docs/evidence/code/2026-11-15-agent-connection-diagnosis/OUTCOME.md`.

## Environment

| Item | Value |
| --- | --- |
| HEAD | `e74809409957718b1154fd222e3f871429c82c6e` |
| OS | Darwin arm64 |
| Toolchain | `1.97.1-aarch64-apple-darwin` (`rust-toolchain.toml`) |
| Pair BUILD_ID | `aster-cli-pair-v1:b31e1b132dff9c9a02c53a98321760ba4ab59f43:aarch64-apple-darwin` (aster == aster-acp) |
| Staged bins | `.runtime/tui-full-e2e/agent-connection-recovery-agent-desktop-20261115/bins/` |
| agent-desktop | CLI `2.5`, app `1.0.2`; accessibility + screen_recording + automation granted |
| App under test | `终端` + staged `aster`/`aster-acp` (not `~/.local/bin`) |

Companion root:
`.runtime/tui-full-e2e/agent-connection-recovery-agent-desktop-20261115/`
(drive script evolved in place; not product source).

## R0 — baseline / hermetic

| Check | Result |
| --- | --- |
| Recovery diff still present | yes (acp / mcp / aster_spawn / app bail paths) |
| `cargo build --locked -p aster -p aster-acp` | exit 0; BUILD_IDs match |
| `fragmented_utf8_session_new_survives_outbound_interleave` | 1 passed |
| `aster-pager` `acp::aster_spawn::transport_tests` | 5 passed |

Evidence: `…/evidence/r0-git.txt`, `r0-agent-desktop-status.txt`,
`r0-hermetic-utf8.log`, `r0-hermetic-transport.log`, `build-id-*.txt`.

## R1 — review

Written: `…/evidence/r1-review.md`.

| Class | Count |
| --- | --- |
| High risk | 0 |
| Non-blocking | 2 (stderr Mutex poison swallow; welcome V1 may omit resume hint) |
| Bugbot | not run (manual review only; 无有效 Bugbot finding) |

No product fix required before GUI.

## R2 — agent-desktop cases (order V1 → V3 → V2 → V5 → V4)

Driver:
`python3 .runtime/…/drive_connection_recovery.py <case>`
Oracles: Terminal `history of selected tab`, `agent-desktop` focus/list-windows,
`screencapture -R` (evidence only), mock HTTP counter (V4), `$ASTER_LOG_DIR`.

| Case | Status | Exit / notes |
| --- | --- | --- |
| **V1** | PASS | SIGTERM live `aster-acp`; hist has `Agent connection closed` + log path / `session_end.worker_join`. `has_resume_hint=false` (welcome / no bound session) recorded in `v1-result.json`. |
| **V3** | PASS | `/quit`; hist has resume + `Saving session...completed` / `[进程已完成]`; **no** `Agent connection closed`. |
| **V2** | PASS | `/new` + `/session-info` → `086e4f08-5a91-4bb4-8b63-bc859779b3d0`; kill ACP; bail + `aster --resume 086e4f08-…` same id. |
| **V5** | PASS (partial fields) | Hist bail points at `ASTER_LOG_DIR` + worker_join. ACP log samples `stdio_ready` / transport. **Not claimed:** `acp_stderr=` / `aster_acp::stdio` outcome lines after hard SIGTERM (no graceful flush). Bridge annotation still hermetic-covered. |
| **V4** | PASS | `aster --resume 086e4f08-…`; UI restored (`Add a follow-up`). Counting mock: `inference_requests=0`; one `GET /v1/models` catalog probe (`requests_total=1`). Pass rule: zero inference burns; catalog probe allowed and disclosed. |

Evidence files under
`.runtime/tui-full-e2e/agent-connection-recovery-agent-desktop-20261115/evidence/`:
`v1-result.json`, `v1-ready-hist.txt`, `v1-closed-hist.txt`, `v1-after-kill.png`,
`v3-result.json`, `v3-quit-hist.txt`,
`v2-result.json`, `v2-session-id.txt`, `v2-closed-hist.txt`, `v2-disconnect.png`,
`v5-bridge-fields.txt`, `v5-acp-log-excerpt.txt`, `v5-result.json`,
`v4-result.json`, `v4-resume-hist.txt`, `v4-mock-request-count.json`, `v4-resume.png`.

Shipped PTY resume cross-test: **not required** (V2 GUI PASS).

## Explicitly not claimed

- Historical second disconnect == UTF-8 stdin fragmentation (diagnosis still unknown).
- Studio / Inkstone / install binary replacement / commit / push.
- GUI reproduction of UTF-8 stdin fragmentation.
- `delayed_catalog_keeps_draft_and_explicit_effort` flake fixed.
- Zero total HTTP on resume (catalog `/v1/models` probe observed once).
- `acp_stderr=` / structured stdio outcome lines on hard SIGTERM GUI kill.
- Any `mock-aster` / invented binary path.
- Real-model (`kimi-01`) GUI runs (default remained companion mock ACL).

## Delivery

Product recovery diff remains uncommitted in the worktree. This OUTCOME and the
companion `.runtime/` drive artifacts are the review + agent-desktop E2E record.

## Follow-on

Deep multi-round / complex long-horizon campaign (plan + execution prompt;
not claimed executed here):

- `docs/evidence/code/2026-11-15-long-horizon-complex-e2e/E2E-TEST-PLAN.md`
- `docs/implementation-prompt-aster-long-horizon-complex-agent-desktop-e2e.md`
