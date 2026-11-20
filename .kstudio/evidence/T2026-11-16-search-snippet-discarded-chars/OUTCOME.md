# E4 search snippet discarded_chars

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

`SourceSnippet` carries `discarded_chars` (chunk bytes minus rendered window).
Hybrid / semantic search metadata expose per-hit and aggregate
`discarded_chars` alongside existing `discarded_items`.

## Commands / counts

```text
cargo test --locked -p aster-core --lib -- search_snippet
# → 5 passed
cargo test --locked -p aster-core --lib -- enabled_session_exposes_and_executes_semantic_search
# → 1 passed
```

## Explicitly not claimed

- E4 Done / named YOLO Done / Meta Harness Pass.
