# porcelain: feed Sha256 from JSON without Vec

Date: 2026-11-16.
Branch: `main` @ dirty.

## Change

`digest_stamps` / FileIndex omitted-content digest stream JSON via `to_writer`
into Sha256 (same bytes as former `to_vec` + `update`).

≠ named YOLO Done.

## Commands / counts

```text
cargo test --locked -p aster-core --lib porcelain::
# → 59 passed
```

## Explicitly not claimed

- Named YOLO Done / headed-live.
