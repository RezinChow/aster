# Session lifecycle, skill roots, and computer-use offer

Date: 2026-10-21. Four desktop-host and harness defects now have hermetic tests on the product path.

## Result

Archiving a session stops that session's agent child, including a child that is idle between turns, and releases a lock the child held. Messages and the session directory remain. Permanent delete stops an idle child and removes that session's messages and private folder. A resident session is refused for both actions, and its child is left running. A batch that contains any resident id kills nobody.

A form wait becomes a terminal error, the assistant message leaves pending, and the execution leaves awaiting-form, when the wait passes the same 1800s bound used for questions, when the agent process exits during the wait, or when the host starts with that execution still marked live or unknown and no in-memory turn owns it. Startup recovery changes the execution's observed time. A form still inside the bound with a live process stays awaiting-form. After the terminal error the same session accepts another turn.

Workspace and home skill roots are the same five directories: `skills`, `.a3s/skills`, `.agents/skills`, `.claude/skills`, and `.codex/skills`. The Skill tool returns the package body from a workspace root and from a home root. An untrusted configuration skill directory outside the repository stays unloaded. A missing Skill name keeps its failure text on the tool result. An empty failure still has no raw payload.

When computer-use permission is off, or it is on and no computer-use runtime is registered, `session/new` does not offer a computer-use tool or connector. The production runtime flag stays false, so a true preference still drops the offer. No screenshot, click, or type driver was added. A `tools.json` file with no plugin-selection record is still refused and does not launch. That refusal was left as it was.

## Validation

Commands ran from the repository root with the pinned toolchain. Filters after `--` are OR. Counts are from the captured logs.

| Command | Result |
| --- | --- |
| `cargo test -p a3s-studio --lib -- session_reap_tests archiving_a_live_task_stops_the_child` | 7 passed, 0 failed, 892 filtered out, 2.29s |
| `cargo test -p a3s-studio --lib -- form_settle orphan_recovery` | 6 passed, 0 failed, 897 filtered out, 4.86s |
| `cargo test -p a3s-code-core -p a3s-code-acp --lib -- skill_tool_returns_workspace untrusted_directories_must_stay workspace_and_home_skill_roots watched_skill_dirs configured_skill_directory test_skill_tool_execute_errors tui_mappings_cover_cards` | acp 4 passed, 0 failed, 354 filtered out; core 3 passed, 0 failed, 5285 filtered out |
| `cargo test -p a3s-studio --lib -- a_session_is_not_offered_computer_use admit_session_tools a_failed_tool_keeps_a_string_raw missing_selection_refuses_legacy` | 4 passed, 0 failed, 902 filtered out, 0.77s |
| `cargo fmt -p a3s-code-acp -p a3s-code-core -p a3s-studio -- --check` | exit 0 |

The skill log also contains an earlier run of the same core and acp filters without `tui_mappings_cover_cards`: acp 3 passed and core 3 passed. The later run is the one after formatting. `tui_mappings_cover_cards_catalog_and_questions` asserts that a failed Skill keeps the text `Skill 'missing-skill' not found` on the raw tool result, and that an empty failure does not.

## Abandoned alternative

Offering a hand-written `tools.json` when no plugin selection exists would let the computer-use filter run on that list. The existing admission test requires that case to fail the turn. The filter is applied to the connector list that `session/new` actually sends, and the legacy-tool refusal stays.

## Explicitly not claimed

- The AsterDream A01–A51 GUI catalog was not run.
- Computer-use was not driven. Accessibility was not granted. No screenshot, click, or type action was performed.
- The legacy host was not built or tested.
- The host asset catalog can still name a connector file that is not placed on `mcpServers`.
- No computer-use runtime is registered. The keep branch is covered only by calling the filter with that flag forced true.
