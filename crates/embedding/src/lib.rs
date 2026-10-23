//! The in-tree pure-Rust light-tier embedding engine (specs/013 Phase 2).
//!
//! One provider behind the core `EmbeddingProvider` contract: a Model2Vec
//! static model loaded from embedded bytes — no ONNX, no model server, no
//! install chain. The assets are checked in with their sha256 recorded so a
//! drift refuses at load with the named digest mismatch (fail-closed; the
//! `use.bge.*` manifest error family cannot fire here by construction).
//!
//! ## AGENTS.md (copied verbatim from crates/bge)
//!
//! - Engines stay local. Do not add Python, torch, or a model server process.
//! - No implicit download source; every byte is in this repository.

pub mod assets;
pub mod hygiene;
pub mod provider;
pub mod vector;

pub use provider::StaticEmbeddingProvider;
