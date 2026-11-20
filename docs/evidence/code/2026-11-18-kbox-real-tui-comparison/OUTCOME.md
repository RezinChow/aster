# T2026-11-18-kbox-real-tui-comparison

Updated: 2026-11-18 · scope: latest Aster Core/TUI on the original `kbox` workspace · **comparison complete** · **product convergence failed** · **≠ Meta Harness Done**

## Target and controls

Question for both sides: `分析下 ./kbox 技术架构`. The after side used
`deepseek/deepseek-flash`, Aster 0.4.0 / ACP 9.3.0, and the freshly built paired
binaries from this checkout:

- Build: `cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp` — **exit 0**.
- Pair BUILD_ID: `aster-cli-pair-v1:966a94ff8e07534ccc3fb2a601793fabb3fa8431:aarch64-apple-darwin`.
- Driver: `agent-desktop` operating Terminal and `artifacts/kbox-real-comparison/drive_latest.py`.
- Workspace: the original `/Users/roylin/code/kense`, analyzing `/Users/roylin/code/kense/kbox` read-only.
  **No kbox copy was created.** No commit, push, install, branch, or worktree was performed.

The baseline is the user-supplied live TUI screenshot, not a newly rerun old binary.
Its exact build and per-turn provider usage cannot be recovered from that image.

## Observed comparison

| Side | Observation window | First settled substantive answer | Tool waves / calls | TUI token display |
| --- | ---: | --- | --- | --- |
| Baseline screenshot | 736 s (12 min 16 s) | None visible at capture | Not recoverable from the screenshot | 216.8k, session-cumulative display |
| Latest soft-synthesis build | 600 s driver deadline | **None; timeout** | 13 execution groups; 15 calls = 9 bash + 3 read + 3 ls | 247.4k, session-cumulative display |

There is **no valid first-answer latency and no speedup ratio**: neither retained
comparison side produced a settled architecture answer inside its observation
window. The token displays are cumulative session counters, not proven per-turn
provider billing, and no answer-quality equivalence was established.

Primary records:

- Baseline: `artifacts/kbox-real-comparison/evidence/{baseline-screenshot.png,baseline-summary.json}`.
- Final after run: `artifacts/kbox-real-comparison/evidence/{after-soft-driver.log,after-history.txt,after-timeout-hist.txt}` and
  `artifacts/kbox-real-comparison/logs/after-soft/aster-acp.20775.log`.
- The final driver reported `FAIL no settled substantive architecture answer within 600s`;
  the terminal still showed `Working` / `[stop]` at 10 minutes.

## Parallel scheduling evidence

The earlier `logs/after/aster-acp.20775.log` contains three real `read` calls admitted
at `10:31:33.756445`, `.756903`, and `.757296`, then completed at `.757694`,
`.757927`, and `.758043`. This directly confirms overlapping read execution in the
new Core. It does **not** prove lower end-to-end latency.

## Discarded and intermediate attempts

- The apparent 117.832 s answer was a **driver false positive**: the captured screen
  still had an active command and `[stop]`. Its records are isolated as
  `evidence/invalid-attempt1-*`. The stale `after-summary.json` / `after-driver.log`
  contain the same invalid value and were not used for comparison.
- One intermediate run was cancelled after an early `bash` response disabled the
  former soft-synthesis policy; it is not a valid performance sample.
- The intermediate hard-finalization build also reached the 600 s deadline without
  an answer (`after-final-driver.log`, `logs/after-final/`). It was replaced by the
  final one-shot soft-synthesis prompt, which keeps tools available.

## Final focused verification

`cargo test --locked -p aster-core --lib agent_api::tests::read_only_delivery` —
**2 passed / 0 failed** on the final soft-synthesis semantics. These deterministic
E2E tests use a real AgentSession, real file reads, and real task delegation with a
scripted model; they are not live latency evidence.

## Explicitly not claimed

- No latency improvement, token reduction, speedup percentage, or answer-quality
  parity is claimed. Parallel tool scheduling worked; the real task still did not converge.
- No claim that a one-shot prompt is a sufficient convergence policy. A further fix
  needs intent-bound staged synthesis and a new real-provider comparison; repeated
  runs of the unchanged mechanism are not evidence.
- No kbox source modification or copy, broad product Pass, Meta Harness Done,
  Windows native check, release, commit, or push.
