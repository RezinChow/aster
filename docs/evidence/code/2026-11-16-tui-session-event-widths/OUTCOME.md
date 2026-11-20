# TUI SessionEvent estimate_line_widths static / borrow arms

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

`RenderBlock::estimate_line_widths` for `SessionEvent` now covers additional
static / borrowed arms without calling `message()` (which allocates a fresh
`String`): TurnCancelled (no elapsed), TurnBlockedByHook, CompactionCancelled,
model-family switch CompactionStarted, ReAuthRequired, ContextTooLarge,
CompactStarted, DiskFull, MemoryCommandStarted, empty CompactionFailed,
HookAnnotation/Outcome, TurnFailed (no elapsed), ModelUnavailable (empty id).

## Commands / counts

```text
cargo test --locked -p aster-pager --lib estimate_line_widths_borrows_subagent -- --test-threads=1
# → 1 ok
```

Hermetic pack after change: **19 suites / 250 / 0**.

## Explicitly not claimed

- Named YOLO Done / Meta Harness Pass / HG2 Pass.
- All SessionEvent variants avoid message() (elapsed / format arms still allocate).
