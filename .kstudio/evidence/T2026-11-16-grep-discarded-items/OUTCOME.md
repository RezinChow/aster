# grep search meta: discarded_items vocabulary

Date: 2026-11-16.
Branch: `main` @ dirty.

## Change

`grep_search_metadata` exposes `discarded_items`: `0` when the scan is complete,
`null` when truncated without a known drop count (paginated modes still use
`page.discarded_items`).

≠ E4 Done.

## Commands / counts

```text
cargo test --locked -p aster-core --lib tools::builtin::grep
# → 21 passed
```

## Explicitly not claimed

- E4 complete / named YOLO Done.
