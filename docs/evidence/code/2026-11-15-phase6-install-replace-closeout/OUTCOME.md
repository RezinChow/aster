# Phase 6 — install replace closeout

Date: 2026-11-15 (Asia/Shanghai).  
Contract: `docs/implementation-prompt-aster-phase6-install-replace-closeout.md`.

## I0 hygiene

| Check | Result |
| --- | --- |
| HEAD (pre-evidence commit) | `3febd341ff7626d8e8abfd9110f50de98941f72b` |
| Profile | `dev` / `target/debug` |
| DST_DIR | `/Users/roylin/.local/bin` |
| src BUILD_ID | `aster-cli-pair-v1:70787faceda1b14fddf4bb165f8947e062a5c429:aarch64-apple-darwin` (aster == aster-acp) |
| dst before | `aster-cli-pair-v1:8b86e5216923a7c6c2be82701f0caf1914dae2e9:aarch64-apple-darwin` |

Runtime logs (not committed): `.runtime/tui-full-e2e/phase6-install-20261115/evidence/`.

## I1–I2 install + smoke

| Check | Result |
| --- | --- |
| `cp -f target/debug/aster{,-acp} → DST_DIR` | **OK** |
| dst after BUILD_ID | `70787face…` (matches src for both binaries) |
| `command -v aster` / `aster-acp` | `/Users/roylin/.local/bin/aster{,-acp}` |
| PATH-resolved `--build-id` | matches dst after |
| `--help` smoke | OK (both) |

## I5 / I6 / I7

| ID | Status |
| --- | --- |
| I5 GUI disconnect smoke | **SKIP** (not named) |
| I6 extra wire cases | **SKIP** |
| I7 Studio | **SKIP** |

## Explicitly not claimed

- Every `aster` copy on the machine was replaced (only `DST_DIR` pair).
- Release-channel / GitHub Release assets updated (local debug pair copy).
- Studio / full `shipped_tui_e2e` / other wire cases.
- Post-install full GUI campaign re-run.
- `delayed_catalog` flake fixed.

## Short report

```text
阶段：phase6-install-replace-closeout
I0：src=70787face…；dst_before=8b86e521…
I1安装：OK；DST=/Users/roylin/.local/bin；dst_after=70787face…
I2冒烟：OK
I5-GUI：SKIP
推送：（见 I4）
证据：docs/evidence/code/2026-11-15-phase6-install-replace-closeout/OUTCOME.md
未做：Studio；其它 wire 案；安装后 GUI 冒烟
```
