# Aster 深度多轮 / 复杂长程 E2E — OUTCOME（2026-11-16 复跑）

Date: 2026-11-16 (Asia/Shanghai).  
Contracts:

- `docs/implementation-prompt-aster-long-horizon-complex-agent-desktop-e2e.md`
- `docs/evidence/code/2026-11-16-long-horizon-complex-e2e/E2E-TEST-PLAN.md`
- Baseline plan: `docs/evidence/code/2026-11-15-long-horizon-complex-e2e/E2E-TEST-PLAN.md`

**Campaign verdict: PASS** — L0–L2 + L3(C4/H1/H3/AL/CL) + L4 on `kimi-01/k3.1-pro` against dirty checkout HEAD `291c2afaf` (absorb+wiring uncommitted). L5 not re-run (disclose).

## Environment

| Item | Value |
| --- | --- |
| HEAD | `291c2afafdced86087dc7c0e8d7e1bed5b24ac04` (dirty tree; absorb/wiring WIP) |
| OS / toolchain | Darwin arm64; `1.97.1-aarch64-apple-darwin` |
| Pair BUILD_ID | `aster-cli-pair-v1:761d7f8aa9d7f97a184eef7f0ee27fc7b3f84773:aarch64-apple-darwin` |
| Staged bins | `.runtime/tui-full-e2e/long-horizon-complex-agent-desktop-20261116/bins/` |
| agent-desktop | CLI `2.5` / app `1.0.2`; accessibility + screen_recording **granted** |
| Primary model | `kimi-01/k3.1-pro` via private `.runtime/…/config.kimi01.acl` (keys not in docs) |

## L0 / L1

| Gate | Result |
| --- | --- |
| Pair build + BUILD_ID match | PASS |
| `three_turns_fix_the_bug_they_diagnosed` | PASS |
| `long_task_repairs_the_check_after_a_failure` | PASS |
| `fragmented_utf8_session_new_survives_outbound_interleave` | PASS |
| `aster_spawn::transport_tests` | 5 PASS |

Evidence: `…/evidence/r0-*.txt`, `l0-build.log`, `l1-*.log`, `build-id-*.txt`.

## L2 — PTY 真模型

| Test | Result | Oracle excerpt |
| --- | --- | --- |
| `real_llm_tui_turns_fix_the_diagnosed_bug` | PASS (~159s) | `runs=DUAL-HOLD \| DUAL-HOLD \| DUAL-GATE-7K \| DUAL-GATE-7K`; distinct_runs=4 |
| `real_llm_tui_long_task_repairs_and_quotes_the_check` | PASS (~112s) | HOLD×3 then GATE; `fail_before_pass=true` |

Evidence: `…/evidence/l2-*.log`, `l2-model-pin.txt`.

## L3 — agent-desktop visual

| Case | Status | Notes |
| --- | --- | --- |
| C4 multiturn | PASS | HOLD→GATE; `fail_before_pass=true`; `pass_count=2` |
| H1 hard | PASS (1st) | HOLD→GATE; `pass=true` |
| H3 retrieval | FAIL then PASS | Attempt1: welcome OK but no tool facts / needle untouched (600s). Attempt2: welcome race (no `kimi` in wait). **Harness fix** then PASS: `RETRIEVE-GATE-9c2e`; decoy unchanged; search hist |
| AL compact | PASS | HOLD→GATE after `/compact`; `compact_hist_mentions_compact=true` |
| CL control-loop | PASS (1st, kimi) | R1–R3 OK; `pass=true` (`goal_out_written=false` disclosed) |

Harness optimization (test-only): `apps/aster/tests/visual_tui_harness/drive_lh_retrieval.py` — welcome accepts `kimi`; dump fail hist/runs/needle on retrieve-repair timeout.

Evidence: `…/evidence/c4-multiturn/`, `h1-hard/`, `h3-retrieval/` (+`h3-retrieval-retry`, `h3-retrieval-r2`), `al-compact/`, `cl-control-loop/`.

## L4 — 断连 / resume / 记忆

Session `945f835a-68e0-4b6f-b289-9d8f32e10ed1` from C4 workspace. Driver: `.runtime/…/drive_lh_fault_inject.py`.

| Case | Status |
| --- | --- |
| F1 | PASS |
| F2 | PASS (`inference_requests=0`; 1× `/v1/models`) |
| F3 | PASS (GATE remembered; files untouched) |

Evidence: `…/evidence/l4-fault/`.

## L5

Not re-run this campaign. Prior PASS on 2026-11-15 Phase 5 remains historical only — not claimed for this HEAD.

## Optimization landed

- `drive_lh_retrieval.py`: kimi-tolerant welcome + fail-oracle dumps (harness; does not weaken file GATE).

## Explicitly not claimed

- 产品 Pass / 日常稳定使用水位（HG3 仍待 commit/推送/发布）
- Studio CUA 长程
- L5 wire live dialogue on this HEAD
- Attempt1 H3 as PASS (failed; only r2 after harness fix claimed)
- Zero `/v1/models` on resume (1 catalog probe observed)
- Commit / push of dirty absorb tree
