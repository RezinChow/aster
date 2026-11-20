# Digest stream fan-out 3 (durable_memory · management · core_identity · effect tool)

Date: 2026-11-16.
Branch: `main` @ dirty.

## Change

- durable_memory turn/candidate digests stream.
- durable_memory_vec management digests + page len via stream helpers.
- core_identity `digest_json` streams.
- effect `tool_effects` digest/bound stream (local Writer/Counter).
- TUI Recap static `&str`; wiki_sources generation stream.
- Stale freeze: durable_memory context_id + result_transform digests refreshed.

≠ named YOLO Done.

## Commands / counts

```text
cargo test --locked -p aster-core --lib durable_memory::  # 33 passed
cargo test --locked -p aster-core --lib durable_memory_vec::management
cargo test --locked -p aster-core --lib core_identity::
cargo test --locked -p aster-effect --lib coding::tool_effects
# hermetic TUI subset 13/0 after Recap
```

## Explicitly not claimed

- Named YOLO Done; full 29-suite reconfirm after fan-out 3.
