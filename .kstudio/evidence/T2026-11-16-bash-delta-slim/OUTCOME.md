# Slim bash streaming delta (BashOutput defaults)

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Named YOLO: core/acp/tui 极致优化.

## Change

1. `BashOutput` terminal fields take `#[serde(default)]` so delta frames may omit them.
2. ACP `streaming_bash_delta` emits only `{ type, total_bytes, output_delta }`.

## Verification

```text
cargo test --locked -p aster-tools --lib slim_streaming_bash_delta_deserializes_with_field_defaults → ok
cargo test --locked -p aster-acp --lib tool_cards_use_pager_kind_and_raw_input → ok
```

## Explicitly not claimed

- Product Pass / named YOLO Done.
- Full bash coalesce + slim delta end-to-end FPS under headed Studio.
