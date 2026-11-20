# T2026-11-17 H6 — Studio/ACP `toolUseId` plumb

## Intent
Close defect H6: `background_task_event` omitted `toolUseId`, so Studio board could not dedupe against the parent Task/background tool part (duplicate subagent UI).

## Change
1. ACP `TurnState` tracks `open_spawn_tool_id` for in-flight `task`/`background` tools and `subagent_parent_tool` map.
2. `subagent_spawned` / `subagent_progress` / `subagent_finished` wire now include `toolCallId` when known.
3. Studio `background_task_event` copies `toolCallId`/`tool_call_id`/`toolUseId` → `toolUseId`; task-event merge preserves an earlier `toolUseId`.
4. H5 root cause: ACP `subagent_type` (agent name) was wrongly written as Studio `taskType`. Now maps `local_bash`→`taskType=local_bash`, other agents→`taskType=subagent` + `subagentType=<agent>`. Board filter also accepts `subagentType`.

## Verification
- `cargo test --locked -p aster-acp --lib usage_meta_tests::spawn_parent_tools_are_task_and_background_only` → ok
- `cargo test --locked -p aster-acp --lib emit::tests::subagent_finished_wire_copies_parent_tool_call_id` → ok
- `cargo check --locked --lib` in `apps/studio/src-tauri` → Finished
- Studio `cargo test … background_task_updates_retain` blocked by pre-existing missing fixture `include_bytes!` paths (not introduced by this change)

## Explicitly not claimed
- Not headed Studio GUI e2e of board↔footer dedupe
- Not H2 Studio push / gitlink land
- Not Meta Harness overall Pass; H6 is one user-felt knife
- Push not authorized
