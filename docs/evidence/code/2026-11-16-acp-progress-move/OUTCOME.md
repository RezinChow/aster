# ACP subagent_finished: move ChildProgress fields

Date: 2026-11-16.
Branch: `main` @ dirty.

## Change

`subagent_finished_update` takes `ChildProgress` by value and moves
`command`/`disposition` into the wire object (no second String clone).
`ChildProgress` is `Clone` for map lookup fallback + tests.

≠ named YOLO Done.

## Commands / counts

```text
cargo test --locked -p aster-acp --lib bash_terminal_events_preserve
# → 1 passed
```

## Explicitly not claimed

- Named YOLO Done / Meta Harness Pass.
