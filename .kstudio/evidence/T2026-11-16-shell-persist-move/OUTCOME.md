# Shell persist: ACP notification merge by value (no hot-path clone)

Date: 2026-11-16.
Branch: `main` @ dirty.

## Change

`maybe_merge_notification` takes ownership; drain/write paths move into
`SessionUpdate::Acp` then `queue_acp_sync` without `notification.clone()` /
`to_write.clone()`.

≠ named YOLO Done / Meta Harness Done.

## Commands / counts

```text
cargo test --locked -p aster-shell --lib equal_aster_generation_delta_meta_merges_consecutive_chunks
# → 1 passed
```

## Explicitly not claimed

- Named YOLO / overall Meta Harness Done; headed-live; Studio H2 land.
