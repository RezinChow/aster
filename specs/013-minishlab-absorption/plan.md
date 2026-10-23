# Architecture Plan: MinishLab absorption into A3S Code

**Created**: 2026-10-23 · **Status**: Draft for review
**Directive**: One executable program absorbing Semble, Model2Vec, SemHash,
and Vicinity concepts into a3s-code. **Pure-Rust first**: no Python, no
torch, no model-server process anywhere in the product path. The existing
ONNX BGE stack stays as the *heavy tier*; everything new is Rust.

## 0. Design axiom: one embed, three consumers

Every MinishLab project reduces to one primitive — a fast sentence→vector
function — feeding one of three consumers:

```
                    ┌────────────────────────────────┐
                    │   EmbeddingProvider (trait)    │
                    │  ┌──────────┐  ┌────────────┐  │
                    │  │ LightTier│  │ HeavyTier  │  │
                    │  │ potion-  │  │ bge-m3     │  │
                    │  │ code-16M │  │ (ONNX,     │  │
                    │  │ (pure    │  │  existing) │  │
                    │  │ Rust)    │  │            │  │
                    │  └────┬─────┘  └─────┬──────┘  │
                    └───────┼──────────────┼─────────┘
                            │              │
        consumer A          │   consumer B │        consumer C
  retrieval semantic channel│ memory dedup │ memory ANN recall
  (replaces nothing; adds   │ (write-time  │ (Linear|HNSW backend
   a startup-instant tier)  │  merge+repr) │  auto-selected)
```

The trait is the architecture. Tiers are **policy, not privilege**: the
light tier is embeddable (~30MB, `from_bytes`, zero install chain — the
`use.bge.*` manifest error family never fires for it); the heavy tier
keeps cross-encoder reranking and 100-language depth. Which tier serves a
session is a **measured decision** (Phase 5), never an assumption.

## Phase table (dependency-ordered)

| # | Lane | Absorbs | New crate/deps | Scale | Gate |
|---|---|---|---|---|---|
| 1 | **Finish specs/012 benchmark** | semble/benchmarks | root python harness only | in flight | this is the measurement foundation; nothing below promotes without it |
| 2 | **EmbeddingProvider + light tier** | model2vec-rs | `model2vec-rs` (pure Rust), embedded safetensors asset | ~1 lane | from_bytes loads offline; contract tests pin dims/normalization; no ORT in the light path |
| 3 | **Memory hygiene (semhash-in-Rust)** | semhash | none (uses provider) | ~1 lane | write-time merge + representative + exact-ratio telemetry; rethreshold without re-embed |
| 4 | **Retrieval quality features** | semble rerank | none | ~½ lane | definition-boost, noise-penalty, adaptive query weighting — each behind its own measured default |
| 5 | **ANN backend (vicinity-in-Rust)** | vicinity | `hnsw_rs` (pure Rust) behind a Backend trait | ~1 lane | auto-switch by collection size; exact Linear stays the small-N default; recall@k parity test |
| 6 | **Evaluated promotion + light tier GA** | all | none | ~½ lane | specs/012 matrix: potion vs bge-m3 on frozen labels; promotion bar = NDCG@10 within 3% AND index ≥10× faster |
| 7 | (deferred) own-corpus distillation | tokenlearn | out of repo (training) | — | only after #6 shows the ceiling matters |

## Phase 2 — EmbeddingProvider (the keystone)

**Location**: `crates/embedding/` (new, pure Rust, no ORT dep).
- `trait EmbeddingProvider { fn encode(&self, batch: &[&str]) -> Result<Vec<Vec<f32>>>; fn dim(&self) -> usize; fn id(&self) -> ProviderId; }`
- `LightTier`: `model2vec-rs` `StaticModel::from_bytes(TOKENIZER, SAFETENSORS, CONFIG)` —
  assets compiled in via `include_bytes!` from a pinned, sha-recorded
  download checked into `crates/embedding/assets/` (the same
  manifest-sha256 discipline as bge, minus the runtime installer).
- `HeavyTier`: wraps the existing `a3s-bge` executor behind the same trait.
- Selection is **host policy** (trusted opt-in, same trust boundary as
  `local-bge` today); the workspace can never pick a tier for itself.

**Refusals**: unknown provider id, dimension mismatch at index open,
asset sha drift — each named, each fail-closed. A projection built by one
provider refuses queries from another (dim check).

## Phase 3 — Memory hygiene (semhash semantics, Rust implementation)

`durable_memory_vec` gains a write-time hygiene pass, concept-for-concept
from semhash but against the shared provider:

1. **Self-dedup at write**: before insert, cosine vs existing cluster
   representatives over threshold τ (default 0.90) → merge into the
   cluster (keep earliest, record members), else new representative.
2. **Exact duplicates tracked separately** (sha of normalized text) — the
   `exact_duplicate_ratio` telemetry semhash exposes.
3. **Representative selection on recall**: a cluster returns its
   representative, not every member — top-k stops wasting slots on
   paraphrase copies.
4. **`rethreshold` without re-embed**: clusters carry their member
   vectors; changing τ is a graph re-walk, never a model call.
5. **Outlier filter** (semhash `self_filter_outliers`): a note whose mean
   similarity to all representatives is below ν stays quarantined (kept,
   flagged, excluded from recall by default) — spam/garbage memory stops
   polluting recall without destructive deletion.

Honest boundary: memory *deletion* policy is the user's; quarantine is
reversible; nothing is silently dropped.

## Phase 4 — Retrieval quality (the remaining Semble rerank ideas)

All in `workspace/retrieval/`, each an independent, measured default:

1. **Definition boost**: a chunk whose structural channel says "defines
   symbol S" outranks chunks merely referencing S when the query is
   symbol-like. Signal already exists (structural channel); this is a
   rerank prior.
2. **Noise penalty**: path-classified down-weight — `tests/`, `examples/`,
   `compat/`, `*.d.ts` — at fixed −0.25 unless the query names the path
   class. Fail-closed: an explicit path include neutralizes the penalty.
3. **Adaptive query weighting**: regex query classifier (symbol-like vs
   natural-language) shifts RRF channel weights ±25%. Bound: the
   classifier only picks between two *fixed* weight vectors — it never
   invents weights.

Each lands behind the specs/012 gate with its own before/after row;
defaults stay off until the row shows a win.

## Phase 5 — ANN backend (vicinity semantics)

- `trait VectorBackend { fn insert; fn query_k(&self, v, k) -> Vec<(Id, f32)>; }`
- `Linear` (today's scan, exact) and `Hnsw` (`hnsw_rs`, pure Rust).
- **Auto-selection**: N < 4,096 → Linear always (exactness is free);
  N ≥ 4,096 → Hnsw with recall@10 parity gate (≥0.98 vs Linear on the
  frozen corpus) before it serves. Persisted collections record their
  backend; opening a Linear collection that grew past the threshold
  migrates on next write, never mid-query.
- The dedup clusters (Phase 3) share the same backend instance — the
  write-time similarity probe and recall query hit one index.

## Phase 6 — Promotion (the only place opinions are allowed)

The specs/012 matrix grows three rows, and **defaults change only here**:

| Row | Comparison | Promotion bar |
|---|---|---|
| potion-code vs bge-m3 (semantic channel) | NDCG@10 on frozen labels, index+query latency | ΔNDCG ≤ 3% AND index ≥10× faster → light tier becomes the default semantic provider; heavy tier stays opt-in |
| dedup on/off (memory) | recall purity on a synthetic paraphrase fixture, slot efficiency | merge ≥ expected without recall loss → default on |
| Hnsw vs Linear | recall@10 parity + p95 latency at 10k/100k synthetic | parity ≥0.98 and p95 win ≥5× → threshold switch lands |

## Constitution check

| Principle | Status |
|---|---|
| Fail closed | every refusal named (provider/dim/sha/threshold drift); quarantine ≠ delete |
| Evidence retained | each phase's promotion row lives in `docs/evidence/` with the frozen-label numbers |
| Hermetic tests | provider contract tests use fixture vectors; no model at test time (assets pinned by sha) |
| Closed sets | `ProviderId`, `VectorBackend` parse/as_str; tier selection is host-only |
| One workspace, local deps | `model2vec-rs` + `hnsw_rs` are crates.io; embedded assets checked in; no new repo, no Python |
| Pure-Rust first | light path has zero ORT/C++ deps; heavy tier unchanged; the AGENTS.md discipline of `crates/bge` is copied verbatim to `crates/embedding` |

## Explicitly not claimed

- No training/distillation in-repo (tokenlearn stays external, deferred).
- No Python process ever; semhash/vicinity are absorbed as *semantics*,
  reimplemented on the shared provider.
- No replacement of the heavy tier by fiat — only by Phase 6 measurement.
- No cross-tenant index sharing; projections stay session-local (FR-005 of 011 carries over).
