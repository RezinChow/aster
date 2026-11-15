# CLI 0.3.7 / Core+ACP 9.2.5 — release preparation

Date: 2026-11-15 (Asia/Shanghai).  
Contract: `docs/implementation-prompt-aster-cli-0.3.7-acp-9.2.5-release.md`.

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

Runtime (not committed): `.runtime/tui-full-e2e/cli-0.3.7-release-20261115/evidence/`.

## R4 land

| Item | Value |
| --- | --- |
| Push | (filled after push) |
| SHA | (filled after push) |
| `qualify-aster-cli` | (pending / filled) |
| `qualify-code` | (pending / filled) |

## R5 / R6

| ID | Status |
| --- | --- |
| R5 tags | **SKIP** (not named) |
| R6 publish + channel | **SKIP** (not named) |

## Explicitly not claimed

- That `0.3.6` binaries include disconnect recovery.
- That tags `aster-cli-v0.3.7` / `aster-acp-v9.2.5` exist (until R5).
- That `aster-cli-stable` points at 0.3.7 (until R6).
- Studio / full `shipped_tui_e2e` / `delayed_catalog` fixed.

## Short report

```text
阶段：cli-0.3.7-acp-9.2.5-release
R1版本：aster=0.3.7；acp/core=9.2.5
R4：SHA=…；qualify-cli=…；qualify-code=…
R5-tag：SKIP
R6发布：SKIP
证据：docs/evidence/code/2026-11-15-cli-0.3.7-acp-9.2.5-release/OUTCOME.md
```
