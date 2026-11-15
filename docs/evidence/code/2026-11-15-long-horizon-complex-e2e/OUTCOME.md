# Aster 深度多轮 / 复杂长程 E2E — OUTCOME

Date: 2026-11-15 (Asia/Shanghai).  
Contracts:

- `docs/implementation-prompt-aster-long-horizon-complex-agent-desktop-e2e.md`
- `docs/evidence/code/2026-11-15-long-horizon-complex-e2e/E2E-TEST-PLAN.md`

Cross-refs:

- `docs/evidence/code/2026-11-15-agent-connection-recovery-agent-desktop/OUTCOME.md`
- DeepSeek visual LH precedents under `docs/evidence/code/2026-11-09-visual-lh-deepseek/`

**Campaign verdict: PASS** — L0–L2 + L3(C4/H1/H3/AL) + L4 green on
`kimi-01/k3.1-pro`. First-pass L3 **CL** failed three times on kimi (rows below
retained); **Phase 2** closed kimi CL with PASS×2 after harness timing fixes
(`docs/evidence/code/2026-11-15-phase2-kimi-cl-and-land/OUTCOME.md`). Deepseek CL
fallback from the first pass remains a valid contrast column. L5 not run.

## Environment

| Item | Value |
| --- | --- |
| HEAD | `e74809409957718b1154fd222e3f871429c82c6e` |
| OS / toolchain | Darwin arm64; `1.97.1-aarch64-apple-darwin` |
| Pair BUILD_ID | `aster-cli-pair-v1:b31e1b132dff9c9a02c53a98321760ba4ab59f43:aarch64-apple-darwin` |
| Staged bins | `.runtime/tui-full-e2e/long-horizon-complex-agent-desktop-20261115/bins/` |
| agent-desktop | CLI `2.5` / app `1.0.2`; accessibility + screen_recording granted |
| Primary model | `kimi-01/k3.1-pro` via private `.runtime/…/config.kimi01.acl` (`temperature=1`; keys not in docs) |
| Fallback (CL only) | `deepseek/deepseek-flash` + repo `.aster/config.acl` |

## L0 / L1

| Gate | Result |
| --- | --- |
| Pair build + BUILD_ID match | PASS |
| `three_turns_fix_the_bug_they_diagnosed` | PASS |
| `long_task_repairs_the_check_after_a_failure` | PASS |
| `fragmented_utf8_session_new_survives_outbound_interleave` | PASS |
| `aster_spawn::transport_tests` | 5 PASS |

Evidence: `…/evidence/r0-*.txt`, `l1-*.log`, `build-id-*.txt`.

## L2 — PTY 真模型（权威）

Invoked via `target/debug/examples/acl_env_config run` +
`ASTER_PINNED_MODEL=kimi-01/k3.1-pro` + staged bins; `--ignored --test-threads=1`.

| Test | Result | Oracle excerpt |
| --- | --- | --- |
| `real_llm_tui_turns_fix_the_diagnosed_bug` | PASS (~181s) | `runs=DUAL-HOLD \| DUAL-HOLD \| DUAL-GATE-7K \| DUAL-GATE-7K`; 4 distinct Runs |
| `real_llm_tui_long_task_repairs_and_quotes_the_check` | PASS (~138s) | `DUAL-HOLD`×3 then `DUAL-GATE-7K`; `fail_before_pass=true` |

Evidence: `…/evidence/l2-multiturn.log`, `l2-long-task.log`, `l2-model-pin.txt`.

## L3 — agent-desktop visual

Drivers under `apps/aster/tests/visual_tui_harness/`. Harness micro-patches for
this campaign (test-only): kimi-tolerant welcome wait in
`drive_lh_parallel_hard.py`; pause detection / retry / longer goal wait + fail
hist dump in `drive_control_loop.py`.

| Case | Model | Status | Oracle |
| --- | --- | --- | --- |
| C4 multiturn | kimi-01/k3.1-pro | PASS | HOLD then GATE×4; files `* 8` / `* 5`; `fail_before_pass=true` |
| H1 hard | kimi-01/k3.1-pro | PASS (2nd try) | HOLD→GATE; first try FAIL welcome race |
| H3 retrieval | kimi-01/k3.1-pro | PASS | `RETRIEVE-GATE-9c2e`; decoy unchanged; search hist |
| AL compact | kimi-01/k3.1-pro | PASS | HOLD→GATE after `/compact`; `compact_hist_mentions_compact` |
| CL control-loop | kimi-01/k3.1-pro | **FAIL**×3 | Attempt1: pause ack missing after progress; Attempt2/3: `/goal` no progress within 420–720s (`04-r2-goal-progress-fail-hist.txt` shows slash submitted, no Goal chrome) |
| CL control-loop | deepseek/deepseek-flash | PASS | R1–R3 all OK; `loop_out`/`goal_out` exact token; pause+resume+`--continue` |

Evidence roots:
`…/evidence/c4-multiturn/`, `h1-hard/`, `h3-retrieval/`, `al-compact/`,
`cl-control-loop/` (kimi fails), `cl-control-loop-deepseek/`.

## L4 — 断连 / resume / 记忆

Session `4cfc7a7a-cb75-49f2-8938-920f4e8566fa` from C4 workspace
(`workspaces/c4-multiturn/ws`). Driver:
`.runtime/…/drive_lh_fault_inject.py` (private).

| Case | Status | Notes |
| --- | --- | --- |
| F1 | PASS | SIGTERM ACP → `Agent connection closed` + log hint + same `--resume` id |
| F2 | PASS | Counting mock: `inference_requests=0`; 1× `GET /v1/models`; UI resumed |
| F3 | PASS | GATE present in resumed transcript; `rate.py`/`fee.py` unchanged after read-only probe |

Evidence: `…/evidence/l4-fault/`.

## L5

Not run (optional ACP wire live dialogue).

## Amendment / Phase 2 (2026-11-15)

First-pass kimi CL failures above are **not erased**. After triage classified the
pause/progress misses as harness timing (primary) with residual model flake,
`drive_control_loop.py` was hardened and kimi CL re-ran **PASS×2**. Details:
`docs/evidence/code/2026-11-15-phase2-kimi-cl-and-land/OUTCOME.md`.

Campaign-level CL for kimi is therefore **PASS** via that amendment; the FAIL×3
table remains the historical first-pass record.

## Explicitly not claimed

- That the first-pass kimi CL FAIL×3 never happened (rows retained above).
- Studio / LH01 OCI / GUI UTF-8 fragmentation.
- Hard proof of parallel subagent tool overlap (H1 = ordered HOLD→GATE).
- Zero total HTTP on F2 resume (catalog `/v1/models` observed).
- That F3 required a fresh model completion (GATE lines may already be in
  resumed Terminal history; file non-mutation is the hard oracle).
- Secrets / session-store bytes in this OUTCOME.
- Push / install replacement (Phase 3 lands local commits only unless otherwise
  authorized).

## Delivery short report

```text
战役：long-horizon-complex；模型=kimi-01/k3.1-pro（首次 CL 另栏 deepseek）
L0/L1：PASS / PASS
L2：MT=PASS LH=PASS
L3：C4=PASS H1=PASS H3=PASS AL=PASS CL=PASS(kimi Phase2×2；首次 FAIL 见正文)
L4：F1=PASS F2=PASS F3=PASS
L5：未跑
证据：docs/evidence/code/2026-11-15-long-horizon-complex-e2e/OUTCOME.md
补绿：docs/evidence/code/2026-11-15-phase2-kimi-cl-and-land/OUTCOME.md
未做/BLOCKED：L5；Studio
```

## Follow-on

Phase 3 land contract:
`docs/implementation-prompt-aster-phase3-land-recovery-and-closeout.md`.
