# Phase 7 — agent-connection + long-horizon campaign final closeout

Date: 2026-11-15 (Asia/Shanghai).  
Contract: `docs/implementation-prompt-aster-phase7-campaign-final-closeout.md`.

## Campaign verdict

**CLOSED-PASS**

Terminal CLI/ACP connection recovery, long-horizon agent-desktop verification
(including L5 W1), remote land on `origin/main`, and operator install under
`~/.local/bin` are closed. Residuals below remain out of this campaign.

## F0 snapshot

| Item | Value |
| --- | --- |
| HEAD | `df247a883627f24af8ae753737a1907dc98e56cf` |
| `origin/main` | same (aligned) |
| Checkout BUILD_ID | `aster-cli-pair-v1:70787faceda1b14fddf4bb165f8947e062a5c429:aarch64-apple-darwin` |
| Installed (`~/.local/bin`) | same pair BUILD_ID |
| Drift vs campaign tip | **无** |

Runtime logs (not committed): `.runtime/tui-full-e2e/phase7-final-20261115/evidence/`.

## Evidence chain

| Stage | Path | One-line result |
| --- | --- | --- |
| Diagnosis | `docs/evidence/code/2026-11-15-agent-connection-diagnosis/OUTCOME.md` | Root-cause ledger for disconnect / parse / bridge |
| Recovery product | `docs/evidence/code/2026-11-15-agent-connection-recovery/OUTCOME.md` | P1–P3 product fixes + hermetic |
| Recovery GUI | `docs/evidence/code/2026-11-15-agent-connection-recovery-agent-desktop/OUTCOME.md` | V1–V5 / L4 agent-desktop PASS |
| Long-horizon | `docs/evidence/code/2026-11-15-long-horizon-complex-e2e/OUTCOME.md` | L0–L4 PASS; CL first-pass kimi FAIL×3 retained |
| Phase 2 | `docs/evidence/code/2026-11-15-phase2-kimi-cl-and-land/OUTCOME.md` | kimi CL PASS×2 after harness timing fixes |
| Phase 3 | `docs/evidence/code/2026-11-15-phase3-land-recovery-and-closeout/OUTCOME.md` | Split local commits; campaign doc → PASS |
| Phase 4 | `docs/evidence/code/2026-11-15-phase4-push-and-optional-l5/OUTCOME.md` | Pushed to `origin/main` |
| Phase 5 | `docs/evidence/code/2026-11-15-phase5-l5-wire-and-optional-install/OUTCOME.md` | L5 W1 wire dialogue PASS |
| Phase 6 | `docs/evidence/code/2026-11-15-phase6-install-replace-closeout/OUTCOME.md` | `~/.local/bin` `8b86e521…` → `70787face…` |

Product tip (recovery fix): `6c2916864`  
Campaign BUILD_ID: `70787face…`

## Residual ledger (F2)

| Residual | Status | Next step |
| --- | --- | --- |
| Studio host E2E / gitlink | **OPEN** | Separate Studio contract; `studio-land-discipline` |
| Extra `live_interactive_dialogue` wire cases (soak / restart / effort / …) | **OPEN** | Named Phase 5 E6-style run |
| Post-install GUI disconnect smoke | **CLOSED-PASS** | Phase 8 V1; `docs/evidence/code/2026-11-15-phase8-post-install-gui-smoke/OUTCOME.md` |
| Full `shipped_tui_e2e` / multi-platform matrix | **OPEN** | Separate verification epic |
| `delayed_catalog` flake | **OPEN** | Separate fix + evidence; not claimed fixed |

## F5 / F6 / F7

| ID | Status |
| --- | --- |
| F5 post-install GUI smoke | **SKIP** in Phase 7; **PASS in Phase 8** |
| F6 extra wire cases | **SKIP** |
| F7 Studio | **SKIP** (requires separate contract) |

## Explicitly not claimed

- Studio host E2E or gitlink land.
- Full `shipped_tui_e2e` / multi-platform matrix.
- `delayed_catalog` flake fixed.
- That first-pass kimi CL FAIL×3 never occurred.
- That Phase 7 itself ran post-install GUI smoke (Phase 8 did).
- That a next product epic has started.

## Short report

```text
阶段：phase7-campaign-final-closeout
F0：HEAD=df247a883；install_BUILD_ID=70787face…；drift=无
战役判定：CLOSED-PASS
残留：Studio；其它 wire；shipped_tui_e2e；delayed_catalog（安装后 GUI 冒烟→Phase8 PASS）
F5冒烟：SKIP（Phase8 后补 PASS）
推送：OK；origin/main@8579d4254
证据：docs/evidence/code/2026-11-15-phase7-campaign-final-closeout/OUTCOME.md
```
