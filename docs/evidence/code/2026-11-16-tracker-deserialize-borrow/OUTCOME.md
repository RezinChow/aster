# Tracker: deserialize &Value + ToolCallId as_ref lookup

Date: 2026-11-16.
Branch: `main` @ dirty.

## Change

- `extract_bash/grep/listdir` use `ToolOutput::deserialize(&Value)` (no `val.clone()`).
- `handle_tool_call_update` suppressed/bg lookups use `tool_call_id.0.as_ref()`.
- `route_bg_task_stdout` map get uses `as_ref()`.

From hunt [hot-path clones](b5ce0627-01d7-41dc-b432-ccff376b1de0).

Skipped OpenAI `mem::take` on tool args: finalize still needs full `entry.2`.

≠ named YOLO Done.

## Commands / counts

```text
cargo test --locked -p aster-pager --lib acp::tracker  # 195 passed
```

## Explicitly not claimed

- Named YOLO Done; shell persist notification move (next knife).
