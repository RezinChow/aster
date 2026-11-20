# T2026-11-17 A5 — hard-deny nested `task` via scoped_tools

## Change
`TaskExecutor` child install refuses workflow-scoped tools named `task`
(soft omit of the built-in was bypassable via `with_scoped_tools`).

## Command
```bash
cargo test --locked -p aster-core --lib scoped_tools_reject_nested_task_name
# ok · 1 passed
```

## Explicitly not claimed
- MCP/dynamic tools projecting other delegation aliases
- Meta Harness Done / product Pass
