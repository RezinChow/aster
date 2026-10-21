# Personal knowledge compile

Date: 2026-10-21. Hermetic checks only. The open Aster process was not rebuilt.

## Result

Personal vault `wiki/local` has two actions.

| Action | What runs |
| --- | --- |
| 开始编译 | Tauri `compile_personal_okf` calls `publish_note_bundle`. The extractor writes concept pages. Note bytes stay as they were. `index.md` is replaced only after the bundle check. No session is started. |
| 用模型重写 | Disabled until the dialog has at least one note pressed. Plan, then keep only those paths, pin, start a session whose description is `knowledge-compile`, and send a prompt that names only those paths. Release, remember, and accept follow. |

Release keeps a note when its live mtime is later than the pinned copy. Concept pages outside the plan are restored. Concept pages in the plan stay as rewritten.

Accept and the local compile report each return a file row: path, status, reason. A failed row reads the reason from `WorkspaceReport.failure_reasons`. The dialog lists skipped and failed rows. Closed reasons stay `empty`, `over_depth`, `over_size`, `over_count`, `encoding`, `frontmatter`, `missing concept`, and `concept name already used`.

The team encyclopedia dialog title in zh-CN is 团队百科. Saving a file outside `wiki` still calls `compile_workspace_okf` on its own. The documents page shows a failure count only when that summary contains `failed` greater than zero. A thrown command does not block the save and does not set the notice.

## Commands

From the repository root, with the pinned Cargo on `PATH`:

```
cargo test -p a3s-okf --lib personal::
cargo test -p a3s-studio --lib -- knowledge_compile_session personal_report_keeps_each_file_result
```

From `apps/studio`:

```
./node_modules/.bin/vitest run --project renderer src/renderer/pages/knowledge/__tests__/KnowledgeNotesPage.test.tsx src/renderer/pages/documents/__tests__/DocumentsPage.test.tsx
```

| Command | Result |
| --- | --- |
| `a3s-okf` `personal::` | 22 passed, 0 failed, 10 filtered out, 0.59s |
| `a3s-studio` lib, the two filters | 3 passed, 0 failed, 907 filtered out, 0.01s. The three names are `personal_report_keeps_each_file_result`, `a_knowledge_compile_session_stays_off_the_task_list`, and `a_personal_vault_session_stays_off_the_task_list`. |
| vitest renderer, the two files | 2 files, 52 passed. Knowledge notes 40. Documents page 12. Duration 7.98s. |

The studio lib compile finished in 48.00s before those 3 tests. `a3s-okf` had waited on the build lock and then compiled in 1m 27s before its 22 tests.

## Explicitly not claimed

- The open Aster pid 60480, bundle `dev.a3s.studio.aster`, was not rebuilt, killed, or signaled. A click on 知识编译 in that window does not run this source.
- No live wiki click, no note-byte check on a real vault, and no second click on an unchanged vault.
- Concept prose, a model reply, and any grader score.
- Cloud encyclopedia, `a3s-drive://` compile, and K0.
- `apps/cloud` and the `apps/api` copy of the okf types. `failure_reasons` is on the root `crates/okf` report only.
- Merging workspace save compile and the personal button into one command.

## Re-verification 2026-10-22

`cargo test --locked -p a3s-okf --lib personal::`: 22 passed, 0 failed.
`cargo test --locked -p a3s-studio --lib` (combined filter with
knowledge_compile_session and personal_report): 11 passed, 0 failed.
Renderer suite for KnowledgeNotesPage passed in the 465-test batch.
