# TUI — tool-body `estimate_line_widths` borrow

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Named YOLO: core/acp/tui 极致优化.

## Change

`Read` / `ListDir` / `Other`/`Skill` / `WebFetch` / `WebSearch` / `Search` /
`UseTool` / `MemorySearch` / `BgTask` estimate paths borrow
content/output/url/query/pattern/command `&str` instead of `searchable_text()`
join+clone.

## Verification

```text
cargo test --locked -p aster-pager --lib estimate_line_widths_borrows → 2 passed
```

## Explicitly not claimed

- Product Pass / named YOLO Done / BlockContext Arc.
