# ACP — `ToolCallId` / `SessionId` without intermediate `String`

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Named YOLO: core/acp/tui 极致优化.

## Change

`ToolCallId::new` / `SessionId::new` take `impl Into<Arc<str>>`. Hot ask / replay /
command-announce paths now pass `&str` (or `as_str()`) instead of `to_string()` /
`clone()` into a temporary `String`.

Touched: `permission_ask.rs`, `extensions.rs`, `commands.rs`.

## Verification

```text
cargo test --locked -p aster-acp --lib permission_ask_records → (see pack log)
cargo test --locked -p aster-acp --test acp_conformance_stdio → 15 passed (prior this cycle)
```

## Explicitly not claimed

- Wire-format change / product Pass / named YOLO Done.
