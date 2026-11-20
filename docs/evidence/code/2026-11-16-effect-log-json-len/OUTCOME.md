# effect FileLog diagnostic: json_len without Vec

Date: 2026-11-16.
Branch: `main` @ dirty.

## Change

`byte_limit_diagnostic` sizes facts via a counting `Write` instead of `to_vec`.

## Commands / counts

```text
cargo test --locked -p aster-effect --lib log::
# → 50 passed; 1 ignored
```

Hermetic reconfirm (prior): **28 suites / 259/0**.

## Explicitly not claimed

- Named YOLO Done / headed-live.
