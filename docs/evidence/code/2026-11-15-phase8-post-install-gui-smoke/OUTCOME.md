# Phase 8 — post-install GUI disconnect smoke (V1)

Date: 2026-11-15 (Asia/Shanghai).  
Contract: `docs/implementation-prompt-aster-phase8-post-install-gui-smoke.md`.

## S0–S1 identity

| Item | Value |
| --- | --- |
| HEAD (pre-evidence) | `7504df93f62b6b9ead1087cbdd4d96351c415619` |
| `which aster` | `/Users/roylin/.local/bin/aster` |
| Installed BUILD_ID | `aster-cli-pair-v1:70787faceda1b14fddf4bb165f8947e062a5c429:aarch64-apple-darwin` (pair match) |
| Drift vs campaign tip | **无** |
| Drive companion bins before | `b31e1b132…` (prior staged recovery pair) |
| Drive companion bins after | **install copy** `70787face…` (provenance: `~/.local/bin`) |
| agent-desktop | CLI `2.5` / app `1.0.2`; accessibility + screen_recording granted |

Runtime (not committed): `.runtime/tui-full-e2e/phase8-post-install-smoke-20261115/evidence/`.

## S2 — V1

| Item | Value |
| --- | --- |
| Driver | `.runtime/…/agent-connection-recovery-agent-desktop-20261115/drive_connection_recovery.py v1` |
| Bin source | Companion `bins/` overwritten from `~/.local/bin` (same BUILD_ID) |
| Result | **PASS** |
| Oracles | `has_connection_closed=true`; `has_log_hint=true`; `has_resume_hint=false` (welcome/no-session note, same as original V1) |
| ACP killed | pid `58374` |

Relation to original staged V1: same disconnect copy/oracle; **different binary provenance** (install path vs earlier staged `b31e1b132…`).

## S5 / S6

| ID | Status |
| --- | --- |
| S5 V3 | **SKIP** |
| S6 Studio | **SKIP** |

## Residual update

Phase 7 ledger row「Post-install GUI disconnect smoke」→ **CLOSED-PASS** (this OUTCOME).

Still OPEN: Studio; extra wire cases; full `shipped_tui_e2e`; `delayed_catalog` flake.

## Explicitly not claimed

- Studio host E2E.
- V2–V5 / long-horizon suite re-run in this phase.
- `delayed_catalog` flake fixed.
- Every `aster` copy outside `~/.local/bin` / the companion bins used for this smoke.
- That a Studio epic has started.

## Short report

```text
阶段：phase8-post-install-gui-smoke
S0：which=/Users/roylin/.local/bin/aster；BUILD_ID=70787face…；drift=无
S2-V1：PASS
S5-V3：SKIP
推送：OK；origin/main@bcfbc89c4
证据：docs/evidence/code/2026-11-15-phase8-post-install-gui-smoke/OUTCOME.md
残留仍开：Studio；其它 wire；shipped_tui_e2e；delayed_catalog
```
