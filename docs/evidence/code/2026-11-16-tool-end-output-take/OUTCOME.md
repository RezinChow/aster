# Core — tool completion output take (drop triple-clone)

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Named YOLO: core/acp/tui 极致优化.

## Change

`tool_completion_runtime` takes `normalized.output` into `model_output` once.
Host `ToolEnd` clones output only when an event channel is present, and
**moves** `metadata` / `error_kind` into the event (was: clone from
normalized + clone for model + clone for ToolEnd + metadata clones).

## Verification

```text
cargo test --locked -p aster-core --lib tool_completion → 26 passed
cargo test --locked -p aster-core --lib completed_background_child_settles → ok
```

## Explicitly not claimed

- Product Pass / named YOLO Done.
