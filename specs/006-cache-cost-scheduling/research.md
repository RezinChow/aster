# Research

DeepInfer revision `9bd9cf243fc53ef9afbf8f04d391d989117d6ab9`:
`csrc/engine/scheduler.hpp` budgets batched tokens, sequences and KV blocks;
`deepinfer/worker/decode_perf_cache.py` binds measured performance curves to
model/execution identity and expiry. The released project excludes a complete
KV system and cross-replica P/D load balancing. This gateway policy is an
adaptation of measured-work scheduling, not a port of an unpublished algorithm.

Native b10787 supports continuous batching (already enabled), logical batch
2048 and physical microbatch512, cache RAM8192MiB, two explicit slots and FP16
KV. Native metrics expose actual processed/cached token counters and active /
deferred requests, but no authoritative occupied/free KV-block gauge or cache
epoch. Preallocated GPU memory is not occupied KV pressure.

005 already measured slot1/2/4, NUMA, graph/MMQ ablations and ngram speculation.
Preserve those decisions. The current workload differs by retaining131072
context per slot, so any new native tuning must preserve this requirement.
