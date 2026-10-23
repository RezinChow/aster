# AGENTS.md

## Repository

This crate owns the in-tree pure-Rust light-tier embedding engine: the
Model2Vec potion-code-16M-v2 static model, its embedded (compile-time)
assets, and the provider implementation behind the core
`EmbeddingProvider` contract.

## Boundaries

- The assets are checked in with their sha256 pinned in `src/assets.rs`.
  A drift refuses at load with the named digest mismatch; there is no
  download, no install manifest, no network access at any point.
- Engines stay local and pure Rust. Do not add Python, torch, ONNX, or a
  model server process. The `crates/bge` discipline applies verbatim.
- The only public API is `StaticEmbeddingProvider` (from_embedded,
  dimension, id, encode_batch). Do not widen it without a spec.
