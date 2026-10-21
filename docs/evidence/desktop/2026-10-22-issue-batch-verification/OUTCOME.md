# Issue-batch verification — 2026-10-19 and 2026-10-21 reports

Date: 2026-10-22. Verifies that every issue recorded in the user's two
issue directories is fixed on this tree, and re-runs the fix batteries at
HEAD `7988bd200` (studio gitlink `71e788e5a`).

## Per-issue disposition

| Issue | Fix | Verification |
| --- | --- | --- |
| 10-19 ComputerUse 运行时未接通 (BUG-003) | studio `efd21e0b7`: `session/new` offers screenshot/click/type only when `app.permissions.computer_use` is on AND `<tenant>/capabilities/computer-use-runtime` is a regular executable; settings row states all three cases; fail-closed | studio battery below; e2e py 30/30. **Capability gap remains**: no runtime is shipped or registered — see "Not fixed by code alone" |
| 10-19 工作区技能无法通过 Skill 工具激活 (BUG-007) | `57b0153c1`: workspace and home skill roots are the same five dirs (`skills`, `.a3s/skills`, `.agents/skills`, `.claude/skills`, `.codex/skills`); Skill tool returns the package body from a workspace root | core 312/0 (includes `skill_tool_returns_workspace`, `workspace_and_home_skill_roots`); acp 23/0 |
| 10-19 会话执行状态卡死 awaiting-form (BUG-013) | form wait settles to a terminal error past the same 1800 s bound as questions, on agent-process exit, and at host startup via orphan recovery; the next turn is accepted | studio 20/0 (includes `form_settle`, `orphan_recovery`) |
| 10-19 删除会话后子进程与数据未回收 (BUG-005) | archive stops the session's child (idle included) and releases its lock, keeps messages/dir; permanent delete also removes messages and the private folder; resident sessions are refused; recorded pids are SIGKILLed by command-line match | studio 20/0 (includes `session_reap`) |
| 10-21 Anthropic 千问 token plan 同步模型失败 | studio `efd21e0b7`: an Anthropic base whose path ends `/apps/anthropic` lists models at the same origin `/compatible-mode/v1/models` with a Bearer header | `model_list_urls_follow_the_catalog_base` pins the reported URL; live probe below confirms the route |
| 10-21 Skill 与 ask_user_form 必失败 frozen policy | `4d2ac56e2`: `policy_for_posture` allows `ask_user`/`ask_user_form` on default/auto/yolo (plan denies both); a parked Skill ask keeps its confirmation card instead of being rewritten `tool_effect_effective_arguments_unapproved` | core 312/0 (fact_control + permissions, includes `parked_skill_ask_is_not_rewritten_as_unapproved`) |
| 10-21 主窗口关闭后 Dock 图标不重开 | studio `efd21e0b7`: `RunEvent::Reopen` → `show_main`; close hides only with the tray on, otherwise exits | `dock_reopen_shows_the_main_window`, `hides_on_close_only_when_the_tray_is_on` in studio 20/0 |

## Commands (2026-10-22, repository root)

| Command | Result |
| --- | --- |
| `cargo test -p a3s-studio --lib -- computer_use session_reap form_settle orphan_recovery dock_reopen hides_on_close model_list_urls` | 20 passed, 0 failed |
| `cargo test -p a3s-code-core --lib -- fact_control permissions skill_tool_returns_workspace workspace_and_home_skill_roots watched_skill_dirs` | 312 passed, 0 failed |
| `cargo test -p a3s-code-acp --lib -- skill host_context research posture` | 23 passed, 0 failed ×4 runs; one unreproduced single-test flake on the first invocation |
| `python3.13 -m unittest cua_guard_test window_runtime_test` (apps/studio/tests/e2e/task-catalog) | 30 tests OK |
| `cargo test -p a3s-studio --lib -- http_marked_turn_drops_warm_history_and_the_next_session_is_empty -- --test-threads=1` | 1 passed (loopback agent plane, scripted ACP peer) |
| `curl -o /dev/null -w %{http_code}` `https://token-plan.maas.qianwenaiapi.com/apps/anthropic/v1/models` | 404 — the old URL does not exist |
| same, `https://token-plan.maas.qianwenaiapi.com/compatible-mode/v1/models` | 401 — the new URL exists and requires auth |

## Not fixed by code alone

- **Computer-use runtime**: the gate is honest and fail-closed, but no
  runtime executable ships with the app and none is registered on this
  machine, so sessions still report 未安装运行时. Choosing and shipping a
  runtime is a product decision, not a code repair.
- The fixes live on `main` source only. The installed AsterDream 0.1.1
  bundle predates all of them; a release/packaging pass is needed before
  the user-visible app carries these repairs.

## Explicitly not claimed

- No live Dock click on a running build (the installed app is 0.1.1;
  staging a window close needs Accessibility, which this host has not granted).
- No live model pull with a real key (no key available); the 404/401 probes
  check route existence only, without credentials.
- No live Skill confirmation card driven against a real model.
- The 1800 s form bound is exercised with injected clocks in tests, not by a
  wall-clock 30-minute wait.
