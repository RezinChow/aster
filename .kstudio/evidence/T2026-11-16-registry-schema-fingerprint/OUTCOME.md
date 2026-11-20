# Tool registry: schema fingerprint without Vec

Date: 2026-11-16.
Branch: `main` @ dirty.

## Change

`validate_arguments` serializes the tool schema once through a counting hasher
(`to_writer`) for both the byte cap and the in-process cache fingerprint —
no throwaway `Vec<u8>`.

≠ named YOLO Done.

## Commands / counts

```text
cargo test --locked -p aster-core --lib tools::registry
# → 22 passed
```

Hermetic pack prior reconfirm: **28/259/0**.

## Explicitly not claimed

- Named YOLO Done / headed-live.
