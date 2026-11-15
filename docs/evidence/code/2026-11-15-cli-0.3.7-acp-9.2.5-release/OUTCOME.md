# CLI 0.3.7 / Core+ACP 9.2.5 — release preparation + publish closeout

Date: 2026-11-15 (Asia/Shanghai).  
Contracts:

- `docs/implementation-prompt-aster-cli-0.3.7-acp-9.2.5-release.md` (R0–R4)
- `docs/implementation-prompt-aster-cli-0.3.7-publish-closeout.md` (P0–P6)

## R0–R3 preparation

| Check | Result |
| --- | --- |
| Recovery ancestor `6c2916864` | yes |
| Prior published window | `aster-cli-v0.3.6` / `aster-acp-v9.2.4` @ `e74ecd8d9` (no recovery) |
| Version bump | aster `0.3.7`; core/acp `9.2.5` (+ matching `Cargo.lock` path package versions) |
| `RELEASE_9.2.5.md` | written |
| `cargo build --locked -p aster -p aster-acp` | PASS |
| utf8 hermetic | PASS |
| `aster_spawn::transport_tests` | 5 PASS |
| `tests/release_governance.py` | 16 OK |

## R4 land

| Item | Value |
| --- | --- |
| Push | **OK** `e0253bb72..1a8e38d51` → `origin/main` |
| SHA | `1a8e38d51747e91a44ec11385fdea8fd4f8f6225` |
| `qualify-aster-cli` | **success** — https://github.com/aster-ai-lab/aster/actions/runs/43691256330 |
| `qualify-code` (Qualify aster) | **success** — https://github.com/aster-ai-lab/aster/actions/runs/43691256356 |

## P0–P1 tags

| Item | Value |
| --- | --- |
| Tag SHA | `1a8e38d51747e91a44ec11385fdea8fd4f8f6225` |
| `aster-acp-v9.2.5` | pushed |
| `aster-cli-v0.3.7` | pushed |

## P2 builds

| Workflow | Result |
| --- | --- |
| `release-code` / ACP | **success** — https://github.com/aster-ai-lab/aster/actions/runs/43696393276 |
| `release-aster-cli` | first pass **failure** on `linux` (build step; logs expired); **`gh run rerun --failed` → success** — https://github.com/aster-ai-lab/aster/actions/runs/43696393215 |

## P3–P5 publish + channel

| Item | Value |
| --- | --- |
| CLI Release | **published** (not draft) — https://github.com/aster-ai-lab/aster/releases/tag/aster-cli-v0.3.7 |
| ACP Release | **published** — https://github.com/aster-ai-lab/aster/releases/tag/aster-acp-v9.2.5 |
| Assets | macos / linux / linux-arm64 / windows / kylin-x86_64 (+ `latest.json`); kylin SHA == linux |
| Channel | **OK** — `release-aster-cli-channel.yml` run https://github.com/aster-ai-lab/aster/actions/runs/43716560404 ; `aster-cli-stable/latest.json` → `version=0.3.7` / `tag=aster-cli-v0.3.7` |
| `--latest=false` | observed on CLI create/edit |

Runtime (not committed): `.runtime/tui-full-e2e/cli-0.3.7-publish-20261115/evidence/`.

## Explicitly not claimed

- That every installed `0.3.6` client has already updated (users must `aster update` / reinstall).
- Studio desktop release synced to this CLI tip.
- Full `shipped_tui_e2e` / `delayed_catalog` fixed.
- That the first linux job failure root-cause log was retained (BlobNotFound); rerun succeeded.

## Short report

```text
阶段：cli-0.3.7-publish-closeout
P1-tag：OK；SHA=1a8e38d51
P2构建：cli=success(rerun)；acp=success
P3-CLI-Release：OK；url=https://github.com/aster-ai-lab/aster/releases/tag/aster-cli-v0.3.7
P4-ACP-Release：OK；url=https://github.com/aster-ai-lab/aster/releases/tag/aster-acp-v9.2.5
P5-channel：OK；stable→0.3.7
证据：docs/evidence/code/2026-11-15-cli-0.3.7-acp-9.2.5-release/OUTCOME.md
```
