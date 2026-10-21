# Cache feedback and cost-aware serving — 2026-10-21

## Result

The supported Gateway optimizations are implemented, tested and deployed.
All17 production units are active; all eight native replicas returned the
correct synthetic answer after restoration. Each retains two131072-token
slots, FP16 KV and flash attention. Power's deployed compatibility binary is
unchanged. No commit, push, new repository or Cloud contract was introduced.

The final Gateway SHA256 is
`10d1242dadba7621d151140dbdad3d8d7544cba599ced1dafd41db22236a27d6`.
The [final operational audit](server/final-audit.json) binds services, source,
configuration and restored engine arguments. The [final deployment](server/final-deployment.json)
includes an actual new→old→new restoration rehearsal, in addition to the earlier
[deployment rehearsal](server/deployment.json).

Specification and acceptance mapping: [006](../../../../specs/006-cache-cost-scheduling/spec.md),
[tasks](../../../../specs/006-cache-cost-scheduling/tasks.md). This extends
[the preceding affinity deployment](../2026-10-21-prefix-affinity/OUTCOME.md)
and preserves [005's original serving campaign](../../power/2026-10-21-serving-optimization/OUTCOME.md).

## What landed

- Prefix locality is recorded only after a recognized successful finish and
  clean response EOF; SSE additionally requires DONE. Cancelled, malformed,
  oversized and truncated observations stay cold. Bytes still stream unchanged.
- Valid, internally consistent upstream Prism usage/timings train bounded,
  expiring prefill/decode cost estimates. Client `usage`/`rawUsage` do not train
  them or determine accounting. A reported cache miss invalidates older hints
  for that execution signature.
- Routing compares estimated uncached input, requested output and outstanding
  work, within the existing one-operation locality band. An owned reservation
  releases work on completion, timeout, fallback, error and cancellation.
  This is an estimated-work budget, not token-exact admission or KV occupancy.
- `prefix_parallelism = 2` explicitly declares the verified per-replica slot
  count. A request in another free slot is not treated as a serial queue.
  Existing health, grant, protocol, priority and hard admission checks remain
  authoritative; a small cost tie band preserves weighted selection.
- Catalog `excluded_supplier_ids` permits exact, local maintenance exclusion
  without editing Cloud or granting another target. The GPU7 experiments used
  it before stopping that worker. Source policy participates in the catalog
  digest and survives subsequent polls, including unchanged catalog content.
- The existing prompt-hash/LRU limits remain; performance profiles are capped
  at256, outstanding leases at4096, and telemetry buffers at64KiB per SSE
  event /256KiB per JSON body. Full request content continues upstream.

The [operator documentation](../../../../apps/gateway/docs/prefix-affinity.md)
describes opt-in configuration, estimates and capability boundaries.

## Runtime measurements

These synthetic measurements describe their recorded workloads, not a client
population p95 or an engine speedup caused by Gateway routing.

| Probe | Result |
| --- | --- |
| Final private55K tool call and appended tool result | Cold TTFT27.102s; cached continuation0.408s. Full prompt55529 tokens retained. [Record](server/canary-pair-final.json). |
| Final public55K pair, repeat1 | Cold TTFT28.812s; continuation0.937s. [Record](public-cache-final.json). |
| Public repeat2 | Cold27.453s; continuation0.641s. [Record](public-cache-repeat2.json). |
| Public repeat3 | Cold27.422s; continuation0.687s. [Record](public-cache-repeat3.json). |
| Public compatibility | 15/15, including all12 WorkBuddy annotations, text/tools/SSE, null/omitted tool content, unknown-field400, auth401 and actual usage44+2=46. [Record](public-compatibility-final.json). |
| Private/platform compatibility | 20/20, additionally catalog, embeddings, rerank, SystemOne and synthetic OCR. [Record](private-compatibility-final.json). |
| Prefill/pre-output cancellation | Native idle observed in0.008s; this early close does not establish that GPU prefill had already started. |
| Mid-generation cancellation | Meaningful output observed before close; native idle in0.1213s, then correct recovery. [Both cancellation records](server/cancellation.json). |

Across three public pairs, median cached-continuation TTFT is0.687s, versus
27.453s cold. The first pair ran alongside compatibility checks; the next two
ran sequentially. These are cache cold/warm comparisons, not proof that the
new cost policy alone produces a40× gain. Cold first turns remain expensive.

[The matched ordinary-load probe](server/ordinary-load.json) used concurrency
1/8/16/32, three repeats, alternating arm order, the same native fleet and
authoritative response usage. Control/candidate totals were122/121 successes
and49/50 explicit429 refusals. No successful answer was incorrect and no other
HTTP outcome was accepted. All75 requests per arm at concurrency≤16 succeeded.
At16 concurrency, aggregate successful p95 was1.7782s control /1.8320s
candidate (+3.0%), inside the predeclared10% guard. These short, shared-production
probes are not a sustained-load capacity claim. [Summary](server/ordinary-load-summary.json).

## Engine experiments and decisions

GPU7 was explicitly excluded, drained, and isolated from public Power traffic.
Each batch profile retained the exact model, FP16 KV, sampling, two slots and
131072 context per slot. Three4K/55K cold pairs, two concurrent requests and
a real tool call were measured per profile; actual cache counts established
cold execution. All candidates were restored before the decision.

| Native profile | Median55K wall time relative to baseline | Decision |
| --- | ---: | --- |
| Logical2048 / physical512 | 1.000 | Keep production baseline |
| Logical2048 / physical1024 | 0.9657 | Gain3.4%; below10% promotion gate |
| Logical2048 / physical256 | 1.0572 | Slower; reject |
| Logical4096 / physical1024 | 0.9662 | Gain3.4%; below gate |

No trial shrank context or quantized KV to improve its result. See
[measurements and decision](server/native-profile-decision.json) and
[argument restoration](server/native-profile-restoration-v2.json).

Native speculative modes none /ngram-simple /ngram-mod were also exercised at
full context: three code/ordinal/repetitive/tool groups, three55K cold/warm
pairs and a concurrent pair per mode. Each arm retained20 response records.
All40 candidate payload digests matched the corresponding baseline, excluding
randomized tool IDs; long cache reuse remained55085 tokens.

The original labelled-metric aggregation **failed** for both speculative modes:
a per-position series existed only after drafting. Those failures remain in
[the raw decision](server/speculation-decision.json). The already retained,
native per-response `draft_n`/`draft_n_accepted` support a separate
[independent analysis](server/speculation-independent-analysis.json), without
inventing missing aggregate counters:

- ngram-simple:69 proposed /24 accepted tokens; warm55K continuation median
  0.5154s versus0.4129s baseline (+24.8%). Reject the latency regression.
- ngram-mod:690 proposed /690 accepted tokens, with benefits on repeated
  generation. The first unseen code request proposed zero tokens. Later repeats
  reused history, so their26.5% code improvement is not a general unseen-code
  speedup. Its implementation shares an ngram container across sequences;
  the current backend does not provide caller partitioning for that history.
  No authenticated partition/isolation or full speculative mixed-load
  cancellation acceptance is claimed. Production remains speculation off.

The [speculation restoration](server/speculation-restoration.json) proves original
arguments and Gateway config restored. No speculative configuration was left
enabled based on a favorable repetitive fixture.

## Capability matrix

| Idea | Current disposition |
| --- | --- |
| Scoped prefix affinity, cache miss feedback, measured work routing, cancellation-owned reservations | Implemented and deployed |
| Continuous batching / chunked native prefill | Already enabled; batch alternatives measured above, defaults retained |
| Exact free/occupied KV blocks and native cache epoch | Not exposed by current native metrics/Power contract. Do not substitute preallocated VRAM usage. Existing managed-worker observations still apply where available. |
| Token-exact aggregate admission | Existing hard request/queue admission remains. Gateway byte calibration is explicitly an estimate; no incompatible tokenizer is made authoritative. |
| P/D separation and KV transfer | Gateway's existing orchestration requires attested transfer-capable workers. Current Prism backend does not provide that contract; do not fabricate readiness. |
| DSpark/MTP/draft models and DeepInfer kernels | No compatible draft is configured. DeepInfer's supported model/hardware differ from this Bonsai/SM89 fleet. Do not import SM100 kernels or model-specific SWA truncation. |
| CPU/GPU overlap, NUMA, graphs, MMQ | Existing005 ablations retained: NUMA no measured gain, disabling graphs/MMQ regressions. Current probes still find no nsys/ncu; no GPU gap trace or new kernel optimization is claimed. |
| Larger CPU KV cache / KV shifting | No demonstrated8GiB cache-capacity bottleneck in this workload; no unmeasured RAM increase or approximate non-prefix KV reuse promoted. |

[Current capability probes](server/capabilities.json) retain profiler availability,
topology and actual native metric names. Reference sources:
[DeepInfer README](https://github.com/deepseek-ai/DeepInfer/blob/9bd9cf243fc53ef9afbf8f04d391d989117d6ab9/README.md),
[scheduler](https://github.com/deepseek-ai/DeepInfer/blob/9bd9cf243fc53ef9afbf8f04d391d989117d6ab9/csrc/engine/scheduler.hpp),
[performance cache](https://github.com/deepseek-ai/DeepInfer/blob/9bd9cf243fc53ef9afbf8f04d391d989117d6ab9/deepinfer/worker/decode_perf_cache.py),
[actual Prism speculation source](https://github.com/PrismML-Eng/llama.cpp/blob/73bfe6cc4/common/speculative.cpp).
DeepInfer explicitly excludes a complete KV-cache system and cross-replica
prefill/decode load balancer; this is an adaptation, not a complete port.

## Verification and provenance

- `cargo test --locked -p a3s-gateway --lib prefix_ -- --test-threads=8`:
  [42 passed](server/focused-v5.log), including24 directly relevant tests
  and18 existing tests matched by the filter.
- Final full library: [2065 passed,5 failed,5 ignored](server/library-final.log).
  The five failures match the preceding release's isolated baseline failures:
  installed-weight/platform-supplier fixtures, management-plane fixture, and
  existing rerank admission/closed-endpoint fixtures. Every distinct failure
  was [rerun alone](server/verification.json); individual logs0–4 are retained.
  This is not an all-tests-green claim.
- Server owner rustfmt passed; root rustfmt retains the unrelated Studio tenant
  difference. Server dependency guard passed6/6 after adding the pinned Cargo
  directory to the check process PATH; the initial four PATH lookup errors
  remain retained. Crate drift check passed. [Check record](server/verification.json),
  [dependency rerun](server/workspace-dependencies-v2.log).
- Windows `cargo check --offline -p a3s-gateway --tests` and targeted rustfmt
  [passed](local-typecheck-final.log). The pre-existing stale lock entry requires
  offline resolution for this check; original Cargo.lock bytes were restored.
  Global fmt still hits [OS error206](local-workspace-format.log); the local
  workspace guard remains5/6 with the unrelated missing
  `apps/work/data/product-aliases.json` fixture. No unrelated state was repaired.
- Final runtime-source identities are [bound to the release](server/final-source.json).
  Build patch SHA `24796668929cdec17298edd5e7159d3ae71db160f52f4d97859950515a9b0bde`;
  final cumulative patch SHA `ef0f2997721d8355ff8719ea9310b1a798b8dbb4f108e990e4fce8b001e02fb1`.
  The difference is documentation only: every Rust source and Cargo input hash
  is identical, as asserted by final deployment and audit.
- The four pre-existing server edits remain a separate
  [patch](server/pre-existing-source.patch), SHA
  `596b5652f96b2fdcdee05acff2372224ac4e7d714c71c8893693519448c142d9`.
  Each source update reversed only our prior patch and verified that baseline
  before applying the next patch. User main-worktree staged changes were preserved.
- [Artifact manifest](retained-artifacts.json) pins52 downloaded server files.
  Actual Gateway/Power process secrets were checked in memory before download;
  no production configuration, credentials or private prompt was exported.

Retained instrument/preflight failures also include: the first test shell
wrapper's exit-variable quoting error after40 passing tests; an older benchmark
helper's existing-output guard before fresh qualification; and an initial
catalog probe sent to the authentication port, which failed before any native
mutation. The corrected probe resolves the configured API service. The
[first restoration record](server/native-profile-restoration.json) retains
the unchanged state from that refused attempt.

## Explicitly not claimed

Full DeepInfer compatibility; native KV residency/epoch attestations;
cross-replica tensor transfer; exact tokenizer admission; authenticated shared
speculation-history isolation; all-model GPU kernel acceleration; a sustained
capacity/p95 improvement; actual WorkBuddy UI timing; a generic VPN/network
repair; disappearance of cold-prefill latency; or a globally green workspace.
The previously user-confirmed WorkBuddy UI compatibility remains distinct from
this turn's synthetic protocol and performance checks.
