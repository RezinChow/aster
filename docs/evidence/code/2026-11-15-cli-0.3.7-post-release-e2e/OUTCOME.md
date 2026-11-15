# CLI 0.3.7 post-release E2E — OUTCOME

Date: 2026-11-15 (Asia/Shanghai).  
Contracts:

- `docs/evidence/code/2026-11-15-cli-0.3.7-post-release-e2e/E2E-TEST-PLAN.md`
- `docs/implementation-prompt-aster-cli-0.3.7-post-release-e2e.md`

**Verdict: PASS**

## P0 — channel / install identity

| Check | Result |
| --- | --- |
| `aster-cli-stable` latest.json | `version=0.3.7`, `tag=aster-cli-v0.3.7` |
| `which aster` | `/Users/roylin/.local/bin/aster` |
| Versions | `aster 0.3.7 (1a8e38d51747)` / ACP `9.2.5` |
| Pair BUILD_ID | `aster-cli-pair-v1:3a00b4a3254007182c15726e7a6ce8ed6fce2dfb:aarch64-apple-darwin` |
| Update needed | no |
| agent-desktop | CLI `2.5` / app `1.0.2`; accessibility + screen_recording granted |

## P1 — hermetic

| Check | Result |
| --- | --- |
| Recovery ancestor `6c2916864` | yes |
| utf8 fragmented stdin | PASS |
| `aster_spawn::transport_tests` | 5 PASS |

## P2 — disconnect GUI (install bins)

Drive bins overwritten from `~/.local/bin` (BUILD_ID `3a00b4a3…`; prior companion bins were debug `70787face…`).  
Driver: `.runtime/…/agent-connection-recovery-agent-desktop-20261115/drive_connection_recovery.py`.

| Case | Status | Notes |
| --- | --- | --- |
| V1 | **PASS** | `has_connection_closed` + log hint; welcome `has_resume_hint=false` |
| V3 | **PASS** | no false `Agent connection closed` |
| V2 | **PASS** | session `562fa7cc-…`; resume hint same id |
| V5 | **PASS** | fields found; excerpt present |
| V4 | **PASS** | `inference_requests=0`; `catalog_requests=1`; UI resumed |

Runtime (not committed): `.runtime/tui-full-e2e/cli-0.3.7-post-release-e2e-20261115/evidence/`.

## P3 / P4

| ID | Status |
| --- | --- |
| P3 thin long-horizon | **SKIP** |
| P4 wire L5 | **SKIP** |

## Explicitly not claimed

- Studio host E2E.
- Full `shipped_tui_e2e` / multi-platform GUI.
- Full long-horizon L2–L5 re-campaign.
- `delayed_catalog` flake fixed.
- That debug BUILD_ID `70787face…` equals release-dist `3a00b4a3…` (profiles differ; both are valid 0.3.7 lineage).

## Short report

```text
战役：cli-0.3.7-post-release-e2e
P0身份：version=0.3.7/9.2.5；BUILD_ID=3a00b4a3…；stable=0.3.7
P1：utf8=PASS；transport=PASS
P2：V1=PASS V3=PASS V2=PASS V5=PASS V4=PASS
P3/P4：SKIP
判定：PASS
证据：docs/evidence/code/2026-11-15-cli-0.3.7-post-release-e2e/OUTCOME.md
```
