# Phase 5 — L5 ACP wire (+ optional install skipped)

Date: 2026-11-15 (Asia/Shanghai).  
Contract: `docs/implementation-prompt-aster-phase5-l5-wire-and-optional-install.md`.

## E0 hygiene

| Check | Result |
| --- | --- |
| HEAD (pre-evidence commit) | `9dafed70ba0ff8ac6929d21abba69de04873cb07` |
| Pair build | PASS |
| Checkout BUILD_ID | `aster-cli-pair-v1:70787faceda1b14fddf4bb165f8947e062a5c429:aarch64-apple-darwin` (aster == aster-acp) |
| Installed `~/.local/bin/aster` | **旧** `aster-cli-pair-v1:8b86e5216923a7c6c2be82701f0caf1914dae2e9:aarch64-apple-darwin` — not used for L5 |

Runtime logs (not committed): `.runtime/tui-full-e2e/phase5-l5-20261115/evidence/`.

## E1 — L5 W1

| Item | Value |
| --- | --- |
| Test | `live_interactive_dialogue_real_llm::real_agent_holds_an_interactive_dialogue_over_the_wire` |
| Binary | cargo test `CARGO_BIN_EXE_aster-acp` (checkout), not `~/.local/bin` |
| ACL path role | `ASTER_CONFIG_FILE` → campaign `.runtime/…/config.kimi01.acl` (size/mtime recorded; keys not in docs) |
| Result | **PASS** (~132.79s) |
| Oracle excerpt | `MT_ROW id=acp_real_interactive_dialogue model=live verdict=6-turns+correction+cancel+continuity` |

Command:

```sh
cargo test --locked -p aster-acp --test live_interactive_dialogue_real_llm \
  real_agent_holds_an_interactive_dialogue_over_the_wire \
  -- --ignored --nocapture --test-threads=1
```

E6 extra wire cases: **SKIP**.

## E2 — long-horizon L5 line

`docs/evidence/code/2026-11-15-long-horizon-complex-e2e/OUTCOME.md` updated:
L5 W1 = PASS; short report `L5：PASS(W1；Phase5)`.

## E5 / E7

| ID | Status |
| --- | --- |
| E5 install replace | **SKIP** (not named) |
| E7 Studio | **SKIP** (out of contract) |

## Explicitly not claimed

- Install path replacement on the operator machine.
- Studio host E2E.
- Full `live_interactive_dialogue_real_llm` ignore suite (soak / restart / effort / …).
- Full `shipped_tui_e2e` / multi-platform matrix.
- That GUI agent-desktop and wire L5 share one model pin.
- `delayed_catalog` flake fixed.

## Short report

```text
阶段：phase5-l5-wire-and-optional-install
E0：BUILD_ID=70787face…；与安装对比=旧(8b86e521…)
E1-L5-W1：PASS
E2长程L5行：已更新
E5安装：SKIP
推送：OK；origin/main@d517b4405
证据：docs/evidence/code/2026-11-15-phase5-l5-wire-and-optional-install/OUTCOME.md
未做：安装替换；Studio；其它 wire 案
```
