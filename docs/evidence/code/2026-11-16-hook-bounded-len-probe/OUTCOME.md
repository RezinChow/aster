# Hook bounded_event_input length probe

Date: 2026-11-16.
Branch: `main` @ dirty.

## Change

`bounded_event_input` probes `json_serialized_len` first so oversized hook
payloads never allocate a full `to_vec` before the truncated stub.

## Commands / counts

```text
cargo test --locked -p aster-core --lib hooks::command::
# → 8 passed
```

## Explicitly not claimed

- Named YOLO Done.
