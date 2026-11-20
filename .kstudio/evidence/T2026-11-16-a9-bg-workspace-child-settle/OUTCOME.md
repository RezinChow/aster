# A9 — BG `execute_background*` owns/settles workspace_child

Date: 2026-11-16.  
Branch: `main`.  
Goal knife: Meta Harness **可信** (defect catalog A9 · reserve/settle slice).

## Change

Raw `execute_background_with_parent_cancellation` reserves a `workspace_child`
slot when the tool path did not already, and on every `running: false` exit
settles + takes the slot so completion cannot Allow against an unsettleable
writer. TaskTool’s pre-reserved path is unchanged (no double-own).

## Verification

```text
cargo test --locked -p aster-core --lib execute_background_settles_owned_workspace_child
→ ok
```

## Explicitly not claimed

- Product Pass / Meta Harness Done.
- Fan-out 500ms abort grace rewrite.
- Changing intentional Session-owned turn yield while reserved deferred BG live.
- Studio H2 land/push.
