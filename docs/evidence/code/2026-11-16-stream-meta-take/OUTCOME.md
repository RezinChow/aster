# OpenAI stream Done meta — take provider/model/url

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

`streaming.rs` spawn locals `provider_name` / `request_model` / `request_url` are
`mem::take`n into `LlmResponseMeta` on the Done path (early `[DONE]` returns;
trailing finalize is the only alternate). Removes a second String clone per
finalize.

## Commands / counts

```text
cargo test --locked -p aster-core --lib openai::tests → 54 ok
```

## Explicitly not claimed

- Named YOLO Done / HG2 Pass / live latency reduction.
- That accumulator tool-args take is safe (still reverted).
