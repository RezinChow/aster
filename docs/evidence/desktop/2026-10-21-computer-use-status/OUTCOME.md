# Computer use settings status

Date: 2026-10-21. Hermetic checks only. The open Aster process was not rebuilt.

## Result

通用设置 has one permissions group. The row is 电脑操控权限 / Computer use permission.

The switch writes only `app.permissions.computer_use`. It does not create `capabilities/computer-use-runtime`.

The status line reads that boolean and the Tauri command `computer_use_runtime_present`. The command uses the same tenant directory as the agent plane. It reports whether `capabilities/computer-use-runtime` is a regular executable. A missing file, a directory, or a symlink is not a runtime. The command does not spawn the file.

A missing host, a thrown command, or any value other than boolean true is the absent state.

| State | Sentence |
| --- | --- |
| Permission off | 会话不提供截图、点击或输入。 |
| Permission on, runtime absent | 未安装运行时，会话不提供截图、点击或输入。 |
| Permission on, runtime present | 会话可以提供截图、点击或输入。这不表示本机辅助功能已经授权，也不表示点击会成功。 |

The English copy is the same three facts. The present sentence does not mean Accessibility is granted, and it does not mean a click will succeed.

Admission is unchanged. A session still offers screenshot, click, and type only when the permission is true and that executable is registered.

## Commands

From the repository root, with the pinned Cargo on `PATH`:

```
cargo test -p a3s-studio --lib -- computer_use
```

From `apps/studio`:

```
./node_modules/.bin/vitest run --project renderer src/renderer/pages/settings/aligned/__tests__/ComputerUsePermission.test.tsx
```

| Command | Result |
| --- | --- |
| `a3s-studio` lib, `computer_use` | 4 passed, 0 failed, 907 filtered out, 26.61s. The names are `admit_session_tools_keeps_computer_use_only_when_permitted_and_registered`, `a_session_is_not_offered_computer_use_without_permission_or_a_runtime`, `a_registered_runtime_offers_screenshot_click_and_type_without_moving_the_pointer`, and `computer_use_status_reads_the_executable_without_spawning_it`. The crate compile finished in 6m 18s after waiting on the workspace Cargo lock. |
| vitest renderer, the switch file | 4 passed. The same run also included `GeneralSettings.test.tsx` because the row is mounted there: 2 passed. Together, 2 files, 6 passed, 6.18s. |

## Explicitly not claimed

- A live click, a real screenshot, or moving the desktop pointer. Accessibility was not granted. `A3S_GUI_ALLOW_MOUSE` was not set.
- The open Aster pid 60480 and the debug Studio pid 60460 were not signaled. This source is not what those processes are running.
- WorkBuddy, `~/.workbuddy/computer-use`, and injecting `mcp__computer-use__*`.
- The GUI catalog cases. This row does not make them runnable.
- Convergence tasks T011–T013, T015–T019, T021, T024, T025, T027, T028, T030, and T031.
- The three already-fixed defects: session delete reap, awaiting-form, and workspace skill activation. Those tests were not re-run.

## Joined directory check

One temporary tenant directory drives `computer_use_directory` and `admit_session_tools`. The desktop command resolves the process tenant directory and then calls `computer_use_directory`. The library test does not call that process-global lookup.

Permission off, including when a regular executable is present, is Off and offers no screenshot, click, or type. Permission on with a missing file, a directory, a non-executable file, or a symlink is Absent and offers none of those three. Permission on with a regular executable is Present, and admission offers screenshot, click, and type bound to that absolute file. The runtime script would touch a marker file. That marker stayed absent. The permission commit's snapshot contains only `app.permissions.computer_use`.

| Command | Result |
| --- | --- |
| `cargo test -p a3s-studio --lib -- computer_use` | 5 passed, 0 failed, 908 filtered out, 19.67s. Compile finished in 12m 21s after waiting on the workspace Cargo lock. Passed names include `computer_use_settings_and_admission_agree_without_spawning_the_runtime`, `a_session_is_not_offered_computer_use_without_permission_or_a_runtime`, `admit_session_tools_keeps_computer_use_only_when_permitted_and_registered`, `computer_use_status_reads_the_executable_without_spawning_it`, and `a_registered_runtime_offers_screenshot_click_and_type_without_moving_the_pointer`. |
| vitest renderer, `ComputerUsePermission.test.tsx` | 5 passed, 0 failed, 5.56s on the first run and again with the verbose reporter. One case for each English sentence, one case that renders the three zh-CN sentences, and the switch write. The log line is `preference=app.permissions.computer_use invoke=computer_use_runtime_present:no-path`. |

## Explicitly not claimed

This rerun does not claim a live click, Accessibility, WorkBuddy, the GUI catalog, convergence tasks T011–T013, T015–T019, T021, T024, T025, T027, T028, T030, and T031, or a re-run of session delete reap, awaiting-form, and workspace skill activation. `A3S_GUI_ALLOW_MOUSE` was not set. Aster pid 60480 and Studio pid 60460 were not signaled.

## Re-verification 2026-10-22

`cargo test --locked -p a3s-studio --lib` with filters
`computer_use knowledge_compile_session personal_report dock_reopen_shows_the_main_window hides_on_close_only_when_the_tray_is_on model_list_urls_follow_the_catalog_base`:
11 passed, 0 failed (902 filtered out). Renderer suites for the settings
surfaces (GeneralSettings, settings/aligned) passed in the 465-test batch.
The task-catalog python checks (`cua_guard_test`, `window_runtime_test`)
passed 30/30 under python 3.13.
