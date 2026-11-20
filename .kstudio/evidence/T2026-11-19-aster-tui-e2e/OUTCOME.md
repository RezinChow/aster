# T2026-11-19-aster-tui-e2e

Updated: 2026-11-19T09:52:20+08:00 · scope: latest Aster TUI deterministic and one real-model end-to-end verification · **70 deterministic checks + real HI/quit passed** · **≠ product Pass**

## Result

The latest paired Aster binaries completed both deterministic PTY/TUI suites and a real Terminal interaction driven by `agent-desktop`.

- Deterministic suites: **70 passed, 0 failed, 1 ignored**, across `unattended_e2e`, `shipped_tui_e2e`, and `tui_913_hermetic`.
- Real model: one `HI` turn on `deepseek/deepseek-flash` produced a substantive answer in **8.501 seconds**, with **0 tool calls**. The TUI main turn displayed `Worked for 3.4s`.
- `/quit` saved the session and ended the process. Terminal history and the screenshot both contain `Saving session...completed.` and `[进程已完成]`.
- Build identity was identical on both binaries: `aster-cli-pair-v1:c83a619afce597ef17ac56e22eef2e46ea970e99:aarch64-apple-darwin` (`aster 0.4.0` / `aster-acp 9.3.0`).

No production source was changed in this TUI settlement. Two test-harness defects were fixed:

1. The long-task mock treated the pre-analysis request as the product turn because both carry the original prompt. It now returns the required GeneralPurpose JSON before the scripted read sequence.
2. The expansion test counted the pre-analysis call and first tool call as the post-approval response, read the receipt too early, and panicked. Destroying the TUI then produced the misleading approved-then-cancelled receipt. It now waits for the original prompt's actual ACP settlement before checking the successful receipt.

These were harness synchronization fixes, not product behavior changes or weakened assertions.

## Deterministic verification

```bash
python3 scripts/verify-pty-e2e.py \
  --suite shipped_tui_e2e \
  --suite tui_913_hermetic \
  --suite unattended_e2e \
  --out artifacts/tui-e2e-2026-11-19/deterministic-summary.json \
  --log-dir artifacts/tui-e2e-2026-11-19/deterministic-logs
```

Observed totals:

| Suite | Passed | Failed | Ignored |
| --- | ---: | ---: | ---: |
| unattended_e2e | 33 | 0 | 0 |
| shipped_tui_e2e | 26 | 0 | 1 |
| tui_913_hermetic | 11 | 0 | 0 |
| **Total** | **70** | **0** | **1** |

The initial run had 68 passed / 2 failed. Its failures are preserved in `deterministic-first-failures.json`, `shipped-first-failure.log`, and `tui913-first-failure.log`; they are not the final result.

## Real Terminal verification

Driver: `artifacts/tui-e2e-2026-11-19/drive_live_hi.py`, using the current `target/debug` pair in an isolated workspace inside the repository. No external workspace was modified and no kbox copy was created.

Primary evidence:

- `live-answer-history.txt` and `screens/live-answer.png` — user `HI`, assistant answer, `Worked for 3.4s`, settled composer, and 12.1k cumulative display tokens.
- `live-quit-history.txt` and `screens/live-after-quit.png` — resume instruction, completed save, and process completion.
- `live-logs/aster-acp.20776.log` — zero logged tool executions.
- `live-summary.json` — original driver result with first-answer timing and its `quit_failed` classification.
- `independent-verification.json` — independent M review confirming answer and process exit.

The original driver required `/quit` text and composer placeholders to remain visible. Terminal restored the shell on process completion, so that condition produced a false negative. The original summary and grader were retained; no real-model rerun or grader edit was used to manufacture a pass. Independent acceptance uses the stronger direct process-completion evidence.

## Static checks

- `cargo clippy --locked -p aster-acp --all-targets --no-deps`: **exit 0** (`acp-clippy-final.log`).
- Final paired build: **exit 0** (`paired-build-final.log`), followed by identical `--build-id` output from both binaries.
- `git diff --check`: **exit 0** for Core/ACP sources, ACP tests, and this evidence directory.
- `cargo fmt --all -- --check`: **exit 1 only for the pre-existing `crates/code/core/examples/terminal_bench_runner.rs` edits** (`fmt-final.log`); no Core/ACP source or ACP test formatting difference was reported. The existing file was preserved.

## Explicitly not claimed

- One real `HI` turn is not a latency SLO, statistical performance comparison, architecture-task proof, or product-wide Pass.
- The **12.1k** display is session-cumulative and not a per-turn billing record. USD/token cost is unavailable.
- No additional real architecture-analysis run, Windows native check, commit, push, install, release, branch, worktree, or external workspace edit was performed.
- Deterministic suites and one live terminal slice do not establish Meta Harness completion.
