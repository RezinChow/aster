# OpenAI stream — tool-args take on Start (**reverted**)

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Named YOLO: core/acp/tui 极致优化.

## Attempt

`mem::take(&mut entry.2)` on first ready ToolUseStart to avoid cloning buffered
argument JSON into the Start/first InputDelta event.

## Result — **reverted**

`entry.2` must remain for `[DONE]` finalize `ToolUse { input: parse(args) }`.
Taking it left finalize with empty args → mock multi-turn TUI hung
(`three_turns_fix…` timed out on `"returns count * 3"`; screen showed mass
failed reads). Restored `entry.2.clone()` for the event.

## Still landed (unrelated)

- Finalize-path `take` of the whole `tool_calls` map / usage / response ids
  (`T2026-11-16-stream-finalize-take`) — after accumulation is complete.
- ToolUseStart **id** move when no buffered args (safe).

## Verification after revert

```text
cargo test --locked -p aster-core --lib streaming_tool_argument_deltas_emit_after_tool_start → ok
ASTER_*_BIN tui_913 three_turns_fix_the_bug_they_diagnosed → (recheck in flight)
```

## Explicitly not claimed

- Product Pass / named YOLO Done.
- Safe take of `entry.2` without a second accumulator (needs design).
