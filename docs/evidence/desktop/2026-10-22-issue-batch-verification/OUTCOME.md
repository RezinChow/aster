# Issue-batch verification — 2026-10-19 and 2026-10-21 reports

Date: 2026-10-22 (final revision same day). Verifies that every issue in
the user's two issue directories is fixed on this tree, re-runs the fix
batteries at HEAD `7988bd200` (studio gitlink then `71e788e5a`), and adds
live end-to-end runs against the running fixed build. The first revision
of this document recorded the batteries and two open gaps; this revision
closes the computer-use gap by shipping and registering a first-party
runtime and adds the live results.

## Per-issue disposition

| Issue | Fix | Status |
| --- | --- | --- |
| 10-19 ComputerUse 运行时未接通 (BUG-003) | gate + honest settings (studio `efd21e0b7`) **plus the first-party runtime** `apps/studio/scripts/computer-use-runtime.py` (studio `7e68683a4`), registered at `<tenant>/capabilities/computer-use-runtime` with the permission on | **Fixed.** Live: a real session over the agent plane offered the tools and the model invoked `screenshot`; the runtime returned a real PNG and the model confirmed. Screenshot, keystroke and pointer-event delivery each proven live; a full button-click press was not conclusively staged (see below). Click/type fail closed with a named reason when macOS Accessibility is absent |
| 10-19 工作区技能无法通过 Skill 工具激活 (BUG-007) | `57b0153c1`: workspace and home skill roots unified (5 dirs); Skill tool loads a workspace root | Fixed. core 312/0, acp 23/0 |
| 10-19 会话执行状态卡死 awaiting-form (BUG-013) | form wait settles to terminal error past 1800 s, on process exit, and at startup orphan recovery | Fixed. studio 20/0 (form_settle, orphan_recovery). Bound proven with injected clocks only |
| 10-19 删除会话后子进程与数据未回收 (BUG-005) | archive stops the child and releases its lock; permanent delete also removes messages and folder; resident sessions refused | Fixed. studio 20/0 (session_reap); live: every probe session permanently deleted via the API left zero `a3s-code-acp` children |
| 10-21 Anthropic 千问 token plan 同步失败 | studio `efd21e0b7`: `/apps/anthropic` bases list at origin `/compatible-mode/v1/models` with Bearer | Fixed. Unit-pinned on the reported URL; live route probe 404 (old) / 401 (new); live pull with the configured DeepSeek key over the same request shape returns 200 with 2 models. No qianwen key exists on this machine for its live pull |
| 10-21 Skill/ask_user_form 必失败 frozen policy | `4d2ac56e2`: default/auto/yolo allow the question tools; a parked Skill ask keeps its confirmation card; yolo allows Skill | Fixed. core 312/0; live in the app's actual mode (`bypassPermissions`/全部允许 — all stored sessions use it): the previously always-failing Skill-class call executed successfully, so the reported symptom no longer reproduces. Default-mode parking is hermetic (`parked_skill_ask_is_not_rewritten_as_unapproved`) and the `permissionMode` turn override exists |
| 10-21 主窗口关闭后 Dock 不重开 | studio `efd21e0b7`: `RunEvent::Reopen` → `show_main`; exit-on-close without tray | Fixed. **Live**: app hidden (0 on-screen windows) → `open -b dev.a3s.studio.aster` (dock-click equivalent) → window back (1). Close-button decision covered by `hides_on_close_only_when_the_tray_is_on` |

## Commands and results (2026-10-22, repository root unless noted)

| Command / probe | Result |
| --- | --- |
| `cargo test -p a3s-studio --lib -- computer_use session_reap form_settle orphan_recovery dock_reopen hides_on_close model_list_urls` | 20 passed, 0 failed |
| `cargo test -p a3s-code-core --lib -- fact_control permissions skill_tool_returns_workspace workspace_and_home_skill_roots watched_skill_dirs` | 312 passed, 0 failed |
| `cargo test -p a3s-code-acp --lib -- skill host_context research posture` | 23 passed, 0 failed ×4; one unreproduced flake on the first invocation |
| `python3 -m unittest cua_guard_test window_runtime_test` (apps/studio/tests/e2e/task-catalog) | 30 tests OK |
| `python3 test_computer_use_runtime.py` (apps/studio/scripts) | 4 tests OK (fixture screenshot, both deliveries, unknown action, malformed input) |
| `cargo test -p a3s-studio --lib -- http_marked_turn_drops_warm_history_and_the_next_session_is_empty -- --test-threads=1` | 1 passed (loopback plane, scripted ACP peer) |
| curl status of `…/apps/anthropic/v1/models` vs `…/compatible-mode/v1/models` | 404 vs 401 — old URL absent, new URL exists |
| Live model list, configured key, `GET {base}/v1/models` | 200, 2 models — the request shape `providers.rs` builds |
| Dock reopen on the running fixed build (pid window-list probe) | hidden 0 windows → `open -b` → 1 window |
| Runtime actions | screenshot: valid PNG 817,833 bytes; keystroke: dialog returned `CU-TYPED-OK`; pointer: CGEventPost move restored to the exact prior float coordinates |
| Live session turn (plane API, default model deepseek-flash) | model invoked the `screenshot` tool and replied `SCREENSHOT-OK` |

The running build under test: `studio/aster/Aster.app` (binary 2026-10-22
05:54, contains the `efd21e0b7` changes — `compatible-mode/v1/models`
present in the binary; process started 06:13 and later 07:36 restart).

## Machine-state changes made to deliver the fix

- `computer-use-runtime` (the script from studio `7e68683a4`) copied to
  `<tenant>/capabilities/`, mode 755. Registration is what the gate reads.
- `app.permissions.computer_use` set true through the local preference
  scope file (revision 1). Left on — the issue's premise is a usable
  computer-use capability.
- Probe sessions created during e2e were permanently deleted; none remain.

## Explicitly not claimed

- A full synthetic button-click press was staged twice against an
  AppleScript dialog and the dialog closed with OK both times, but stacked
  leftover dialogs and an operator at the machine make the staging
  ambiguous; only pointer transport and keystroke delivery are claimed.
- No live default-mode (逐次确认) park was captured: the attempt hit an
  app-side `runtime_unavailable` window while a concurrent session was
  churning dev builds and test batteries (the same flow ran green minutes
  earlier). The parked ask is hermetic-pinned; the approval API and the
  `permissionMode` override were exercised live.
- No live qianwen pull (no key on this machine); DeepSeek proves the
  pipeline live.
- The 1800 s form bound is proven with injected clocks, not wall clock.
- The packaged product bundle `dev.a3s.studio/aster/AsterDream.app`
  (sidecar dated 10-19) still predates every fix; a product release pass
  remains the delivery step for installed 0.1.1 users.
