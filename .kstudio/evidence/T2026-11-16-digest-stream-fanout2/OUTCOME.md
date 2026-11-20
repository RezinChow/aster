# Digest/len stream fan-out 2 (immutable · capability · package · semantic · run_control · agent_protocol)

Date: 2026-11-16.
Branch: `main` @ dirty.

## Change

More hot-path digests / size gates stream via `json_update_sha256` /
`json_serialized_len` without throwaway `Vec` retention.

≠ named YOLO Done.

## Commands / counts

```text
cargo test --locked -p aster-core --lib tools::immutable_content::  # 1
cargo test --locked -p aster-core --lib capability::run_binding::    # 2
cargo test --locked -p aster-core --lib package_context::            # 3
cargo test --locked -p aster-core --lib durable_memory::semantic_binding::  # 2
cargo test --locked -p aster-core --lib run_control::                # 23
cargo test --locked -p aster-core --lib agent_protocol::             # 23
```

## Explicitly not claimed

- Named YOLO Done; full 29-suite reconfirm after this exact knife.
