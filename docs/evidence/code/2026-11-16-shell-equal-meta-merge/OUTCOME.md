# aster-shell: merge stream chunks with equal meta

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Named YOLO: core/acp/tui 极致优化.

## Change

`SessionPersistence::maybe_merge_notification` merges when `pending_chunk.meta == new_chunk.meta`
(not only when both are `None`). ACP `asterGenerationDelta` chunks now coalesce instead of
per-token `incoming.clone()` + flush.

## Verification

```text
cargo test --locked -p aster-shell --lib equal_aster_generation_delta_meta_merges_consecutive_chunks
→ ok
```

## Explicitly not claimed

- Product Pass / named YOLO Done.
- Live TUI FPS / storage write rate under production traffic.
