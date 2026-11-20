# batch $ref: borrow-walk then clone leaf

Date: 2026-11-16.
Branch: `main` @ dirty.

## Change

`resolve_batch_reference` walks object/array segments by reference and clones
only the final leaf (plus length check via `json_serialized_len`).

≠ named YOLO Done.

## Commands / counts

```text
cargo test --locked -p aster-core --lib tools::builtin::batch::
# → 27 passed
```

Hermetic pack: **28 suites / 259/0** (prior reconfirm).

## Explicitly not claimed

- Named YOLO Done / headed-live.
