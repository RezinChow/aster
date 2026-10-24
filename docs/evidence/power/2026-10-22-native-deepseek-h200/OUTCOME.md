# Native DeepSeek implementation checkpoint

## Result

T001–T006 are verified within their stated scopes. T007 now includes shifted
mHC, Engram compression/hash/history/gate, FP32-logit routing and activation,
effective RMSNorm, explicit-cache RoPE, sparse indexing, packed index/main KV,
transactional pre-norm C1/C2 and main/window KV state, packed sparse MQA and
the exact backbone sharing topology. Index-K transactions and an atomic
selected-state commit now include compression/main/index KV and Engram history.
Raw device matrices, packed FP8 activation casts, tiled expanded-math
projections, full single-device MoE dispatch/combine and the shifted FFN half
are also present. Index Q/K projection and the main compressed-KV
norm/RoPE/quantization path now connect to the transactional states.
Main Q/SWA and grouped Wv/Wo projections, the shifted attention half and
Power range-based packed Engram lookup/projection/gating are now connected.
Later continuations add full official parameter/state composition controls
and the separate XQ F32 embedding/mHC/head, mixed MoE and shifted FFN
components, followed by XQ F32 codecs/RoPE, sparse MQA and Q8 attention
projections, F32 C1/C2 state, F16/F32 compressor/indexer controls, exact
Engram metadata and the original-table/F16-projection/F32-gate contribution.
The following slice adds the immutable XQ identity/config/architecture,
all 53 typed request participants, complete shifted attention and callable
source/consumer decoder-layer composition. The current library suite passes
409 CPU tests; the CUDA-feature suite passes 410 with ten H200 tests ignored.
The complete 40-layer model/token loop, verified cross-device transfers,
real payload opening, hardware qualification and
optimized low-precision CUDA GEMMs remain incomplete.
Mathematical/C1/C2 fixtures and a versioned same-model comparison budget are
retained. Actual native GPU qualification, complete model execution,
optimization and deployment remain open. The overall goal is active and
incomplete.

## What landed

- Power and the new model-owned `a3s-deepseek` package join the root workspace
  and lock. Power's optional ACL and Runtime dependencies resolve locally;
  all new members are unpublished. The model owner depends on Power only.
- Private SmallVec container compatibility patches preserve the pinned ONNX
  Runtime and optional Mistral backend resolution. Published archive hashes,
  licenses, original source inventories and negative build attempts remain
  recorded. No product configuration language was added.
- Official public config/index identity and all 48 remote safetensors header
  hashes were inspected. The 96,085 indexed tensors agree with the headers
  and total 510,286,023,000 payload bytes. Actual packed containers and scales
  are distinguished from their model-level numerical meaning.
- `crates/deepseek/src/reference.rs` provides bounded F64 linear, RMSNorm,
  softmax, asymmetric SwiGLU, bias-ranked/top-sum gate and expert combination,
  plus scalar E4M3, E2M1 and UE8M0 decoding. It is an explicit mathematical
  oracle, not a serving backend or CPU fallback. Reference inputs, independent
  decimal constants and tiny-only budgets are recorded separately.
- XQ download observation at Unix time `1792659968.6144495` showed 40.35746%
  transferred, including unverified in-flight ranges. The original downloader
  and waiting launcher still match their recorded PID/start identities.

Subsequent P0 work:

- Added a transactional C1/C2 compression-state oracle: per-channel two-token
  softmax, all 32 partitions of six input tokens, accepted-prefix rollback,
  immutable failure and bounded history. The reference suite now has 25 tests.
- Retained 18 official reference API observations over six public synthetic
  inputs: 119 input tokens / 113 scored positions per round, with no generated
  tokens. Input IDs and selected/top-five logprobs are bound by hash. Repeat
  observations were equal; cache reuse was not controlled. The frozen budget
  is an acceptance policy, not an achieved native accuracy result.
- Updated the XQ preparation pipeline to the H200-verified exact-usage Power
  binary `0076e2a4…`. Explicit synthetic mode changes only the owned idle
  frontend, binds its executable/ACL/process identity, and restores privacy
  after normal or failed benchmarks. Failed normal restoration stops the
  frontend rather than re-enabling exact mode. Failed requests and invalid
  clocks retain their records; incomplete/unrestored reports cannot qualify.
- Qualified the exact 28-file LF-normalized public operator bundle on remote
  Linux: 68 tests passed, zero skipped. The new release passed nonweight
  preflight against 11 artifacts and 1,376 ggml source blobs before activation.
- Ran a real Power server-only probe on isolated H200 task ports, with a
  synthetic SSE upstream. Normal counts were prompt=10 / completion=20;
  exact counts matched prompt=7 / completion=17. Streaming, nonstreaming,
  success restoration and failure restoration passed. Probe processes stopped.
- Activated the qualified preparation bundle with a source backup, exact old
  PID/start/UID/script checks and a quiesced waiter. Active preflight passed
  again. Replacement PID **335316**, start ticks **259373957**, reached
  `WAITING_WITHOUT_GPU_RESERVATION`. Original downloader PID **217634**, start
  ticks **255375652**, remained live; no download or shared model service was
  restarted. This remains external-Xolotl preparation, not native deployment.

## Verification

T005 is now implemented in the model owner. Exact model/revision/config bytes,
closed CUDA execution and base text kernel groups, eight resolved CUDA ranks,
and bounded closed-schema ACL input are required. Configuration roundtrips
include escaped Windows paths and Unicode. This validates requirements, not
callable kernels or an activated model. The first test run exposed an incorrect
ACL AST attribute key (36 passed, 3 failed); the model owner now reads/generates
the actual field name. The locked offline rerun passed all 39 tests (14 new),
with a separate passing package format check. Both runs are retained in
`native-identity-tests*.log/json`. No shared ACL parser was changed.

T006 now binds a Power WeightStore to the pinned official index and all 48
upstream LFS payload SHA-256 identities. This is an enforcing loader boundary;
the full shared checkpoint has not yet been run through it. Explicit matrix
layouts cover BF16, F32, 32×32-block FP8, per-row-group32 Engram FP8, and packed
E2M1 FP4 with per-row-group32 UE8M0 scales. Row reads retain exact raw bytes,
cross-shard offsets, Power cancellation and zeroizing ownership, and enforce a
combined weight-plus-scale read budget. Missing/wrong scales, reserved scale
NaNs, malformed/truncated containers, bad block geometry, overflow, index/shard
disagreement and payload SHA mismatch refuse. No full F32 conversion is used.
Live read-only shard headers confirmed the distinct expert/dense/Engram layouts;
see `quant-layout-header-samples.json` and `engram-layout-header-samples.json`.

The final T006 locked offline suite passed 54 tests (15 new after T005), and
package format/check passed: `native-weights-locked-tests-v2.log/json`,
`native-weights-format-v2.log/json`, `native-weights-check-v2.log/json`.
The rerun of `cargo fmt --all -- --check` still hit Windows error 206. The
dependency guard again passed five tests and failed the existing Studio
build-script stub test, with the same missing Tauri/embed-resource APIs as P0.
These are retained in `native-slice-workspace-format.*` and
`native-slice-dependency-guards.*`; no guard or unrelated source was changed.

T007's first slice composes mHC prenorm, pre/post mixes, Sinkhorn and residual
update using Rust/Candle tensor operations. Public construction requires an
actual CUDA RuntimeDevice; no CPU backend is registered. Private CPU tests
exercise the same tensor math against an independent FP64 asymmetric-mix
fixture, verify residual orientation, four-stream normalization, BF16 output,
batch/decode equality, unchanged input, and bad shapes/dtypes/numerics. The
step retains its original residual until finish. The loader still needs to
bind the exact norm-fused parameters and model numerics; this is not a complete
layer/model implementation. The source revision, source hash and original MIT
notice are retained in the model crate and root provenance documents.

The locked offline suite now passes 60 tests (six mHC tests added), with
package format and production check passing. Records are
`native-mhc-locked-tests.*`, `native-mhc-format.*`, `native-mhc-check.*`.
The full-workspace format command still fails with Windows argument-length
error 206 (`native-mhc-workspace-format.*`). No CUDA build or GPU execution is
claimed. T007 remains unchecked until Engram, sparse attention, exact MoE/KV
and state/rollback obligations are complete.

Read-only observation at **2026-10-22 20:40:35 +08:00** shows XQ main weights
**78,285,861,324 / 162,954,903,552 bytes (48.0414%)**, including
2,217,963,980 unverified in-flight bytes. Sidecar bytes remain complete;
zero of 16 whole main parts have been published/verified. Downloader PID
217634 / start 255375652 and waiter PID 335316 / start 259373957 still match
their ownership records. No process or shared service was restarted. See
`xq-download-1792672835.json`.

T007 continuation adds the exact official tokenizer-to-Engram compression in
Rust, two pinned seed-0 hash tables and current-first n-gram gathering. Images
terminate n-grams across their boundaries. Request-local history prepares
without mutation and commits only an accepted prefix; stale or other-request
transitions refuse. All 32 chunk partitions over a six-token image-containing
input and every accepted prefix are covered. A Rust/Candle signed-root Engram
gate preserves BF16 residuals for image tokens and applies the two norm weights
inside the dot product without changing the RMS denominators. Read-only actual
checkpoint headers confirm all four q/k norm weights are BF16 [4,5120].

The complete public tokenizer artifact was bound by Git blob ID and SHA-256.
An independent remote Python/NumPy 1.26.4 reference and the Rust audit example
agree over all 129,280 raw IDs: 99,092 compressed IDs, PAD=2, complete u32-LE map
SHA-256 `c60a86322ec17b4142bfef3c57a8d81fb428550cdf487f88a4320cb59fe46481`.
This is real artifact-level metadata agreement, not a generated-text or GPU
inference result. Records: `engram-metadata-reference.json`,
`native-engram-tokenizer-audit.*`, `engram-gate-weight-headers.json`.

MoE tensor primitives now select distinct logical experts with stable lowest-ID
ties, choose explicit text/image correction bias only for ranking, and normalize
the unbiased FP32 sqrt-softplus scores with the model epsilon and routed scale.
They reject negative/nonfinite scores, bias/normalization overflow and bad
shapes. The unfused selector has explicit scalar validation-status reads; it
does not copy the score array to CPU or claim optimized asynchronous execution.
SwiGLU clips the gate only above and the value on both sides, and applies route
weights before the caller's explicit activation quantization/cast. The selector
consumes scores; BF16 gate projection, GPU score production, expert GEMMs and
their quantized execution remain open.

The final locked offline model suite passes **80 tests** (20 more than the prior
mHC checkpoint). Package format and `cargo check --all-targets` pass. Records:
`native-engram-moe-locked-tests.*`, `native-engram-moe-format.*`,
`native-engram-moe-check.*`. The first Engram test compile used a nonexistent
root re-export for a shape trait; its retained failure is in
`native-engram-tests.*`, and the fixed helper uses its actual tuple shape.
`cargo fmt --all -- --check` still fails with Windows error 206
(`native-engram-moe-workspace-format.*`). No CUDA build or GPU tests ran.

Read-only candidate-source review verified the existing Xolotl archive and its
MIT notice, retaining hashes for 13 public headers/sources in
`xolotl-layer-source-reference.json` and `xolotl-ds41-source-reference.json`.
Those sources stay in the ignored reference directory; none was imported or
executed. The generic layer header and DS41 loader are coupled to other model
geometries/GGUF formats, so they are not an official-checkpoint drop-in. Any
kernel reuse requires reviewed in-process ABI/layout adaptation. The pinned
DeepInfer `cache_common.py` confirms distinct FP8-main/SWA, FP4-main and index
formats; format/profile binding and quantization remain prerequisites for the
next KV/attention slice. Plain BF16 state must not silently replace that logical
quantization. Source records are in `kv-format-source-reference.json`.

XQ observation at **2026-10-22 21:40:05 +08:00**: main transferred bytes
**81,658,685,606 / 162,954,903,552 (50.1112%)**, including 1,765,583,014
unverified in-flight bytes. One of sixteen final part filenames is published;
this observation did not independently hash that payload or verify the full
model. Both original downloader/waiter PID/start/UID identities remain live,
and there is still no deployment record. See `xq-download-1792676405.json`.

T007 continuation adds `state.rs`: actual tensor C1/C2 pre-norm compression,
not a cache. C1 preserves BF16 bits; C2 applies FP32 per-channel two-token
softmax and emits BF16 rows. Only one unmatched C2 row is committed. Proposal
snapshots and pending rows use `force_contiguous().detach()`, since ordinary
contiguous views or storage clones can retain a full caller allocation.
Physical CPU backing-length tests verify that accepted pending/output rows
do not keep the rejected suffix or a large sliced input's storage. Each state
has one outstanding proposal lease; drop, cancellation and validation failure
release it. Owner/generation/position checks prevent foreign or stale commits.
All 32 chunk partitions and accepted prefixes across an existing odd boundary
agree with independent F64 state results. Nonfinite inputs, BF16 overflow and
pre-allocation tensor-budget failures leave committed state unchanged.

`layers/attention.rs` adds an unfused decoded sparse MQA control. Candidate
plans require explicit window/compressed source roles and ready positions;
future, expired-window, duplicate or out-of-range rows refuse before reads.
Distinct source rows at the same position remain distinct. Only selected KV
rows are gathered and converted, so an unselected nonfinite row is not read.
The supplied vector is both K and V. Effective FP32 HF sink logits participate
only in the softmax denominator, without QK rescaling; sink-only rows return
zero. Ragged multihead results match independent F64 math and individual
decode calls. The pinned FlashMLA reference and DeepInfer `runtime_attn_sink`
confirm these semantics. Sources/licenses are retained separately.

This is correctness control with per-query tensor operations and explicit
finite-status synchronization, not a fused performance kernel. Caller-provided
decoded BF16 values must already reflect the model's actual norm/RoPE/cache
quantization. Static live-tensor byte estimates are checked but do not measure
CUDA allocator/BLAS workspace or reserve model-wide Power memory. Those remain
GPU/residency qualification obligations. No packed cache, sparse indexer,
complete model state or backend activation is inferred from these components.

The final locked offline suite now passes **98 tests** (18 new: 11 compression
and 7 attention tests); package format and all-targets check pass. Records:
`native-compression-attention-locked-tests.*`,
`native-compression-attention-format.*`, `native-compression-attention-check.*`.
The full format command still hits Windows error 206
(`native-compression-attention-workspace-format.*`). CUDA feature compilation,
GPU execution, actual memory/performance and complete generation are untested.
T007 remains unchecked. No shared service, downloader or waiter was restarted.

XQ read-only observation at **2026-10-22 22:34:05 +08:00**: transferred main
bytes **84,680,932,780 / 162,954,903,552 (51.9659%)**, including 2,606,792,108
unverified in-flight bytes. Four final part filenames are published; this
observation is not an independent hash of their contents or a full-model
integrity proof. The sidecar remains complete, original downloader/waiter
PID/start/UID identities are live, and no deployment record exists. See
`xq-download-1792679645.json`.

T007 continuation adds effective-weight RMSNorm and an explicit FP32 cache
rotary transform. RMSNorm accepts BF16/FP32 inputs, computes FP32 row means,
uses the supplied effective weights without exponentiation or an inferred
output scale, and emits BF16. The model loader must still bind the exact
weights and exported scale semantics. RoPE preserves the supplied [cos | sin]
FP32 values, supports explicit interleaved/half-split pairing and a bounded
feature interval, and preserves the other BF16 feature bits. Conjugation
negates sine without dividing by cache amplitude; a forward/conjugate pair
with amplitude 1.5 scales by 2.25, rather than acting as a true inverse.
Cache/weight snapshots are independent of mutable parameter storage.

Fourteen new CPU tests cover independent scalar normalization/rotation,
strided multihead and individual-token agreement, nonunit conjugate scaling,
snapshot ownership, shape/dtype/position/model-context boundaries, finite
overflow, cancellation and static tensor budgets. The final locked offline
suite passes **112 tests**; package format and all-targets check pass. Records
are `native-norm-rope-final-tests.*`, `native-norm-rope-check.*` and
`native-norm-rope-format.*`. The full workspace format invocation still fails
with Windows error 206 (`native-norm-rope-workspace-format.*`). No dependency
manifest changed in this slice. Existing unrelated dependency/drift guard
failures remain as previously recorded.

Pinned DeepInfer sources use FP32 frequency/angle/polar construction before
amplitude scaling. The cache factory and exact HF YaRN/layer binding remain
unfinished; no FP64-generated cache is substituted or claimed equivalent.
Source hashes are retained in `norm-rope-source-reference.json`; the rotary
source's Apache/vLLM notices are preserved with the full existing Apache
license. Both controls require actual CUDA handles through their public API;
private CPU test math does not establish CUDA compilation, kernel numerics,
model-wide reservation, GPU performance or complete generation. T007 remains
unchecked; no native endpoint/key has been created.

XQ read-only observation at **2026-10-22 23:25:17 +08:00**: transferred main
bytes **87,564,035,420 / 162,954,903,552 (53.7351%)**, including 2,235,114,844
unverified in-flight bytes. Four of sixteen exact final part names exist;
their payloads were not independently hashed by this observation. The
5,661,492,320-byte sidecar is complete, original downloader/waiter process
identities remain live, and no deployment record exists. See
`xq-download-1792682717.json`. The earlier 23:07 suffix probe incorrectly
counted only `.gguf` names for multipart files; that probe is explicitly
marked invalid in its retained record. Byte/progress measurements were
unaffected. No service or downloader was restarted.

2026-10-23 T007 continuation adds sparse-index score/selection control and a
packed group-32 FP4 index encoder/decoder. Scoring reads only eligible causal
or explicitly restricted rows, applies per-head ReLU before effective signed
BF16 head weights, reduces in FP32, then rounds scores to BF16 before top-k.
Selected row IDs remain on the tensor device, sorted with invalid U32 tail
padding; no tensor payload is read back to perform selection. Candidate
sources use block maxima and force the last valid block's rank to positive
infinity, including full last blocks. Tests distinguish max from mean for
both 8- and 16-token blocks. DeepSelect's pinned kernel expressly disclaims
prefix tie selection; the control chooses the lowest tied logical row and
does not claim an identical reference subset at ambiguous BF16 thresholds.

`Fp4IndexRows` requires actual CUDA at its public boundary. Data and scales
are separately owned U8 [rows,64]/[rows,4] sections. Snapshots freeze mutable
parameters. The encoder accepts BF16 [rows,128], uses the pinned clamp of
6*2^-126, FP32 reciprocal multiplication, exact power-table binary search for
scale ceil, and E2M1 RNE midpoint handling with negative-zero preservation.
It introduces no logarithmic approximation or epsilon perturbation. The
packed input path is connected to the indexer and decodes only selected or
causal key rows; unselected overflowing logical values are not expanded.
General OCP E8M0 scalar/weight decoding is unchanged. Packed index scale zero
has an ambiguous bitcast/padding convention in the references and is not
emitted for active clamped groups, so this committed-row boundary refuses it,
along with byte255. The earlier first packed test log used the generic OCP
zero interpretation; that interpretation was superseded after reading the
pinned packed cast/config source. Both the first record and final refusal
tests are retained rather than presenting that first pass as the final ABI.

Twenty-six new CPU tests cover scalar F64 score/decode oracles, BF16 selection
rounding, signed weights/ReLU order, causal and restricted reads, ragged
padding, block rules, chunk/decode agreement, snapshots, malformed formats,
cancellation and tensor/metadata budgets. All **65,280 finite BF16 encodings**
also match an independent exponent-bit/nearest-value scalar encoder, including
scale transitions and signed zero. The final suite passes **138 tests**;
all-targets check and package format pass (`native-index-quant-verified-*`).
The full workspace fmt invocation still fails Windows error206
(`native-index-quant-workspace-format.*`). Dependencies/manifests were not
changed in this slice; prior unrelated dependency/drift guard failures remain.

This is unfused correctness control with explicit finite-status reads and
static tensor budgets, not qualified GPU speed or a full serving path. No
SM90 kernel was built/executed here. DeepGEMM's pinned tests distinguish its
SM90 FP8/FP32-scale index kernel from SM100 MXFP4/BF16 inputs, so the latter
cannot be relabeled an H200 kernel. HF config audit confirms effective
non-exponential norm weights and YaRN mscale=False. Complete native layer
binding, exact FP32 frequency construction, shared index/candidate topology,
main KV formats, model-wide transactional state and generation remain missing.
T007 remains unchecked; no native service/key or GPU allocation exists.
References and distinctions are retained in `index-quant-source-reference.json`.

A read-only H200 reference-pod path/version audit found host CUDA12.6 nvcc
and the existing SGLang sandbox, with Cargo/Rust absent from its PATH.
The jump-host PATH exposed none of those build tools. This is build-path
discovery only; `h200-native-toolchain-path-audit.json` is not a native build
or GPU test. No shared service was changed.

XQ observation at **2026-10-23 00:12:12 +08:00**: main transferred bytes
**90,190,440,178 / 162,954,903,552 (55.3469%)**, including 1,204,086,514
unverified in-flight bytes. Four final filenames are published; their
contents were not independently hashed by this probe. The 5,661,492,320-byte
sidecar remains complete, original downloader/waiter PID/start/UID identities
remain live, and no deployment record exists (`xq-download-1792685532.json`).
No downloader, waiter or shared service was restarted.

### T007 main KV, shifted mHC, topology and router continuation

The current slice adds 44 tests to the previous 138. The final root-workspace
command `cargo test -p a3s-deepseek --locked --offline --no-default-features
--lib` passes **182 / 182**, with no ignored tests. The matching `cargo check
-p a3s-deepseek --locked --offline --no-default-features --all-targets` and
package fmt check pass. Full workspace fmt still fails Windows error 206.
Commands, exits and raw output are in `native-kv-topology-router-verified-tests.*`,
`native-kv-topology-router-check.*`, `native-kv-topology-router-format.*` and
`native-kv-topology-router-workspace-format.*`. No CUDA feature is enabled.

- `layers/kv.rs` owns exact raw main-KV records: 512 E4M3 values with group-32
  UE8M0 scales (528 bytes/token), or packed E2M1 values with group-16 E4M3
  scales (288 bytes/token). Encoding preserves FP32 reciprocal multiplication
  after scale rounding, RNE and negative zero. Selected/prefix decoding reads
  only eligible records; unselected overflowing values do not contaminate a
  valid attention query. Both encoders cover every finite BF16 raw encoding
  against independent scalar oracles. The admitted live scale ranges exclude
  zero/padding and reserved nonfinite codes; checkpoint UE8M0 semantics are
  unchanged.
- Packed sparse MQA now combines the window's FP8 records and explicitly
  selected compressed format on-device, restoring original selection order.
  The candidate bound accommodates a full prefill window table plus C1 rows.
  Tests compare mixed-format packed and decoded results and sink semantics.
- `state/kv.rs` snapshots encoded records, protects one outstanding proposal,
  validates owner/generation and exact C1/C2 readiness, and commits only an
  accepted prefix. Window proposals retain a whole prefill step; accepted
  state owns only the final 128 rows. Tests cover all eight-token partitions,
  odd C2 boundaries, cancellation, mutable input, rejected continuation bytes,
  and exact backing-storage sizes. This is immutable concatenation, not a
  paged allocator or an atomic full-model transaction.
- Shifted mHC now carries the preceding sublayer's pre mix, starts with a
  one-hot mix, and reduces the final trunk with the final FFN's carried mix.
  Engram may replace the trunk without changing that carry. Parameter and
  residual snapshots and finite/overflow validation protect the control path.
  The previous unshifted control API is retained; the official binding selects
  shifted semantics. Official HF fn bytes already include norm weights.
- `model/topology.rs` consumes only hash-verified public metadata. KV and
  index-K sources are 2/8/14/20; top-k sources additionally include 24/28/32/36;
  candidate production starts at 20. Source-only factories bind existing
  compressor and KV owners, refusing unwritten consumer caches. Window layers
  0/1 use base theta 10000; compressed layers use YaRN/theta 160000. Engram
  tables bind only layers 1/14; LM head/DSpark are not backbone layer IDs.
- `layers/moe/router.rs` composes BF16 inputs/parameters with FP32 output
  logits, compensated FP32 sqrt-softplus, then the existing unbiased-weight
  top-k selector. An explicit regression proves that BF16-rounded logits
  would change an expert choice. All 65,280 finite BF16 logit encodings agree
  with a scalar FP32 softplus reference within four ULPs. Tiny negative-logit
  scores, positive extremes, immutable weights/biases, canonical cancellation,
  boolean image masks and tensor budgets are covered. SwiGLU refuses nonfinite
  inputs before clipping and rejects weighted overflow. Router projection is
  expanded FP32 tensor control, not DeepGEMM's fused SM90 mega-gate.

Two source-audit corrections are explicit. First, a preliminary reading of a
generic runtime default suggested shared layer-20 SWA hidden states. The fixed
HF binding sets `yoco_swa_share_hidden=False`, so every layer projects its own
SWA KV; only compressed KV shares layer 20. No incorrect SWA-sharing code was
implemented. Second, BF16 router parameters do not imply BF16 logits: the
pinned MLP sets `use_fp32_output=True`. Query-head normalization and exponential
norm weights are also disabled by the HF binding.

The initial main-KV run passed 148 tests and failed one scalar-oracle case.
The isolated failure is retained in `native-main-kv-oracle-isolated-failure.*`.
The oracle's FP64 nearest-distance comparison lost the difference between
small palette endpoints for enormous inputs; explicit saturation before the
distance comparison fixes it. The 153-test packed-attention, 161-test cache,
167-test shifted-mHC, 174-test topology and 181-test router runs are retained
separately. Production quantization was not weakened to pass the oracle.

All 11 additional reference blobs are checked against the pinned Git tree,
with URLs, licenses and hashes in `kv-topology-router-source-reference.json`.
`docs/source-manifest.json` records the adapted sources. Static per-component
tensor budgets and scalar validation reads are not aggregate Power resource
permits, measured GPU workspace, asynchronous kernels or H200 speed evidence.

Read-only reference-pod checks found CUDA 13.0 nvcc in the existing SGLang
sandbox (`h200-sandbox-nvcc-audit.json`). Cargo/Rust are absent from the tested
PATH and six explicit candidate paths (`h200-native-rust-fixed-path-audit.json`);
this does not prove absence at unsearched locations. No shared service or GPU
was changed, no native build ran, and no GPU job was allocated. T007 remains
unchecked; the native endpoint and temporary key have not been created.

Latest retained XQ observation, **2026-10-23 01:55:06 +08:00**:
95,971,815,720 / 162,954,903,552 bytes transferred (**58.8947%**), including
2,556,277,032 unverified in-flight bytes. Eight final filenames are published;
the status probe does not hash them. Sidecar completion and the original live
downloader/waiter PID/start identities were revalidated. No deployment record
exists (`xq-download-1792691706.json`); neither process was restarted.

### T007 index-K and atomic state continuation

The next slice adds 19 tests; **201 / 201 CPU tests pass**, with zero ignored.
Locked/offline all-targets check and package fmt pass. Full workspace fmt
still fails Windows error 206. Raw outputs and command/feature/exit metadata
are retained in `native-index-atomic-engram-tests.*`,
`native-index-atomic-check.*`, `native-index-atomic-format.*`, and
`native-index-atomic-workspace-format.*`. The first 196-test run is retained
in `native-index-atomic-first-tests.*`; it passed before Engram integration.

`state/index.rs` now retains exact E2M1 data bytes and group-32 UE8M0 scale
bytes independently. Its C1/C2 schedule, one-proposal lease, immutable input
snapshots, owner/generation checks and accepted-prefix copies prevent rejected
index rows from surviving into another continuation. All eight-token chunk
partitions, odd-position acceptance prefixes, exact backing allocation sizes,
nonfinite/reserved scale refusal, cancellation and foreign/stale proposals
are covered. The source-only topology factory allocates index state only at
layers 2/8/14/20. A direct integration test passes prepared/committed packed
rows into the existing sparse indexer, checking causal future masking and
the visibility of rows after a partial acceptance.

`StateCommitBatch` stages compression, main/window KV, index KV and Engram
history without mutating owners. Every participant must use the same proposed
start/token span and one accepted prefix. A staging error poisons the batch;
ignoring that error cannot publish earlier participants. The bounded participant
list and commit-snapshot budget refuse before allocating the next copy. The
budget covers new accepted snapshots/results and conservative metadata, not
pre-existing proposals, aggregate model HBM or CUDA allocator workspace.

Before the commit point, result metadata is reserved, each distinct bound
device is synchronized, and cancellation is checked. Applying guards only
swaps owned buffers and assigns metadata. Old tensors remain in the guards
until every selected owner has changed, preventing CUDA buffer reclamation
between owner updates. Direct single-owner APIs use the same staged path and
preserve their public signatures. Tests cover cancellation after staging,
drop, late foreign index/history, budget exhaustion, mismatched spans, all
acceptance prefixes, image barriers and old-buffer retention until retirement.

The synchronization audit checks Candle 0.10.2's actual source: same-device
compares a generated, stream-bound DeviceId, not a physical GPU ordinal;
synchronization waits for that bound stream. File hashes and the exact limits
of this source audit are in `state-commit-device-boundary.json`. CPU-only
fixtures use a helper absent from production builds; public admission still
requires actual CUDA. No CUDA build, asynchronous GPU error injection or
multi-GPU atomic commit was executed. Synchronization and immutable copies
are unfused correctness controls, not a speedup claim.

This batch commits only supplied participants. The complete model owner must
still register every affected layer/cache/history and bind all parameters,
projections, exact RoPE generation and the full forward/token path. Runtime
cross-layer KV/index/candidate value sharing is not supplied by the static
topology alone. T007 remains open; T008–T026 are not completed. No native
H200 model, endpoint or key was created, and no remote job/service/downloader
was changed in this slice.

The end-of-slice read-only XQ observation at **2026-10-23 03:22:19 +08:00**
reports **101,076,394,136 / 162,954,903,552 bytes (62.0272%)**, including
2,292,146,328 unverified in-flight bytes. Eight final part filenames exist;
the probe does not verify their hashes. Sidecar remains complete, original
downloader PID 217634 and waiter PID 335316 match their live start/UID identities,
and no deployment record exists (`xq-download-1792696939.json`). No process
was restarted.

### T007 raw projection and expert continuation

Added 17 tests; the final focused suite passes **218 / 218**, zero ignored.
Locked/offline all-targets check and package fmt pass. Full workspace fmt
still fails Windows error 206. The exact commands/features/exits and raw logs
are in `native-raw-linear-final-tests.*`, `native-raw-linear-final-check.*`,
`native-raw-linear-final-format.*` and
`native-raw-linear-final-workspace-format.*`. The earlier 213-test primitive
and 218-test expert runs are retained in `native-raw-linear-first-tests.*`
and `native-raw-linear-expert-tests.*`.

`DeviceMatrix` now reads a bound `MatrixWeights` row range through Power and
loads exact BF16/F32/FP8/MXFP4 representations into its bound device tensor
type. The raw FP4 I8 container becomes U8 bits without an INT8 numerical cast.
Block-32, row-group-32, partial final tiles, scale-row maps, source row offsets,
and raw retained-byte accounting are explicit. Selected gathers expand only
requested rows, including repeated rows, and can return BF16 or F32. The
range-to-tensor integration test uses the private CPU fixture, not a GPU upload.
It proves original FP8 scale-row rebasing, general UE8M0 byte-zero meaning,
negative zero and signed packed-FP4 container preservation across real files.

`Fp8Activations` owns deterministic group-32 E4M3/UE8M0 casts from BF16 or
F32. The F32 path preserves weighted SwiGLU outputs without an intermediate
BF16 rounding. All 65,280 finite BF16 encodings agree with an independent
scalar encoder. Live scale zero/padding and reserved NaNs refuse; general
checkpoint UE8M0 byte zero still means 2^-127. A 256-entry scale lookup uses
a NaN sentinel for the reserved exponent instead of permitting an out-of-range
table access. Packed inputs and constructor snapshots preserve the closed
precision boundary.

Quantized projection accepts an actual packed FP8 activation handle, and only
explicit dense-FP8/MXFP4 weight layouts; ordinary BF16/F32 projections have
separate typed entry points. Tensor control expands 32 output rows at a time,
computes F32 GEMMs, and casts only at the requested output boundary. Tests
cover mixed-sign, multi-group products against independent F64 dots, output
tile/scale boundaries, per-token batching, BF16/F32 outputs, cancellation,
nonfinite/overflow refusal, source snapshots and resource bounds. Embedding
row-format weights can gather but cannot silently become dense projection
weights. This is expanded mathematical control, not a native low-precision
tensor-core kernel, SM90 dispatch proof or a speed measurement.

`QuantizedExpert` composes gate/up projections to BF16, asymmetric F32 SwiGLU
with an optional route weight, direct FP8 casting and BF16 down projection.
Gate/up share one decoded packed input. The whole-expert static budget covers
simultaneously live activations, and the constructor checks aggregate retained
weights and a consistent owning device/limits. Concrete regressions produce
7 when applying a 0.3 route weight before the down-input cast, versus 7.2 if
weighting the already quantized down output. Distinct gate/up weights produce
14, proving the asymmetric gate order. Shared experts omit route weighting.
Full MoE expert dispatch/combination and model parameter binding remain missing.

An additional ownership test initially failed: 217 passed / 1 failed in
`native-raw-linear-verified-tests.*`. Its isolated rerun is retained in
`native-raw-linear-alias-isolated-failure.*`. The test incorrectly assumed
that `Var::from_tensor` aliases a non-variable tensor. Candle 0.10.2's
`make_var` allocates and copies storage. The corrected test verifies that
the copied variable changes, the activation stays unchanged, and invalid
public packed-scale inputs still refuse. The isolated corrected case passes
in `native-raw-linear-final-alias-test.*`. No numerical oracle or format
refusal was weakened. Redundant per-decode scalar checks were removed after
this ownership proof; constructor and finite-output validation remain.

Six pinned TileKernels blobs and the exact Candle copy-semantics file hashes
are in `raw-linear-source-reference.json`; provenance is updated in
`docs/source-manifest.json`. Tiny width-32 fixtures prove group-32 math, not
support for width 32 in the pinned CUDA per-token frontend, which requires
width divisible by 64. The expanded F32 control refuses decoded overflow;
factorized hardware GEMMs may support a broader packed range and need their
own T008 qualification. Static per-component budgets are not aggregate Power
permits, measured H200 peaks, or runtime allocator/workspace proofs.

T007 remains open: complete tensor/table binding, full attention/MoE/layer
composition, exact RoPE construction and model state registration are still
required before complete native generation. No CUDA build, GPU execution,
native model/service/key, remote deployment or restart was performed here.

Commands run at the repository root with Rust 1.97.1:

| Command | Result | Retained record |
|---|---|---|
| `cargo metadata --locked --offline --no-deps --format-version 1` | PASS; root members and private/local declarations | `workspace-metadata.json`, `workspace-integration-identity.json` |
| `cargo check --locked --offline -p a3s-deepseek` | PASS before reference behavior | `native-minimal-check.log/json` |
| `cargo test --locked --offline -p serde-saphyr -p saphyr-parser-bw --lib` | PASS; 26 + 5 tests | `dependency-compatibility-offline-tests.log/json` |
| `cargo test --locked --offline -p a3s-power --no-default-features --features server --lib runtime_service` | PASS; 3 tests | `runtime-service-focused-tests.log/json` |
| `cargo test --locked --offline -p a3s-deepseek --lib` | PASS; 16 tests | `reference-focused-tests.log/json` |
| Same focused command after compression-state implementation | PASS; 25 tests | `reference-compression-tests.log/json` |
| Remote Linux `unittest` discovery over the qualified XQ operator bundle | PASS; 68 tests, no skips | `xq-prepared-release-tests.log`, `xq-prepared-release.json` |
| Real server-only Power mode probe on H200 | PASS; 5 checks, frontend stopped; no model computation | `h200-frontend-usage-smoke.json` |
| Prepared and active nonweight preflight / waiter replacement | PASS; 11 artifacts, 1,376 ggml blobs, 28 operators | `xq-preparation-activation.json` |
| `python -X utf8 tests/workspace_dependencies.py` | 5 PASS, desktop build-script stub ERROR; isolated reproduction retained | `workspace-final-dependency-guards.log/json`, `workspace-studio-guard-isolated.log/json` |
| `python -X utf8 tests/crate_drift_report.py --baseline tests/crate_drift_baseline.json` | FAIL; 61 shared-copy findings outside the added packages | `workspace-crate-drift.log/json` |
| `cargo fmt --all -- --check` | Cannot run on this Windows invocation: OS error 206, argument length | `workspace-format-check.log/json` |

The focused model/Runtime format checks have separate result files. Full
guard and format failures were not waived or rewritten as passes. T001's
relevant local dependency/workspace checks pass within the full guard run.

Cargo registry DNS/index attempts failed before the successful offline
qualification. Missing public crate archives were subsequently fetched using
verified HTTPS and root-lock SHA-256 checksums. No TLS verification was
disabled, no permanent network settings changed, and the loopback tunnel
experiment was shut down. Source identity and the root lock delta are retained.
The initial source snapshots and dependency checks included no credentials
or user session state.

The later official reference-scoring requests used the existing backend
credential in place on H200; no credential value was returned or retained.
The real frontend-mode probe created a private test credential, stopped its
service and retained only counts and check results. No task credential was
delivered as a native service key.

One Windows benchmark test initially observed a zero-duration synthetic
batch at the host clock resolution. Its isolated failure is retained; the
test now supplies a deterministic clock, and a separate test verifies that
invalid timing keeps completed request records without reporting a rate.
The first remote test-result retrieval contained additional progress output;
the saved Linux result was retrieved by exact archive SHA rather than rerunning
or reactivating it. Both conditions are reflected in the retained logs.

### T007 MoE and shifted FFN composition continuation

The verified MoE/FFN suite passes **229 / 229**, no ignored tests; its
locked/offline all-targets check and package fmt pass. Raw commands and
results are in `native-moe-sublayer-verified-tests.*`,
`native-moe-sublayer-check.*`, `native-moe-sublayer-format.*` and
`native-moe-sublayer-workspace-format.*`. Earlier 225/228-test steps remain.

`MoeBlock` binds a complete logical expert inventory, MXFP4 routed experts
and one FP8 shared expert on the same device/limits. It quantizes hidden
input once, copies only bounded selected U32 route metadata to the host for
unfused scheduling, gathers packed rows/scales, computes only nonempty expert
groups, and combines BF16 expert outputs in F32. Route weights are applied
inside SwiGLU before the down-input cast, once. Shared output initializes the
accumulator, followed by top-k lanes in router order, with one final BF16 cast.
Composite static budgets cover the control's live tensors and host metadata.

A new regression exposed an incorrect shared-last accumulation: with shared
`A = 18 * 2^25` and routed lanes `[-A, 18]`, it returned zero instead of 18.
The isolated failure and corrected result are retained in
`native-moe-shared-order-isolated-failure.*` and
`native-moe-shared-order-fixed-test.*`. The fixed order follows the pinned
DeepEP reference with local/scaleup grouped reduction disabled. Profiles
that round rank-group reductions to BF16 are numerically different and are
not implemented or claimed equivalent. No DeepEP CUDA code was imported,
linked or run; its MIT notice accompanies the Rust algorithm adaptation.

`MoeSublayer` composes shifted mHC pre, explicit learned effective RMSNorm,
the complete MoE block and shifted mHC post. Nonuniform stream fixtures
distinguish the previous-sublayer mix from an unshifted implementation;
batch/token partitions and repeated FFN halves agree. Parameter bytes and
the combined live budget are checked across all three owners. Full attention,
Engram placement, official tensor binding and model iteration remain separate.
Pinned source identities and the numerical profile are retained in
`moe-sublayer-source-reference.json`.

### T007 index projection and main compressor continuation

The complete updated suite passes **240 / 240**, zero failed/ignored, with
`cargo test -p a3s-deepseek --locked --offline --no-default-features --lib`.
Locked/offline all-targets check and package fmt pass. Workspace fmt retains
the Windows command-length error 206. Receipts and raw output are
`native-compressor-first-tests.*`, `native-compressor-check.*`,
`native-compressor-format.*` and `native-compressor-workspace-format.*`.
These are CPU mathematical/state proofs; no CUDA build or GPU was executed.

`IndexQueryProjection` accepts the main query's normalized latent, performs
the actual group-32 FP8 input cast and FP8-weight projection to BF16, applies
interleaved RoPE to the last 64 of each 128 channels and encodes packed FP4.
The separate BF16 current-hidden projection supplies signed effective head
weights without an additional softmax/head-count scale. It adds no index Q
norm. `IndexKeyProjection` consumes the main compressor's post-norm/pre-RoPE
latent, performs BF16 projection, its own learned RMSNorm, tail RoPE at the
explicit compressed positions and FP4 encoding. Zero completed C2 pairs
produce zero key rows. Actual packed outputs drive causal sparse top-k.

Source audit corrected an earlier working assumption: the name
`fused_norm_rope_hadamard_cast_store_kvcache` does not imply Hadamard is
enabled. The pinned index Q/K and main-compressor callers omit HadamardArgs,
whose default is None. This production path therefore has no Hadamard stage.
The supplied FP32 cache still requires independent frequency/YaRN qualification.

`KvCompressor` connects complete BF16 A/Gate matrices to compression state.
C1 projects to BF16; C2 projects scores and latents to F32 before two-token,
per-channel softmax and BF16 emissions. A precision regression gives
1.0078125 for an equal-weight pair, versus 1.0 if projections are prematurely
rounded to BF16. Emissions pass through learned effective RMSNorm, explicit
tail RoPE and either typed main-KV format. The distinct post-norm/pre-RoPE
view is retained for index K; quantized main KV is not substituted for it.

Integration tests cover every partition of four tokens in both compression
kinds and both main formats. Main and index rows match one-shot execution
after atomic compression/main/index commits. C2 partial acceptance retains
exactly the pending half and accepted key rows; subsequent completion agrees.
Cancellation after all three states stage leaves all owners unchanged.
Projection/norm/layout/device/limits/position and joint resource failures
refuse without publishing state.

The first projection run found an F64 cache fixture where the public boundary
requires F32 (230 passed, six failed). All six failures were rerun alone in
`native-index-projection-isolated-cache-failure-{1..6}.*`; the fixture now
declares Vec<f32>. The next run passed six of seven new cases and exposed a
scalar sparse-diagonal oracle retaining negative zero where GEMM accumulates
into positive zero. Its isolated failure and corrected dot-product oracle are
in `native-index-projection-isolated-zero-failure.*` and
`native-index-projection-corrected-zero-test.*`. Packed-byte comparisons remain
exact; production refusal or numerical tolerances were not weakened.

`index-compressor-source-reference.json` records pinned caller and fused-op
hashes, including the disabled Hadamard argument. Provenance and notices are
updated. `p1-compressor-source-identity.json` binds the resulting sources and
commands. T007 stays open: complete attention/output projections, Engram table
and projection binding, all official parameters, full model-state registration
and exact FP32 cache construction/qualification are still missing. T008–T026
remain incomplete; no native service or task credential was created.

### T007 projected attention, sparse Engram and shifted attention continuation

The updated suite passes **263 / 263**, with zero failed/ignored tests.
Locked/offline no-default-features all-targets check and package fmt pass.
The mandatory workspace fmt attempt still reports Windows OS error 206;
it is not reported as passing. Final receipts and raw output are retained in
`native-engram-attention-final-{tests,check,format,workspace-format}.*`.
The earlier 251-test projected-attention checkpoint is separately preserved
in `native-attention-final-*`. No CUDA build or GPU was executed.

The main attention branch shares one packed current-hidden input between
Q-A and own-layer SWA, reuses the normalized packed Q latent for index Q,
and performs Q/SWA tail RoPE. Output applies conjugate tail RoPE, grouped
Wv, BF16 rounding, FP8 casting and Wo. A rounding counterexample distinguishes
BF16-then-FP8 (1.0) from direct F32-to-FP8 (1.125) for accumulator 1.06640625.
Pinned DeepGEMM epilogue audit confirms the former boundary, including its
fused FP8 output. Its SM100 group-32 kernels were not imported or inferred
to run on SM90. Pinned norm CUDA source also confirms BF16 before FP8; the
existing learned-Q-norm boundary was retained.

`AttentionSublayer` composes carried shifted mHC, learned norm, the complete
attention branch and mHC post. Its prepared handle exposes the exact current
hidden and packed query/window rows for the model's compression/index/state
stage. Independent uniform-sink golden rows 512/704/768 agree for prefill
and decode, including residual updates. A nonuniform four-stream trunk
distinguishes the carried pre mix from the current sublayer's own mix.
Foreign owners, cancellation and aggregate working-set/residency failures
refuse without publishing the prepared window proposal. Full model state
participants must still be registered by the model owner.

`EngramTable` owns the verified Power matrix binding without allocating the
full table on a device. It deduplicates requested IDs, coalesces consecutive
row reads within the raw-byte budget, uploads directly from Power-owned
zeroizing ranges, and reassembles the exact 24-head order. FP8 and SF bytes,
duplicate rows and signed zero remain unchanged. Entire image rows (-1)
use a real packed zero row, never read table storage and never become unsigned
offsets. Mixed/other negative IDs, NaN data/scales, wrong layouts, excessive
state/context budgets and cancelled work refuse. The explicit n-gram entry
also validates the exact hash layer's table extent.

The fused Engram projection consumes those actual packed width-6144 inputs
and produces BF16 keys/value for the existing signed-root gate. It preserves
the carried mHC mix and image residuals. A distinct private checkpoint-scale
boundary retains UE8M0 code zero as 2^-127; public live-cast padding refusal
is unchanged. An independent precision case retains table value 2^-136,
projects it with weight 2^120 and half gate to exactly 2^-17. Premature BF16
table decoding would return zero. Gate weights are now immutable finite
snapshots; input/output, boolean-mask and composite resource checks were added.

The first Engram run passed 259 tests and failed one incorrect fixture
assumption. Its isolated failure is retained in
`native-engram-isolated-open-handle-failure.*`: Power pins an already verified
open file handle, so unlinking its pathname does not make subsequent reads
fail. The corrected test truncates only its private positional-read fixtures;
image lookup still succeeds without reading, while text lookup refuses. Its
isolated passing result is in `native-engram-corrected-image-io-test.*`.
Production storage policy was not weakened. New source/precision/header
audits are in `attention-engram-source-reference.json`; upstream notices
and `docs/source-manifest.json` are retained/updated.

Read-only XQ observation at **2026-10-23 08:30:25 +08:00** reported
119,452,899,655 / 162,954,903,552 transferred bytes (**73.30427%**), including
1,628,707,143 in-flight bytes. Nine of sixteen final filenames exist; this
does not independently verify full payload hashes. The 5,661,492,320-byte
sidecar is complete. Downloader 217634/start 255375652 and waiter
335316/start 259373957 were live with the expected UID/start identities;
no deployment record existed. See `xq-download-1792715425.json`.

T007 remains open for the complete layer/model binding, runtime shared
compression/index/candidate coordination, all state participants and exact
FP32 frequency/cache generation. File-range lookup is a correctness baseline,
not Engram HBM residency or distributed/async lookup. Static component bounds
are not full Power permits, actual allocator peaks or H200 qualification.
T008–T026, native endpoint and temporary Key delivery remain incomplete.

### Abnormal-close recovery and official parameter binding, 2026-10-23

Recovered the existing task and worktree without resetting in-flight edits.
The interrupted FP32 RoPE factory, 53-participant `BackboneState` and complete
shifted `TextDecoderLayer` were still present; a fresh locked/offline,
no-default-features library run passed all **281** tests (`resumed-281-tests.*`).

Added `weights/text.rs`: the model owner declares the exact official 40-layer
parameter schema, including **93,415** storage descriptors. Each layer's
sorted names/dtypes/shapes/bytes matches the independent pre-interruption
header audit's SHA-256. Source-only compressor/index-K and index-Q ownership
comes from `LayerBinding`, preserving C1's absence of gate parameters,
own-layer window KV, routed MXFP4, shared FP8 and per-row Engram scales.
Embedding/head/norm use the separately inspected official names and shapes.
Schema validation refuses missing/extra/duplicate or wrong descriptors before
large uploads; small BF16/F32 parameters retain their exported bits through
bounded, finite-checked Power range reads. Quantized matrices retain the
existing explicit layout/row-upload path. This is parameter binding, not a
complete loaded model or a model-wide resource permit.

Six added hermetic tests cover all 40 observed header digests, topology,
FP32/BF16 signed zero/subnormal preservation, nonfinite/dtype/shape/read and
resident/live-byte refusal, cancellation, closed namespaces and packed FP4
container/scales. The first run passed 286 and failed the header digest test;
its isolated failure is in `native-parameter-isolated-digest-failure.*`.
The fixture had used a literal backslash+n instead of LF. Independent
reconstruction from the observed header samples confirmed LF; correcting
the test separator passed every frozen digest without changing production
layouts or the independent reference. The passing isolated result is retained
in `native-parameter-corrected-digest.*`.

Final commands (`native-parameter-final-*`):

- `cargo test -p a3s-deepseek --locked --offline --no-default-features --lib`:
  **287 passed, 0 failed/ignored**.
- `cargo check -p a3s-deepseek --locked --offline --no-default-features --all-targets`:
  passed.
- `cargo fmt -p a3s-deepseek -- --check`: passed.
- `cargo fmt --all -- --check`: Windows error 206, not passing.
- `tests/workspace_dependencies.py`: five passed, one existing desktop
  build-script fixture error, reproduced alone in `resumed-studio-fixture-isolated.*`.
- `tests/crate_drift_report.py`: report generated, **61 existing findings**;
  report exit zero is not a clean drift gate. No baseline was changed.

The plan consistency recheck is in `analysis.md`. T007 remains open for
complete model/runtime integration and qualification. T008–T026 and the
native endpoint/temporary Key remain incomplete. The active goal was restored
with the original full deployment/optimization/delivery requirements.

The first recovery observation found 125,782,533,958 transferred bytes
(77.18855%) with downloader 217634/start 255375652 and launcher
335316/start 259373957 still live. The byte count stayed unchanged across
eleven minutes. Inspection confirmed all four local tunnel supervisors/SSH
children absent and all four remote ports refusing connections. The existing
authenticated Windows loopback exit on port 18890 remained live.

Restarted only the four existing `keep_download_tunnel.ps1` helpers in hidden
windows. Did not restart downloaders, change credentials or submit a GPU job.
New supervisor/SSH PIDs were 121528/156548, 171224/116044, 175792/161744 and
108988/167996 (`resumed-download-supervisors.json` retains process start times).
Each tunnel rejected anonymous clients, accepted the existing private
credential, refused an unlisted host and downloaded the 3311-byte pinned
official config with the exact expected SHA-256. Boolean/numeric probes are
retained in `resumed-download-tunnel-before.json` and
`resumed-download-tunnel-after.json`; credentials are absent.

At **2026-10-23 10:39:04 +08:00**, the original main process had transferred
126,047,103,970 / 162,954,903,552 bytes (**77.35091%**), increasing by
**264,570,012 bytes** after connection restoration. Nine of sixteen final
filenames exist; 2,015,341,538 in-flight bytes remain unverified. The sidecar
is complete. Both original UID/start identities remain live and there is no
deployment record. See `xq-resumed-download-1792723144.json`. This proves
resumed transfer, not completed payload verification or inference.

### T007 loaded-layer and transaction acceptance, 2026-10-23

**Result: T007's hermetic operator/layer/state scope is complete.** This
does not close T008's CUDA/kernel qualification, T009's complete model
loop/placement and actual H200 model validation, or the overall deployment.
`t007-loaded-step-acceptance.json` maps the 302 passing tests to components
and retains all 91 Rust source identities plus the adversarial review.

`DeviceMatrix::load` now uploads raw matrices in Power-owned bounded reads.
FP8 tiles retain full 32-row scale blocks except the checkpoint's final tail;
per-row FP8/FP4 and unquantized BF16/F32 retain their original bytes. Each
range owns zeroizing host memory. Device concatenation and host chunk lists
are bounded before allocation; inadequate block budgets, invalid ranges,
bad late scales and cancellation refuse without returning a loaded matrix.
The original read budget is retained, not increased to fit the full tensor.

`weights/text/load.rs` composes the actual attention, shifted mHC, MoE,
Engram, source compressor and index projections from their verified bindings.
The public entry reconstructs the official schema; reduced fixture geometry
is private to sibling tests. It prechecks a conservative aggregate component
resident bound, excludes the range-backed huge Engram tables from HBM, and
uses the exact exported effective parameters and RoPE profiles. This static
bound is not a model-wide Power execution permit or a measured GPU peak.

`model/sharing.rs` advances one layer at a time, reuses the nearest declared
top-k and layer20's candidate blocks, and validates exact current compressed
row identities, causality, sorted IDs, padding and metadata limits. Only
bounded integer IDs cross to the host; Q/K/hidden payloads stay on device.
An independent 40-layer test executes the actual packed indexer and decoded
attention: layers20–23 produce BF16(8/26), while layers24–39 produce BF16(8/10)
after the candidate restriction. This is model control qualification on CPU,
not actual eight-card execution.

`LoadedTextLayer::forward_pending` now composes real layer preparation,
Engram reads, own-layer window updates, source compression/index-K, shared
index selection and attention/FFN finishing. It stages all mutations into
`PendingBackboneStep`; no layer publishes KV or n-gram history by itself.
Any error poisons both state and sharing, including an error after projections
have staged data. Tiny checkpoint tests execute odd/even C2 emissions and a
no-completed-pair chunk. Ignored order failures, range mismatch and cancellation
cannot publish partial state; dropping the failed request releases its leases.
The fixture stages layer1's window separately, without a giant Engram table,
so it is explicitly not full-model inference.

The first loader fixture used lowercase SafeTensors dtype tags. The parser
correctly refused it; the unchanged compiled test binary reproduced the
failure alone (`native-loaded-layer-isolated-binary-fixture-failure.*`). The
fixture was corrected to the format's uppercase tags. A later 16384-byte
fixture budget correctly refused the minimum 16400-byte output FP8 block;
its isolated result is retained in `native-loaded-layer-isolated-fixture-failure.*`.
The fixture now declares that exact budget and uses two-block projections,
while the production minimum-block check is unchanged. The nonzero shared
expert must produce **BF16 3072** from independently calculated clipping,
FP8 rounding and down projection; a no-op loader cannot satisfy this test.
A private-import compile failure and its correction are also retained.

Final validation:

- `cargo test -p a3s-deepseek --locked --offline --no-default-features --lib
  --target-dir target/h200-native/test-target`: **302 passed, 0 failed/ignored**
  (`native-loaded-step-corrected-tests.*`).
- The same feature/build boundary with `cargo check --all-targets`: passed
  (`native-loaded-step-final-check.*`).
- `cargo fmt -p a3s-deepseek -- --check`: passed.
- Required `cargo fmt --all -- --check`: still Windows error 206.
- Workspace dependency guard: five passed, one desktop build-script stub
  error; its isolated reproduction is in `native-loaded-step-studio-isolated.*`.
  No desktop source or test ratchet was changed.
- The drift report retains **61 existing findings**
  (`native-loaded-step-drift.*`); report exit zero is not a clean drift gate.
  No baseline was changed.

Another desktop build held the shared target lock, so validation used a
separate target directory under this same repository, the same root manifest,
lockfile and Rust 1.97.1. No new workspace/lockfile or repository was created.
The root lock was initially stale against current desktop manifests. Its
pre-change bytes are retained in ignored `target/h200-native/lock-before-native-load.txt`;
one offline reconciliation only removed the stale desktop BGE/GTK entries
and updated the already changed Studio version to 2.1.3. Exact diff and hashes
are in `native-load-lock-reconcile.{diff,json}`. Native dependency versions
were not changed by that reconciliation.

At **2026-10-23 11:13:00 +08:00**, the original XQ main downloader had
transferred 130,086,816,174 / 162,954,903,552 bytes (**79.82995%**), including
1,860,749,742 in-flight bytes. Nine final part filenames exist; full payload
verification remains incomplete. The sidecar is complete. Main PID 217634/start
255375652 and waiter PID 335316/start 259373957 remain live with expected UID 10250;
no deployment record exists. See `xq-loaded-step-download-1792725180.json`.

### T008 original CUDA profiles and pending H200 qualification, 2026-10-23

**Result: implementation and local validation progressed; T008 remains open.**
`cuda.rs` now declares closed, explicitly selected `Sm90Group32MmaV1`,
`Sm90ScalarF32V1` and `TensorControlV1` profiles. Public construction still
requires CUDA. CPU arithmetic fixtures explicitly select tensor control;
there is no production CPU fallback and no automatic fallback after an MMA
error. The original Power F32 API and Cargo dependency boundary are unchanged.

The original `cuda/group32.cu` consumes row-major packed FP8 or MXFP4 weights
and FP8 activations directly. A warp computes a 16x8 output tile; each K=32
group resets its F32 MMA accumulator, then applies the activation/weight
UE8M0 exponent sum. MXFP4 E2M1 values convert losslessly to E4M3 in registers.
The separate scalar CUDA control decodes each operand to F32 before its
multiply/add, including the meaningful checkpoint exponent zero. The tiny
CPU golden is 32 times `(2^-136 * 2^120) = 2^-11`; the H200 counterpart is
explicitly ignored until run on an owned H200. MMA refuses unsupported scale
envelopes and names the explicit alternative profiles. Cancellation and
finite validation remain enforced.

The Candle 0.10.2 / re-exported cudarc 0.19.9 bridge uses normal storage views,
stream event tracking and bounded contiguous snapshots. NVRTC compilation
targets `compute_90` with FTZ and FMA contraction disabled. Driver attributes
are queried before launch; unexpected local/shared allocation refuses the
zero-workspace profile. Receipts carry profile/ABI, source/PTX hashes, compile
options, attributes and output/workspace counts. These counts are not a GPU
peak measurement or a complete Power model execution permit.

Local CUDA 12.6.68 NVRTC compilation and `ptxas -arch=sm_90 -v` pass for both
entries: MMA uses 64 registers, scalar uses 29; both have zero stack, spill
stores/loads and barriers. **The assembler lowers the PTX E4M3 MMA to register
conversion and two `HMMA.16816.F32` instructions.** This is not evidence of
native FP8 hardware throughput, WGMMA or an optimization speedup. The complete
SASS and assembler output are retained as `sm90-sass-cuda126.txt` and
`sm90-ptxas-cuda126.log`. No SM100 or upstream CUDA kernel source was copied;
the instruction-coordinate reference is CUDA 12.6 PTX ISA 8.5 section
9.7.15.4.10, linked in `docs/source-manifest.json` and the CUDA source.

Validation (root workspace, Rust 1.97.1, isolated target directories):

- `cargo test -p a3s-deepseek --locked --offline --no-default-features --lib`:
  **305 passed, 0 failed/ignored**.
- The same package's `--features cuda --lib` tests: **305 passed, 0 failed,
  2 H200-only tests ignored**. This linked and executed the CUDA-feature
  build's hermetic tests; it did not execute the two hardware tests.
- CPU and CUDA `cargo check --all-targets`: passed. Package format: passed.
  Required root `cargo fmt --all -- --check`: Windows error 206 persists.
- Initial CUDA build failed because `cl.exe` was absent from the shell;
  selecting the existing MSVC environment fixed compilation. CUDA 12.6's
  older compiler guard required `NVCC_PREPEND_FLAGS=-allow-unsupported-compiler`
  for MSVC 14.44. The linked test initially lacked `cuda.lib`; adding the
  existing CUDA `lib/x64` to `LIB` fixed it. No registry source was patched.
  A legacy test-only device initializer missed the new profile field;
  using the existing CPU fixture constructor corrected it. Original negative
  logs and corrected results remain in `sm90-*.log`.
- Existing desktop workspace-guard fixture failure and drift findings remain
  as documented under T007; no native manifest/dependency or baseline changed.

`sm90-local-implementation.json` retains the local build identities and
100 source/manifest/toolchain/lock hashes. The final source/count receipt
is `sm90-final-source-and-validation.json`; earlier receipts remain retained.

One owned one-card, 600-second probe was submitted, then stopped **while still
Inqueue** to replace it with the complete dual-profile/driver-attribute test
package. UID and phase were checked; its frozen files were not edited.
The replacement is `aster-sm90-probe-1792727645-57460086`, UID
`69121e3e-728f-4645-8639-7f5957c8a82c`, namespace `ailab-hrprdduanyan`.
Its public source/PTX/worker hashes and showname are retained in
`aster-sm90-probe-1792727645-submission.json`. At 12:00 +08:00, its hashes
still matched and it remained Inqueue with actual `Unschedulable` events;
there was no worker log or result. A predict-only observation briefly reported
a schedulable node, but that was not an allocation and did not override the
actual scheduling failure. Pod inspection was forbidden by RBAC; that refusal
is retained and was not bypassed. The ready job will run its bounded ABI
microfixtures and exit if allocated. It does not run the Rust adapter or
complete official model, so even a later passing probe will not close those
unmeasured requirements. Container imports and driver execution have not yet
run. At 12:11 +08:00 the exact UID and artifact hashes still matched, with
no log/result and a fresh scheduling failure (`sm90-current-job-1792728665.json`).
No shared engine or download process was restarted.

At 11:43 +08:00 the XQ main downloader had transferred 133,549,316,729 /
162,954,903,552 bytes (**81.95477%**), including 1,699,371,641 unverified
in-flight bytes. Both original main/waiter process identities were live;
nine final filenames existed, the sidecar was complete and no deployment
record existed (`xq-sm90-step-download-1792727017.json`). This is a transfer
observation, not payload verification or inference acceptance.

The final 12:11 +08:00 download observation is **133,902,203,551 bytes
(82.17133%)**, including 1,683,159,711 unverified in-flight bytes. Both original
process identities remain live, with the same nine final filenames and no
deployment record (`xq-sm90-final-download-1792728704.json`).

## T008 Linux build preparation continuation (2026-10-23)

The exact root workspace/lock snapshot now passes Linux-host
`cargo tree -p a3s-deepseek --locked --offline --features cuda
--target x86_64-unknown-linux-gnu --prefix none` with Rust 1.97.1.
This is dependency-resolution evidence, not a compiled or executed CUDA
artifact. The source snapshot retains the original root manifests/lock and
actual target entries plus the complete selected local `deepseek`/`acl`/`power`
sources; it does not claim full-workspace source or tests. Its SHA256 is
`0e588748aafd244a76a16d3b88538aa45e45f5d435c5880d70709f2079781aaf`.

The public-only build cache is checksum-bound to the same root lock. Its v4
archive contains 223 registry archives and the two already pinned public Git
sources, with existing public submodules. No Cargo credentials, user config,
Git hooks or credential-related Git configuration were copied. Cache v1 lacked
the optional llama.cpp submodule needed during resolution; v2 omitted macro
archives because the tree display adds `(proc-macro)`; v3 still lacked additional
Linux-host resolution archives. All three negative preflights remain retained.
After adding only exact root-lock archives, the Linux offline preflight passed.
The final cache SHA256 is
`a051c170dbb7b918396f8169ce80b5ab0080d96e8505fa0f3ea720617a3e5493`.

The CPU-only RJob submission named `aster-native-linux-build-1792729610`
was **rejected**, not queued or run: this public GPU quota group explicitly
forbids zero-card tasks. A subsequent exact-showname inspection found no job.
The failed submission marker and complete refusal are retained; it was not
blindly resubmitted under another quota group.

The alternative build is an owned, bounded local Docker container using the
existing immutable Ubuntu 22.04 image
`sha256:829f6df217bcbae2b371026e81711d1a787c61b2967ad09d015063663ebafbf7`.
The container is `aster-native-linux-cuda-1792753576`, ID
`60d761403c8653d6a88ac24961d3552640ba9a532822e5f9b58b52568b5b72c1`,
with eight CPU cores, 20 GiB, no GPU request and a 2400-second outer timeout.
It uses a read-only copy of the known image's public CUDA 12.6.20 compiler,
headers and link-only stubs; 1835 files and their individual hashes were checked.
The tool archive SHA256 is
`7f19675f84ae19e8368b9319fde4ae70cfbc6f7b94f10745adde83dfab6c3658`.
No reference-replica files were changed and no GPU work ran there. The initial
stream-copy API incompatibility was corrected and retained. Link stubs must
never be used for runtime qualification.

The first local container preparation exited with SIGTERM before compilation;
the attached preparation then reached its 300-second package-index timeout.
Both failures are retained. Preparation continued with only the
Ubuntu main-component build packages and an attached session. Public input identities, frozen worker source,
preflight output and failures are in `linux-build-preparation-1792754370/`;
timestamped `linux-docker-build-*.json` files retain actual container observations.

The image's `docker-clean` APT hook also deleted cached packages on every index
update, so the first package-install timeout could not resume as intended.
The exact 59-package plan was instead retained outside that cache and checked
against SHA256 values from the already signature-verified APT metadata. One
official HTTPS response for `liblsan0` failed this check and was rejected. The
byte-identical TUNA Ubuntu mirror and bounded 512-KiB range transfer supplied
the remaining packages; every final package was rechecked before offline
installation. The mirror documentation is retained as
`https://mirrors.tuna.tsinghua.edu.cn/help/ubuntu/`. A Windows CRLF checksum-list
failure was corrected with an explicit LF writer. No package version or
payload-hash requirement was relaxed. All negative output remains retained.

The first real build reached root workspace parsing and found an omitted
implicit example entry, `sandbox_smoke_test`. The snapshot packager now includes
the real explicit and implicit bin/test/bench/example entries and custom build
entries, without creating source stubs. The complete 3232-file v2 snapshot SHA256
is `95cc87abbdaa2838d9fcd59345d6cbf836935db5d74cd10adeb916a56e713836`.
During preparation the working tree's `crates/orm/Cargo.toml` and root lock
changed. The byte-identity check refused the new snapshot. A structured comparison
then showed the sole changed lock entry was local `a3s-orm 0.3.1`; all registry/Git
entries and all existing native `deepseek`/`acl`/`power` files were unchanged.
The build was rebound to that current snapshot and lock SHA256
`b4658c05fe97dc195373d46ebb81deb001a58cb870f64f7ecb3671e4d38894a9`.
This work did not overwrite or restore the unrelated ORM changes.

The current root snapshot passed locked/offline metadata and
`cargo test -p a3s-deepseek --locked --offline --features cuda --lib --no-run
--message-format=json` on **Rust 1.97.1 / CUDA 12.6.20 / glibc 2.35**.
The command completed successfully in 65.50 seconds and produced the actual
Linux Rust CUDA test executable:

- Binary: 78,403,336 bytes, SHA256
  `9d333f518b87735fd2bb2629e0ef17e65750ad34dac9111eb74f0a7793045f36`.
- Gzip artifact: 18,119,318 bytes, SHA256
  `975071d9df5f468a669bb72aacd8ca2b3612a57af235785fa2702b090e233ccb`.
- `readelf` reports a maximum GLIBC requirement of 2.34. Docker's `ldd` lacks
  the real CUDA runtime/driver libraries as expected for this GPU-free,
  link-stub build environment; the executable was **not run there**. This is
  a successful compilation, not a runtime-compatibility or GPU-numerics pass.

The artifact, input manifest and standard-library-only qualification worker
were uploaded and their hashes verified. Distinct Rust qualification RJob
`aster-sm90-rust-1792756991-93148350`, UID
`96f7a6f4-1544-4dc8-8351-4eb258ea3c44`, was submitted once. It requires a
single idle H200 and real runtime libraries, then runs the 305 hermetic
CUDA-feature tests and the two explicitly ignored H200 tests. It refuses
link-stub runtime paths and active foreign GPU processes. The pool admitted
20 CPU / 220 GiB / one GPU; the command has a 600-second bound and no restart.
At 20:06 +08:00 it remained Inqueue/Unschedulable, its frozen hashes matched,
and no worker/test output or result existed (`sm90-rust-job-1792757190.json`).
The older raw-PTX microprobe remains separate; it was not overwritten or
resubmitted. Build results, exact source/lock transition, worker code, symbol
requirements and original failures are in `linux-build-result-1792757322/`.

At 19:13 +08:00 the exact H200 probe UID and frozen hashes still matched,
but it remained Inqueue/Unschedulable with no worker log or result
(`sm90-current-job-1792754036.json`). T008 remains unchecked, and the complete
model/generation/service requirements of T009–T010 remain incomplete.

At 19:07:53 +08:00 XQ had transferred 153,946,931,351 / 162,954,903,552
bytes (**94.47211%**), including 1,964,327,063 unverified in-flight bytes.
Completed ranges were 93.26667%; nine final part filenames existed, the
5,661,492,320-byte MTP/Vision sidecar was complete, both original process
identities remained live, and no deployment record existed
(`xq-download-status-1792753673.json`). Transfer completion and payload/model
acceptance are still separate outstanding requirements.

At 20:06:30 +08:00 XQ had transferred 161,898,268,098 / 162,954,903,552
bytes (**99.35158%**), including 755,303,874 unverified in-flight bytes.
Completed ranges were 98.88807%; 13 of 16 final part filenames existed, both
original process identities were live, the sidecar was complete and no
deployment record existed (`xq-download-status-1792757190.json`).

## XQ download completion and owned submission recovery (2026-10-23)

At 20:15 +08:00 the pinned manifest and tree hashes matched, all **16** final
parts matched their expected sizes, totaling **162,954,903,552 bytes**, and
the original downloader log contained `MODEL_PARTS_VERIFIED`. The downloader
publishes each part only after its full SHA256 matches the pinned manifest;
the completion marker follows successful completion of every part future.
Thus main transfer/integrity verification is complete. This observation did
not independently reread all 163 GB. The 5,661,492,320-byte MTP/Vision sidecar
was already complete. See `xq-completion-inspection-1792757713.json`.

The original waiter then failed before creating an RJob. Exact-showname
inspection confirmed zero matching jobs. A read-only predict-only reproduction
without environment initialization failed with `brainpp only work in kubebrain
environment`; the identical command with the normal `ssh-init.sh` initialization
succeeded. Predict-only capacity output was not treated as an allocation.

Recovery acquired the existing launcher lock, checked that the original waiter
had exited, verified the original launcher against its operator manifest and
checked the completed-download marker. It preserved the failed submission
record in an owned recovery directory, ran the existing launcher's real
nonweight preflight, and initialized the RJob child environment. It made exactly
one new submission and retained CLI stdout/stderr plus the previous failure.
No downloader was restarted, and the active verified operator bundle was not
changed. The local activation helper now initializes the cluster environment
for future waiter launches. The recovery helper and receipt are retained in
`xq-environment-submission-recovery.json` and the local build scratchpad.

The independent **XQ external reference deployment**, not the native Rust
model service, is now submitted as
`a3s-power-xq-h200-final-6522e5af2fc3-31676386`, UID
`6230a46e-8868-4e2c-a803-0321962f98a6`. At 20:27 +08:00 this eight-card job
and both one-card native kernel qualification jobs were still Inqueue with
actual scheduling failures (`h200-owned-job-states-1792758431.json`).
No new GPU inference, native endpoint or temporary API Key is claimed.

## 2026-10-23 XQ deployment planning refresh

The user requested an H200 deployment plan for the XQ quantization. The existing
009 plan now includes an XQ-specific resource budget, model/source pins,
milestones, file owners, correctness/performance gates and URL/Key delivery
criteria. The final executor remains native Power/a3s-deepseek; Xolotl is a
separate same-XQ reference. The proposed minimum-delivery path brings T022
alongside the shared native model work before optional advanced optimization;
implementation must synchronize task dependencies before following that order.
No task checkbox was closed by this planning change.

Read-only checks at 21:09–21:10 +08:00 again confirmed 16 final parts,
162,954,903,552 bytes, matching sizes and the original downloader's verified
completion marker. The observer did not reread the complete payload. Exact
UID/showname checks found all three owned jobs still Inqueue. The eight-card
request remains 160 CPU / 1760 GiB / 8 GPUs; its latest retained scheduling event
names CPU, memory and node-selector restrictions. No remote job was created,
modified, restarted or stopped during planning.

Pinned upstream documents were retrieved through their public raw URLs after
the browser fetch failed for the model card and GitHub tree. Retrieval URLs,
hashes and lengths are in `xq-planning-public-sources.json`; full third-party
documents were not retained. Read-only inspection of the staged source archive
found indexer-aware boundary checking/adjustment in `ds41_pipeline.cpp`, and
shadow/import state handling in `ds41_geometry.hpp`. The plan therefore requires
actual resolved boundaries and state-handoff evidence rather than assuming the
requested five-layer intervals prove correctness. The source excerpts and hashes
are in `xq-layer-split-related-source-inspection.json`.

Validation: `xq-deployment-plan-checks.json` records five exact model/source pin
matches, five existing local Markdown link targets and balanced code fences.
The changed deliverables are planning documents and observation evidence;
no Rust implementation or GPU inference tests were run for this change.
See `xq-completion-inspection-1792760970.json` and
`h200-owned-job-states-1792761029.json` for the timestamped observations.

The follow-up question about eight-card load balancing and KV affinity led to
a narrower source check. `service.py` configures one split8 execution group,
one active request and keep-cache disabled in the exact baseline; multi-group
cache-aware routing has not been delivered. The plan now distinguishes layer
placement, request-local state ownership and cross-request prefix reuse, and
describes a proposed owner/epoch-aware multi-group routing policy. At 21:36
+08:00 the exact owned eight-card UID was still Inqueue
(`xq-routing-observation-1792762595.json`). Six local plan links were checked;
no runtime behavior was changed or GPU tests executed. A source check also
corrected the earlier plan wording: Power listens on `0.0.0.0:30002`, while
the reference upstream listens on `127.0.0.1:8150`; external reachability is
still unverified.

## 2026-10-23 Native XQ format implementation and workspace recovery

Result: T022's bounded CPU format/header slice is implemented. T022 as a
whole remains open: native packed CUDA dispatch, verified payload storage,
expert binding, full generation and service integration are not completed.
The expanded user objective also explicitly requires server optimization
and pressure testing; FR-014/015, SC-007/008 and T027 retain those obligations.
Basic service startup is only an intermediate milestone.

What landed in the isolated working tree:

- `weights/xq.rs`: explicit GGUF type IDs and block sizes, checked per-row
  tensor byte counts, bounded PTQ1_0/Q2_0/Q3_K/Q8_0/F16/F32 decoding and
  lossless typed I32 metadata. Unknown types never default to F32; partial
  blocks, extra/truncated bytes, nonfinite values and output overruns refuse.
- `weights/xq/gguf.rs`: bounded GGUF v3 metadata/ranges, explicit quantization
  types, duplicate/overlap/alignment/overflow rejection, and a public handle
  accepting only the independently observed XQ V3 header hash. Large token
  arrays remain bounded byte-range descriptors rather than per-token objects.
- Ten independent pinned NumPy vectors, exhaustive PTQ/Q2 packed-byte
  digests, all 63,488 finite half encodings, and adversarial parser tests.
  Xolotl's MIT notice and source/fixture provenance are retained.
- The real 5,865,472-byte header has 68 metadata keys and 1,329 tensors.
  Both independent Python and Rust catalogs agree on every name, shape,
  type, absolute offset and size, catalog SHA256
  `86bcbf6dd2a1e96bad516151c4dd1c653c53874d6314a945609ad6e3cde528dc`.
  `xq-native-header-comparison.json` does not claim payload integrity or GPU
  execution. The first audit assumed at most 4096-byte alignment and refused;
  the pinned exporter's `v41_gguf_meta.py` and actual header establish 16384.
  That initial negative result is retained separately.

A concurrent stash/pull workflow removed the shared root's untracked native
crate, specifications and evidence while checks were running. The user
confirmed these were not intentional deletions and requested restoration.
The inspected stash is `f06812aeb1ce705ad01d2753d85b2ee7aa9e9838`, untracked
tree `5ed182e502d4718ee5c62220cfdeabe7ca548d72`. Selective blob-verified
recovery restored 1,267 missing task files (10,878,267 bytes); it did not pop,
drop or apply the stash, alter the Git index, or overwrite existing files.
The recovery receipt and an ignored, hash-bound archive are retained.

Further work now belongs to the Git worktree
`D:/code/aster/.wt-h200-native-deploy`, based on existing commit
`58d83b92fe5363d19d59cd97903e04b94084a366`. It is inside the same repository,
excluded from root untracked operations, and has initialized private Studio
and Power submodules. No desktop source is added to the parent. The native
root manifest/lock/source inputs are restored from the previously verified
v2 build snapshot, preserving the concurrently edited shared root. Studio
is bound to `4b71efee44310092ef0e944f705a66bbaef12541` with the three actual
snapshot manifest inputs in its own private submodule. Git's normalization
of the JSON fixture was detected and its original hash-bound CRLF bytes
restored. See `isolated-worktree.json`, `isolated-worktree-inputs.json` and
`workspace-recovery-1792764545.json` for the exact recovery/build scope.

Validation in this worktree with Rust 1.97.1:

| Check | Result | Evidence |
|---|---|---|
| New XQ format/header focused tests | 17 passed | `xq-format-focused-tests.log` |
| Complete native model CPU library suite | 322 passed, no ignored tests | `isolated-native-model-tests.log` |
| Locked/offline package all-targets check | Passed | `isolated-native-all-targets.log` |
| Owning-package format check | Passed | `isolated-native-format-check.log` |
| Root dependency/workspace guard | 6 passed in the isolated inputs | `isolated-workspace-dependency-check.log` |
| Full-workspace format check | Windows OS error 206 | `isolated-workspace-format-check.log` |
| Initialized shared-crate drift guard | Failed: 62 findings; baseline unchanged | `isolated-workspace-drift-initialized-check.log` |

The isolated dependency result does not claim the shared root's changing
desktop fixture was fixed. Initial isolated lock refusal and absent lineage
roots were environment/input findings, not passing checks; matching native
manifest inputs and initializing tracked submodules were required. The
remaining full-workspace drift result is retained separately and is not
waived by the package checks.

The initialized isolated checkout reports 62 drifted names, including
`vm-memory`; its files are unchanged from this worktree's base HEAD. This
does not rewrite the earlier shared-root 61-name observation. No unrelated
vendor copy or baseline was edited to make the check pass. Structured
recovery/input failures, including the initially reused lock-refusal log
path, are retained in `xq-recovery-negative-observations.json`. The isolated
Rust diagnostic independently reran and matched the same full header catalog
(`isolated-xq-real-header-result.json`).

At 22:26 +08:00 all three exact owned jobs remained Inqueue
(`h200-owned-job-states-1792765573.json`). No downloader, GPU job or shared
reference service was restarted or duplicated during recovery. No native
endpoint, API Key, XQ GPU output, optimization gain or stress result is
claimed. The user goal remains active; next native work is verified GGUF
payload/range ownership, XQ device projections and complete model execution.

## 2026-10-23 XQ verified storage and packed device control

Result: the bounded T022 storage/device implementation continues in the
isolated worktree. The complete task and user deployment goal remain open.

Power now owns a format-neutral `VerifiedRawWeightFile`. It validates a
regular relative path under an explicit trusted root, file size and complete
SHA256 on the same retained file handle. The verification pass keeps one
digest per 1 MiB chunk; each range read authenticates every touched whole
chunk before exposing zeroizing bytes. Hash index, scratch and maximum output
are checked together. Replacing the path cannot redirect the held handle;
same-length payload edits, truncation, overflow and budget/cancellation
refusals have hermetic coverage. The trusted host owns directory entries
during opening, as with WeightStore; concurrent retained reads still require
their caller's aggregate admission budget. Only buffered positional I/O is
offered, with no implicit strategy/source fallback.

The model owner binds this source to the pinned complete XQ hash before
reading the pinned header. It reads complete packed rows in GGUF order and
keeps integer metadata exact. Expert maps use the exporter's explicit
I32[384] Gate/Up and independent Down maps, validate every typed stack and
compute each expert's rank within its own type partition. Expert row reads
cannot cross into a neighboring expert. Test fixtures are tiny synthetic
files/catalogs; they do not claim that the real 163 GB payload was opened by
this new Power API yet.

`XqDeviceMatrix` uploads original packed bytes in bounded reads, validating
finite scalar values/block scales without expanding a resident matrix.
`cuda/xq.cu` adds the explicit `aster-sm90-xq-warp-f32-v1` math control for
F32/F16/Q8_0/Q2_0/Q3_K/PTQ1_0. One warp computes each F32 dot, with an actual
SM90 capability check and no CPU fallback. This is a correctness profile;
whole-model XQ activation/rounding rules and optimized kernels remain open.
Its receipt's zero scratch refers to the custom kernel only; contiguous
inputs and finite-validation tensors have separate conservative live bounds,
and neither bound is a measured GPU peak.

Validation with the pinned Rust 1.97.1 root workspace:

| Check | Result | Evidence |
|---|---|---|
| Complete native model CPU library suite | 337 passed after final storage changes | `xq-native-model-final.log` |
| CUDA-feature CPU/adapter suite | 338 passed; 3 H200 tests explicitly ignored | `xq-cuda-feature-final.log` |
| Power storage regression | 61 passed | `xq-power-storage-regression.log` |
| Final canonical-path raw reader tests | 11 passed | `xq-raw-storage-canonical-path-final.log` |
| Linux CUDA-disabled raw reader tests | 12 passed, including leaf/directory symlink refusal | `xq-linux-build-result/xq-power-storage-linux-resumed.log` |
| CPU and CUDA package all-targets checks | Passed | `xq-cpu-all-targets.log`, `xq-cuda-all-targets.log` |
| Owning package and edited Power format checks | Passed | `xq-package-format-final.log`, `xq-power-format-final.log` |
| Exact NVRTC source and SM90 ptxas | Passed; 32 registers, no stack/spills | `xq-cuda-compile.json`, `xq-ptxas.log`, `xq-control.sass.txt` |
| Workspace dependency guard | 6 passed | `xq-workspace_dependencies-check.log` |
| Full workspace formatting | Windows OS error 206 | `xq-workspace-format-check.log` |
| Actual shrink-only drift baseline gate | Failed; 62 findings, baseline unchanged | `xq-crate-drift-baseline-check.log` |

The initial storage-binding test used an associated method as a static
function and failed compilation; the test call was fixed, with the original
compiler output retained in `xq-storage-binding-tests-initial-compile.log`.
The default drift report exits zero without checking the baseline;
`xq-crate_drift_report-check.log` is report-only. The subsequent explicit
`--baseline tests/crate_drift_baseline.json` command is the actual failed
gate. No unrelated vendor sources or allowlist were changed.

The CUDA source SHA256 is
`532f3e038fbc107dcc395217919148450fa4b0453ffc96be766f339131dd5eab`;
the exact Rust NVRTC and independent compiler tool both emitted PTX SHA256
`f1be598b65c2eb5f3109202fcbc21f2d4cda1bf3192b8c9d1c7f39f72236beab`.
The new opt-in H200 test uses the ten independent golden rows, distinct
whole-block row rotations, small/partial tiles and the predeclared F64 dot
budget. It has not run. The old queued Linux Rust job still contains its
original official-kernel binary and cannot qualify these new XQ changes.
An updated source snapshot built successfully in the exact existing GPU-free
Ubuntu 22.04 container with Rust 1.97.1/CUDA 12.6.20. Its pinned inputs are
`xq-linux-build-inputs.json`, source archive SHA256
`47411554055156dcc3ebd04ecc882464a5d1c7eebd3ab43bee5c96bfd34da6d4`,
and actual CUDA test binary SHA256
`5fafca73b63b9c590d9ec060a7f8bdb825138a661c82af39cc7ae77bfcf55268`.
The current Rust/CUDA code, fixture data and root inputs match the built
snapshot; only subsequent documentation changed. The binary has not run
on H200. The CPU-only storage test initially refused because its isolated
offline cache lacked `anes 0.1.6`; the negative log is retained. A supplement
of 224 public crates (23,880,873 compressed bytes), each checked against the
unchanged Cargo.lock checksum, enabled all 12 Linux storage tests to pass.
No credentials, registry configuration, private source or user state was
copied. The owned build container retained its 8-CPU/20-GiB/no-GPU limits,
and its original entry script was restored byte-for-byte. Results and input
receipts are in `xq-linux-build-result/` and `xq-storage-cache-inputs.json`.
No GPU job, downloader or shared reference service was restarted.

At 23:06 +08:00 all three exact owned jobs remained Inqueue. The eight-card
event reported CPU/memory and node-selector constraints; the one-card events
also recorded GPU/node-affinity constraints. See `owned-jobs-1792768008.json`.
No real XQ CUDA output, native generation, endpoint/Key, speedup, sustained
load or fault-recovery result is claimed. T022 and the remaining full-model,
service, optimization and pressure tasks remain unchecked.

## 2026-10-23 late continuation: native XQ F32 components

Result: concrete T022 component work continued while the three exact owned
GPU jobs remained Inqueue at 23:55 +08:00 (`owned-jobs-1792770926.json`). The
previous goal turn made source/build/test progress; this turn likewise adds
executable components and target-platform evidence. It is not a completed
deployment or a reason to narrow the optimization/pressure goal.

The pinned Xolotl runtime/exporter confirms different XQ scalar boundaries
from the official BF16/FP8 layers: F16 embedding/mHC projections, F32
effective norms, routing parameters, shifted residual/pre-mix state and
head input, with a Q8_0 output. Exact reference Git blobs/SHA256s are retained
in `xq-runtime-reference-manifest.json`; no upstream revision was changed.
The new components follow the graph's math/data boundaries. GPU dispatch and
precision/quality comparisons against the reference remain separate gates.

Implemented in `weights/xq/parameters.rs` and `layers/xq/`:

- Small declared F16/F32 parameters load only through authenticated Power
  ranges; dtype, GGUF shape, finite values, raw/converted bytes, cancellation
  and read/resident/live budgets refuse explicitly. Quantized/large matrices
  continue through their packed owner.
- F32 effective RMSNorm preserves its output precision. Shifted mHC applies
  RMS to flat F32 values before the packed F16 projection, computes 24 mixes
  and 20 Sinkhorn iterations, uses the previous sublayer's carried mix, and
  keeps residual/branch updates and final head reduction in F32.
- F16 token embedding decodes only selected GPU rows, preserving duplicate
  and nonordered IDs; four initial streams use the exact one-hot pre mix.
  The output head reduces the carried trunk, applies the F32 norm and calls
  the original packed Q8_0 projection control.
- A new CUDA gather entry reads the same validated block layouts directly
  without a permanently expanded embedding. Integer metadata and bad IDs
  refuse; the kernel also guards invalid IDs before any weight access.
- Construction now requires identical resource limits between composed
  devices/matrices/norms. Adversarial review found that same-device handles
  with different limits could otherwise let a component delegate using a
  looser budget. This was fixed before final qualification and has a small
  refusal test. Existing official APIs and numerical profiles were preserved.

The tests freeze small-parameter bits, F32 mantissas, asymmetric Sinkhorn/
post orientation, carried-mix versus newly computed pre-mix, snapshot
independence, scalar F64 comparisons and refusal/cancellation/budget cases.
New opt-in H200 tests require bit-exact row gather against all ten independent
golden formats, then embedding/two nonzero-F16 projected mHC updates/norm/head
against independent F64 math. Those tests have not executed; five total H200
tests are explicitly ignored. This is neither a CPU serving fallback nor an
end-to-end transformer fixture.

Validation with the pinned Rust 1.97.1 root workspace:

| Check | Result | Evidence |
|---|---|---|
| Current model CPU library suite | 349 passed | `xq-f32-components-model-final.log` |
| CUDA-feature CPU/adapter/NVRTC suite | 350 passed; 5 H200 tests ignored | `xq-f32-components-cuda-final.log` |
| CPU/CUDA package all-targets checks | Passed | `xq-f32-components-cpu-all-targets.log`, `xq-f32-components-cuda-all-targets-final.log` |
| Owning-package format | Passed | `xq-f32-components-format.log` |
| Linux CUDA qualifier build | Passed; GPU execution not attempted | `xq-f32-linux-build-result/receipt.json` |
| Linux CUDA-disabled raw storage suite | 12 passed | `xq-f32-linux-build-result/xq-power-storage-linux.log` |
| NVRTC + SM90 assembly | Projection 32 registers; gather 23; no stack/spills | `xq-f32-cuda-compile.json`, `xq-f32-ptxas.log` |
| Root dependency/workspace guard | 6 passed | `xq-f32-workspace-dependencies.log` |
| Whole-workspace formatting | Windows OS error 206 | `xq-f32-workspace-format.log` |
| Shrink-only drift baseline | Failed: 62 findings; baseline unchanged | `xq-f32-workspace-drift.log` |

Source snapshot SHA256:
`84ca8ee1f2701357bc07e138204a132c664c72dbbb617146de457e16afb91c97`.
Linux test binary SHA256:
`2c83234183164bd83d7c3f6d343b8398a4793adc3186e432badc7edf80e06db1`.
CUDA source SHA256:
`b5340b19b94db04da98b3c642a91b87050b7986817c87f4cd791e4b994b53108`.
Exact NVRTC PTX SHA256:
`870c1dda641855b1c20fe3fafd19e691bd307a68bb01ec071837f9ccf62f698e`.
The current Rust/CUDA/fixture/root inputs match the independently built Linux
snapshot. Its container remained 8 CPU/20 GiB/no GPU; the original entry
script was restored byte-for-byte. Previous source/binary records remain
separate and the old queued GPU job inputs were not modified.

After verifying the exact jump-host stage directory and UID 10250, the new
binary/worker/manifest were copied to the new private directory
`native-xq-f32-v5-2c8323418316` under the existing owned task root. The
directory is mode 0700 and files are 0600; every transferred byte count and
SHA256 was checked before atomic publication. `xq-f32-h200-staging.json`
records the passive staging only: no executable was run, no GPU job was
created/modified, and no existing queued input was replaced. The worker
requires one allocated, idle H200 with real runtime libraries, checks the
exact five ignored-test names and runs the 350 hermetic tests before its
hardware tests. A launcher must verify the owned RJob UID before invoking
it; staging is not hardware qualification.

The next missing XQ execution piece is the F32 norm/router/mixed-expert FFN,
then attention/Engram/cache/state and the complete model/token loop. The
reference uses F32 expert activations, clamps gate above at 10 and up to
[-10,10], applies route weighting after the down projection, sums routed
lanes and adds the shared branch before the mHC update. The native component
must not reuse the official route-weight-before-FP8/down precision boundary.
For resident expert stacks, bounded row views should borrow their full
allocated owner; counting the logical bytes of a view as its retained
allocation would undercount memory. Complete model admission, multi-device
handoff, actual GPU/quality qualification and performance/pressure remain
open. No native endpoint, API Key or speedup is claimed.

## 2026-10-24 XQ resident MoE and shifted FFN continuation

Implemented the next XQ execution component in `layers/xq/moe.rs`. The exact
authenticated maps bind each logical expert to its gate/up and independent
down format/physical slot. Each typed stack has one allocated owner; the
new bounded row-projection API borrows packed rows without copying weights
or reporting a view's logical size as its retained allocation. Construction
rejects missing, duplicate, overlapping, unused or mismatched bindings and
admits the aggregate router/bias/shared/expert bytes before public upload.

The component preserves the pinned runtime's F32 boundary: F32 router and
stable sqrt-softplus, correction for top-k selection only, normalized
unbiased route scores scaled by 1.5, gate clamped above at 10, up clamped
to [-10,10], F32 SwiGLU, route weighting after down, routed-lane sum, then
shared addition. `XqFfnSublayer` composes carried shifted mHC, norm, MoE and
F32 residual update on one device with identical limits and combined
resident/live admission. No official BF16/FP8 activation boundary or CPU
numerical fallback is introduced. This remains an unfused correctness
control, with bounded host routing metadata and scalar status reads; no
latency, asynchronous-overlap or optimized-kernel claim follows from it.

Current verification:

| Check | Actual result | Evidence |
|---|---|---|
| Native CPU full library | 357 passed | `xq-moe-model-final.log` |
| CUDA-feature CPU/NVRTC library | 358 passed, 6 H200 tests ignored | `xq-moe-cuda-initial.log` |
| CPU and CUDA all targets | Passed | `xq-moe-cpu-all-targets.log`, `xq-moe-cuda-all-targets.log` |
| Owning-package format | Passed | `xq-moe-format.log` |
| Linux CUDA test executable | Built, not run on GPU | `xq-moe-linux-build-result/` |

The initial focused run had one failing test assertion: decimal literal
`1.0004_f32` differs by one ULP from `1.0001_f32 + 0.0003_f32`. The retained
`xq-moe-focused-initial.log` records that failure; the assertion now checks
the declared two-operand F32 result exactly, with no looser tolerance.
`xq-moe-f32-boundary-rerun.log` records its isolated pass before the full run.

The new ignored H200 test covers nonzero Q2_0/Q3_K/PTQ1_0 experts, different
down partitions, nonzero physical offsets, text/image correction, batched
versus single rows and complete shifted-FFN composition. Its independent
F64 routing/dot/activation/mHC equations use separately golden-qualified
decoded values, and freeze route-weight error at 2e-6, mHC pre-mix at 2e-6
and composed output at `2e-4 + 5e-5 * sum(abs(branch contributions))` before
hardware execution. It has not run on an H200 and is not a full-model test.

Linux source snapshot SHA256:
`656e52b16731c1186bde642864c41a9eab9b15533cdfd97561ad8af061608d39`.
Test binary SHA256:
`e1a485ab534e036ba145c6c5999a4371b883b837878c5e5fc89730ec5d4f07a7`.
The current Rust/CUDA/fixture/root inputs match that snapshot, built in the
same owned 8 CPU/20 GiB container without GPU access. The original build
entry was restored exactly. CUDA source and compile options did not change;
the prior NVRTC/ptxas receipts remain applicable. Unchanged Power storage
and workspace gates retain their previous evidence; the full-repository
format Windows error 206 and 62 baseline drift findings remain unresolved.

The new binary, bounded/self-verifying qualification worker and pinned
manifest were staged into the new owned private directory
`native-xq-moe-v6-e1a485ab534e`. All three file sizes and hashes were checked
before atomic publication; no test or executable was run remotely and no
GPU job/input was created or changed (`xq-moe-h200-staging.json`). The new
worker requires the exact six ignored-test names and 358 hermetic passes,
then six actual H200 passes; it refuses link stubs and non-idle GPUs. This
preparation does not qualify hardware execution or the complete model.

Latest owned-job observation: 2026-10-24 00:31 +08:00, all three exact UIDs
remain Inqueue (`owned-jobs-1792773104.json`). The next native execution
work is F32 attention/Engram/cache/state and the complete model/token loop,
followed by native service, eight-card qualification, measured optimization
and pressure tests. This slice does not close T022 or deliver URL/Key.

## 2026-10-24 XQ F32 attention execution components

Added three explicitly named activation formats in `layers/xq/quant.rs`.
They consume F32 before quantization, use actual F32 division for scale
targets and normalization, preserve signed zero, apply the pinned RNE
formats and publish bounded original packed data/scales. They convert into
the existing main/index typed storage only for the matching format. Finite
input that rounds onto an overflowing decoded grid is refused before
publication. Unsupported E4M3 scale targets, wrong geometry/precision,
limits and cancellation also refuse. These are tensor correctness controls,
not fused activation kernels or paged caches.

This distinct division profile is required by the pinned XQ runtime. With
scale `0.013671875` (E4M3 byte 7) and input F32 bits `0x3cc3ffff`, F32
division yields the float immediately below 1.75 (FP4 code 3); reciprocal
multiplication yields exactly 1.75 (RNE FP4 code 4). The regression fixes
the source equation rather than relaxing an error tolerance. Existing
official BF16/reciprocal codecs retain their contract.

`RotaryTransform::forward_f32_control` preserves F32 rotary and surrounding
features, with the same explicit cache/layout/position/cancellation bounds.
The new sparse MQA entry consumes F32 queries and outputs, keeps the
reference's F16 KV cast after packed decoding, includes the F32 sink in
the softmax denominator, decodes only selected rows and refuses selected
half overflow. It rejects an enabled global Candle reduced-precision/TF32
setting before its GEMMs; it never toggles production settings. This
profile is an unfused F32 control, not ggml kernel/performance equivalence.

`layers/xq/attention.rs` loads exact Q8_0 Q-A/Q-B/window and grouped-output
parameters plus learned F32 norms. Input is Q-A → norm → Q-B → F32 RoPE,
and window projection → norm → RoPE → explicit FP8 grid. Output conjugates
RoPE and applies each group's own A row range before concatenation and B.
The packed A allocation remains whole and charged; a row view is borrowed.
Each component owns one snapshot of its supplied rotary cache, not both
the original cache and an uncharged copy. Exact header/resource/cache
admission precedes public weight upload. These components still require
the compressor, indexer, Engram and request/backbone-state composition.

| Check | Actual result | Evidence |
|---|---|---|
| Native CPU full library | 370 passed | `xq-attention-model-final.log` |
| CUDA-feature CPU/NVRTC library | 371 passed, 7 H200 tests ignored | `xq-attention-cuda-final.log` |
| CPU/CUDA all targets | Passed | `xq-attention-cpu-all-targets-final.log`, `xq-attention-cuda-all-targets-final.log` |
| Owning-package format | Passed | `xq-attention-format-final.log` |

Linux source snapshot SHA256:
`226901a798c29bc84af3f675afb2761dc2e977a0061a3bbf082f508bc06010e0`.
Linux CUDA test binary SHA256:
`c154c0aa0780f66a996d987f8a83ce24c10ea01dee51006ecb4f463a01e3d04e`.
The 145 model source/fixture/license inputs and frozen root/Power files
match the independently built snapshot (`xq-attention-linux-build-result/`).
The owned 8 CPU/20 GiB container used no GPU and its original entry script
was restored byte-for-byte. Unchanged CUDA source/options retain their prior
NVRTC/SM90 receipts; unchanged Power/workspace inputs retain prior storage
and dependency evidence, including the unresolved full-format error 206
and 62 baseline drift findings.

`xq-attention-candle-f32-audit.json` binds the inspected Candle sources and
Windows compiled `bdiv_f32` PTX: seven `div.rn.f32` instructions, no
approximate/FTZ division or reciprocal instruction in that kernel. Candle's
F32 reduced-precision default is false. This is source/compile evidence;
concurrent mutation of that process-global precision setting is unsupported
for this correctness profile and actual H200 execution is still required.

Binary, worker and manifest were passively staged with size/SHA256 checks
and atomic publication in the new owned mode-0700 directory
`native-xq-attention-v7-c154c0aa0780` (`xq-attention-h200-staging.json`).
No remote executable/test was run and no GPU job or queued input changed.
The worker pins 371 hermetic passes and the exact seven ignored-test names;
real H200/runtime/idle-allocation checks are required before hardware work.

The new ignored H200 test compares each executed stage with independent
F64 equations at `2e-5 + 2e-5*abs(expected)`, and compares all three
activation formats by exact scalar-oracle bytes/scales. It covers the
division midpoint, negative zero and index subnormal minimum scale on the
actual device, per-stage query/window/attention math, F16 KV conversion,
sink normalization, and distinct grouped-A offsets. It also restores its
own temporary TF32 test setting after verifying refusal. This is a small
stage-local component proof; downstream stage oracles consume the previous
executed F32 stage, not an end-to-end complete-model oracle. Hardware
execution and teacher-forced full-model comparison remain open.

The current whole goal remains native eight-card generation/service,
measured optimization and sustained pressure qualification, with a real
URL/Key delivered only after those gates. This continuation does not close
T022 or substitute component tests for those deliverables.

## 2026-10-24 XQ F32 compression/index and transactional-cache components

Added `CompressionNumerics::{OfficialBf16,XqF32}` as an explicit immutable
state profile. The original constructor/numerical boundary remains official
BF16. XQ C1 takes/emits F32, and C2 retains F32 pair reduction instead of a
BF16 output cast. Pending score/latent halves remain F32 snapshots. Accepted
emission copies charge four bytes per value; C1 F32 live admission is larger
than the BF16 bound, and ready/accepted position arrays are bounded by the
host input limit. The original compressor refuses an XQ state before its
projection. Ownership, one-live-proposal lease, accepted-prefix snapshots,
deferred device errors and the existing atomic commit remain enforced.

`layers/xq/compressor.rs` loads only exact source layers 2/8/14/20, original
F16 A/Gate and learned F32 norm. It preserves the normalized F32 main latent
before either RoPE or quantization for index K. C2 cache readiness 1,3,...
is distinct from compressed RoPE group starts 0,2,...; the latter follow
the pinned `cp=(p/r)*r`. Both position vectors are explicit. Main rows enter
the compressed FP4/E4M3 grid. No BF16 activation or main-KV decode roundtrip
is inserted before index K. A prepared compressor also binds its source
layer; the index-K convenience entry refuses a different source.

`layers/xq/indexer.rs` loads exact source-specific F16 index Q/K/head
matrices with F32 activations/norms and trailing-64 RoPE. Head projection is
scaled once by the declared F32 `1/sqrt(128*heads)`; Q/K use the original
FP4/pow2 grid. The sparse selector's XQ entry takes already scaled F32
weights and keeps scores in F32 before top-k, preserving canonical ascending
selected IDs. A regression shows the original BF16 score/weight boundary
turns 1.0001 versus 1.0003 into a tied selection, while XQ retains the
distinction. XQ block candidates add finite `1e30` to the actual last-block
maximum; they do not use the original profile's unconditional infinity.
The existing TF32-mode refusal also protects the XQ index GEMM.

`xq-compressor-index-source-audit.json` revalidates all three source files
against their pinned SHA256 and Git blob SHA1 before recording these
boundaries. This remains explicit F32 control math, not proof of ggml's
implicit optimized-kernel precision or whole-model equivalence.

| Check | Actual result | Evidence |
|---|---|---|
| Native CPU full library | 385 passed | `xq-compressor-index-model-final.log` |
| CUDA-feature CPU/NVRTC library | 386 passed, 8 H200 tests ignored | `xq-compressor-index-cuda-final.log` |
| CPU/CUDA all targets | Passed | `xq-compressor-index-cpu-all-targets-final.log`, `xq-compressor-index-cuda-all-targets-final.log` |
| Owning-package format | Passed | `xq-compressor-index-format-final.log` |
| Both C1/C2 chunk partitions | All 32 six-token partitions match pre-RoPE F32 and packed main bytes | Owning tests in the full-library log |

Initial full runs failed four compressor tests because one cache fixture's
untyped floating constants constructed F64, correctly rejected by the F32
cache boundary. The retained CPU/CUDA initial logs and the isolated failure
(`xq-compressor-cache-dtype-isolated-failure.log`) record this. The fixture
now explicitly uses F32; the four-test rerun passed before the final full
suite. No production precision refusal or numerical tolerance was loosened.

The new ignored H200 test exercises source 2/C2 and 20/C1 with original F16
projections, F32 compression/norms, group-start rotary, exact scalar-oracle
main/index bytes, index Q/K/head math and causal selection. Stage-local F64
checks fix `2e-5 + 2e-5*abs(expected)` before execution; the selection oracle
also applies the explicit F32 product/two-head sum boundaries. After staging
compression/main/index it cancels at commit and requires all three owners
unchanged, then accepts one token from a three-token proposal and finishes
the sequence. Final main/index bytes must match fresh full-prefix execution.
This is a three-participant small component proof, not complete 53-owner
backbone/teacher-forced/8-card qualification. It has not run on an H200.

Linux source snapshot SHA256:
`57fb8b2ee9a6e142051bb1c90be36bad883e9c7a932d11190d66fbfb9f7b7f95`.
Linux CUDA test binary SHA256:
`1e3d846d5edc52903a6b8934389a6fc4a8945b4ea082b650b593aa834b04588f`.
The 151 model source/fixture/license inputs and frozen root/Power files
match the independently built snapshot (`xq-compressor-index-linux-build-result/`).
The existing owned 8 CPU/20 GiB/no-GPU container and its restored original
entry are retained. CUDA source/options and Power/workspace inputs did not
change, so prior assembly, storage and dependency evidence remains scoped
as before; full-format error 206 and 62 baseline drift findings remain open.

Binary, bounded/self-verifying worker and pinned manifest were passively
staged in the new private directory
`native-xq-compressor-index-v8-1e3d846d5edc`. Every size/hash was verified
before atomic publication; no executable was run, GPU job changed, or old
queued input replaced (`xq-compressor-index-h200-staging.json`). The new
worker requires 386 hermetic passes and the exact eight ignored-test names,
an owned idle H200 and real runtime libraries before hardware qualification.

At this checkpoint the next missing XQ execution component was F32 Engram, followed by the
complete pinned architecture/backbone/state/model and native token/service
loop. Hardware qualification, real eight-card execution, optimization,
pressure tests and URL/Key delivery remain incomplete; T022 stays open.

### T022 XQ Engram metadata, sparse projection and F32 contribution

The complete exported U32 token map has 129,280 entries, 517,120 bytes and
SHA-256 `c60a86322ec17b4142bfef3c57a8d81fb428550cdf487f88a4320cb59fe46481`.
This agrees with the independently pinned official compressed tokenizer map.
All layer IDs, table extents, 48 primes, eight U64 multipliers, encoding and
PAD/vocabulary identities are checked before binding the official external
tables. Typed array ranges come from the authenticated header and are read
again through Power's verified held-file owner. The small raw map fixture
contains public model metadata and keeps tests offline. The full model header
and tokenizer are not copied into the repository.

`XqEngramProjection` consumes the original sparse E4M3/E8M0 rows already
fetched by Power, decodes only those rows to F32 and applies original exported
F16 fused-KV weights. The gate normalizes hidden/key first, combines the F32
query/key weights, sums the F32 dot and applies the explicit F32 inverse-root
scale and signed-root sigmoid. Four keys and one shared value update the F32
trunk without a BF16 cast; image trunk bits and carried mHC pre-mix remain
exact. `XqEngramLayer` binds a declared hash/table/projection and prepares the
contribution without committing n-gram history. Sparse lookup now admits its
bounded host hash/gather metadata before allocating a plan.

| Check | Result | Evidence |
|---|---:|---|
| Native CPU full library | 396 passed | `xq-engram-model-final.log` |
| CUDA-feature CPU/NVRTC library | 397 passed, 9 H200 tests ignored | `xq-engram-cuda-final.log` |
| CPU / CUDA all targets | passed | `xq-engram-*-all-targets-final.log` |
| Owning package format | passed | `xq-engram-format-final.log` |

Eleven new hermetic tests cover exact metadata, wrong schemas and budgets,
mapped-token history/images, atomic accepted prefixes/cancellation, F32 gate
math, normalize-first overflow, signed zero, snapshots, owner limits and
explicit CPU-fallback refusal. The first suite had one incorrect refusal
fixture: 8,192 bytes was exactly the valid admitted bound. Its failure was
repeated alone, retained, and the fixture changed to 8,191; production budgets
were unchanged. The first CUDA test compile referenced an undeclared `half`
crate; the fixture now supplies independent exact F16 bit constants without
adding a dependency. Both initial logs and the focused rerun are retained.

The new owned-H200 test checks original row decode bits, an independent F64
projection stage and F32-boundary gate stage with the budget frozen at
`2e-5 + 2e-5*abs(expected)`. It additionally checks non-initial carried mixes,
images, repeated/nonordered heads, signed zero and E8M0 scale-zero subnormals.
This test remains ignored and unexecuted without an owned H200.

The exact GPU-free Linux source snapshot has SHA-256
`3d098bbbc50c7dcbcbba1f9355d4fd5e1059a0d85382a134fabb2f8048c29d77`.
It built the qualifier with binary SHA-256
`16413062b5b44012c7ff3850282c5d47419d19c244e18a6b42f2c6fceb13fa63`;
source/input checks and the original container entry restoration passed.
The new private passive stage is
`native-xq-engram-v9-16413062b5b4`; all three files were hash-verified before
atomic publication, and no GPU job/input or executable was changed/run.
Its worker requires 397 hermetic passes and exactly nine hardware test names.
See `xq-engram-components-acceptance.json`, `xq-engram-source-audit.json`,
`xq-engram-metadata-audit.json`, `xq-engram-linux-build-result/` and
`xq-engram-h200-staging.json`.

Full native payload opening, giant-table residency/placement, pinned XQ
architecture/backbone/state/attention composition, the full token/service
loop, hardware qualification, eight-card optimization and stress acceptance
remain open. No native URL/Key exists; T022 remains unchecked.

### T022 XQ identity, complete state and callable decoder-layer pipeline

`DeepSeekModel::V41Flash1017Xq` now has a distinct repository, revision, alias,
config hash and packed-kernel requirement inventory. The exact exported
`deepseek41.config` string is 2,270 bytes with SHA-256
`d7637228d27528f6bd259781b5a27258068f50bf637c9c83aab784d81579669d`.
Its JSON values equal the official metadata, but neither model accepts the
other's serialized artifact identity. The product input remains ACL. Model
requirements are not a registration or loading/serving claim.

The verified architecture now carries immutable compression numerics through
all 40 layer bindings and the backbone owner. XQ constructs four F32 compressor
states, 40 packed windows, four main/index source pairs and one shared Engram
history. It requires FP4/E4M3 compressed storage. The original atomic commit
still publishes all 53 participants together, including accepted-prefix
snapshots and odd C2 pending halves. Official loading/execution refuses XQ
architectures/states before weight reads or projections.

`XqAttentionSublayer` connects shifted F32 mHC, learned norm, actual Q8
query/window projections, selected packed sparse attention, conjugate RoPE,
grouped output and mHC finish. Each input projection has an immutable owner;
matching shapes/weights do not authorize another owner's prepared result.
mHC now also refuses reduced-precision/TF32 F32 GEMM, preserving the explicit
F32 control profile. Production does not silently change global BLAS flags.

`LoadedXqLayer::forward_pending` composes the bound Engram contribution,
attention preparation, own window, source-only C1/C2 compression and index K,
declared index-Q/top-k production, cross-layer sharing, attention finish and
the mixed/shared FFN. Main and index K use the compressor's group-start rotary
positions independently from pair-end readiness. A layer failure poisons both
the full backbone proposal and per-step sharing. No individual layer commits
KV/history. Overlapping projection/FFN/Engram/compression/index workspaces,
prepared packed caches and row metadata are admitted together; these are
conservative component bounds, not measured global HBM permits or peaks.

| Check | Result | Evidence |
|---|---:|---|
| CPU full library | 409 passed | `xq-loaded-pipeline-model-final.log` |
| CUDA-feature CPU/NVRTC library | 410 passed, 10 H200 tests ignored | `xq-loaded-pipeline-cuda-final.log` |
| CPU / CUDA all targets | passed | `xq-loaded-pipeline-*-all-targets-final.log` |
| Owning package format | passed | `xq-loaded-pipeline-format-final.log` |

Thirteen new hermetic tests cover identity/config/ACL separation, checkpoint-
specific kernel requirements, exact header config, all 53 F32 state owners,
partial acceptance/cancellation/foreign source rejection, attention half
geometry/rotary/sinks/aggregate budgets, loader boundaries, ordered execution
and explicit CPU-fallback refusal. The first layer-composition compile exposed
three helpers still scoped to `layers`; their visibility is now crate-private
for the owning `weights` composition. That compiler output remains in
`xq-layer-composition-initial.log`; no dependency or public cross-crate bypass
was introduced. Intermediate passing suites and final checks are retained.

One additional ignored H200 test executes actual source/consumer pairs 2/3
and 20/21 with width-256 synthetic weights, including nonzero Q8 attention
and shared FFN. Other layers explicitly supply synthetic state so the full
53-participant transaction can be exercised. Whole/chunked output must meet
the frozen `2e-4 + 2e-4*abs(expected)` two-layer budget, and committed cache
bytes must match after partial acceptance/recomputation. The test also checks
late cancellation, foreign prepared projections and TF32 refusal with guard-
restored global flags. It is not 40-layer model execution or model quality,
and has not run on H200. Separate earlier H200 tests retain their independent
F64/codec-bit oracles.

The exact Linux source snapshot SHA-256 is
`765978c581d4f39cf03feac014b5b955492729d76ad51059913442773bcfc1d1`.
The owned GPU-free container built a qualifier with binary SHA-256
`194a7e0d6569ce30245b507117194a7b25bcd5a90e33e28237f44a6772419a68`.
The original entry was restored byte-for-byte; the container exited zero.
The retained inputs include 163 native source/fixture/license files and
unchanged root/Power inputs. Compilation does not execute the hardware tests.
See `xq-loaded-pipeline-source-audit.json`,
`xq-loaded-pipeline-components-acceptance.json` and
`xq-loaded-pipeline-linux-build-result/`.

The new immutable passive stage is `native-xq-loaded-pipeline-v10-194a7e0d6569`;
all three files passed size/SHA verification before atomic publication. Its
worker requires 410 hermetic passes and exactly ten ignored H200 test names.
No executable, GPU job or old queued input was run/changed. See
`xq-loaded-pipeline-h200-staging.json`.

Complete native payload opening, external Engram table residency/placement,
verified cross-device cache/trunk transfer, the full 40-layer model/token loop,
backend/service entry, hardware numerical/quality qualification, eight-card
optimization and both pressure campaigns remain open. T008/T009/T010/T022 and
delivery/stress gates remain unchecked. No native URL/Key is delivered.

## Resource application correction and validation (2026-10-24)

The user prioritized actual H200 resource acquisition before further model
work. The prior three queued jobs required `GPUType=h200`; a direct node
label query returned **0 nodes**. The exact observed label `GPUType=H200`
returned 1614 nodes. The launcher now preserves this case. A short regression
run passed 4 tests (`h200-selector-regression.log`); the new allocation
inventory proof passed 2 tests (`h200-resource-probe-hermetic.log`).

The first replacement request was explicitly rejected by the API because
`spec.backoffLimit=0` must be greater than zero. A namespace audit confirmed
zero matching objects before retrying with the minimum accepted value 1.
Both the submission error and the successful admission are retained. No
ambiguous request was blindly duplicated.

The first corrected eight-card resource-only job was
`aster-h200-resource-8-17bb05a770ee-152107`, UID
`49747c8a-bf48-4941-b780-b3427b510a9e`. Its admitted Replica requires the
exact uppercase GPU label and requests 8 GPUs, 160 CPUs and 1760 GiB RAM.
It was scheduled on `gpu-lg-cmc-h-h200-3058.host.h.pjlab.org.cn` at
2026-10-23T20:56:52Z and its container started. It then failed before CUDA
initialization: the image runs as UID 0, while the immutable probe requires
the stage owner UID 10250. The runtime log was UID 0/mode 0600 and was not
read through a permission bypass. This allocation was released. The three
obsolete lowercase-selector jobs were stopped after checking exact UIDs,
same creator, queued state, and the accepted replacement. Their metadata and
stop receipts remain; no shared reference deployment was stopped.

The diagnostic one-card job is
`aster-h200-resource-1-a2c2cd2f5efd-97220892`, UID
`1626d77b-ec23-44ab-8d3b-b1a461547b13`. Scheduling passed on
`gpu-lg-cmc-h-h200-0333.host.h.pjlab.org.cn`; its container failed at the same
UID guard. A subsequent stop request arrived after that failure and is not
claimed as its cause. No one-card CUDA pass is claimed. A zero-GPU helper
request was explicitly rejected by GPU-pool policy; no helper was created.

The launcher now drops supplementary groups/GID/UID to the exact stage owner
before exclusively opening its private log, then runs the unchanged worker
SHA-256 `d70e90d74ac4603c49e48d76f61f8cd0883bfa2ad052aa31d79b99537692dfdf`.
A failed probe retains its own allocation for a bounded 600-second diagnostic
window and preserves the failure exit code. The exact submitted bootstrap
passed 3 GPU-free UID/log/error contract tests. The first test run exposed a
test-harness error: intercepting every `time.sleep` also captured subprocess
timeout polling. The distinct failure was reproduced alone; restricting the
intercept to the exact 600-second lease made the isolated case and all 3
tests pass. The launcher itself was unchanged by that test-harness fix.

The accepted second eight-card attempt is
`aster-h200-resource-8-80c18900fc4b-47880672`, UID
`a29adaab-b2bd-4c66-8b70-e330d1ec6dec`. After checking that the first exact
UID had failed, it was submitted with the same 8 GPU/160 CPU/1760 GiB
profile. Scheduling passed at 2026-10-23T21:18:43Z on
`gpu-lg-cmc-h-h200-0059.host.h.pjlab.org.cn`. It is Running; the immutable
worker completed its resource proof at 2026-10-23T21:23:11Z. All 8 distinct
physical UUIDs agreed between NVML/CUDA, each reported 143771 MiB HBM with
zero used at preflight, all devices were SM90, all 8 exact 64-bit host/device
round trips and all 56 directed peer copies passed. Topology reported NV18
between every distinct GPU pair. NVIDIA driver was 595.71.05; the driver API
reported 13020. This tests tiny exact copies, not bandwidth or inference.

An inspection executed only in this exact owned Replica confirmed its node
is schedulable with 8 allocatable GPUs. The actual cgroup v1 CPU quota/period
was 16000000/100000 (160 cores); memory limit was 1889785610240 bytes
(1760 GiB). The probe runtime files are owned by UID 10250/mode 0600. The
container exec process still defaults to image UID 0; this does not change
the launcher/worker UID proof. No host cgroup, taint or scheduler setting was
changed. The resource-only lease ends at **2026-10-24 06:23:11 +08:00**;
this is a bounded validation allocation, not a permanent service reservation.

The resource probe checks distinct physical H200 UUIDs, free HBM,
SM90/driver visibility and exact GPU memory round trips. The eight-card mode
additionally checks all 56 directed peer copies, and retains an allocation
for at most one hour after passing. It loads no model and restarts no
reference service. This resource acquisition/driver/peer gate has passed.
See `h200-resource-validation/manifest.json` and the exact
source in `scripts/h200_xq/resource_probe.py`.

The initial queue snapshot had 40 GPU units of aggregate capacity and 26 allocated;
this does not prove eight usable H200s on one node. Prediction returned zero
schedulable eight-card replicas for the checked group/project/tenant/public
modes at those observations. A later prediction found healthy node 0059
and the normal scheduler assigned the accepted job there. The separate
reported fully free eight-card node
`gpu-l-lg-cmc-h-h200-0061.host.h.pjlab.org.cn` is explicitly unschedulable
with maintenance and NoSchedule taints. No maintenance setting, taint,
resource-pool policy, priority or other user's workload was overridden.

The interrupted native work is protected in the task checkpoint
`xq-peer-resource-worktree-checkpoint-1792788842.json` (archive SHA-256
`c9b799e0c7571145b4006350a409061cf91da16fb81080bb9c4c6c3fe6fdbc77`).
Its new peer/full-pipeline/greedy control passed 423 CPU library tests,
424 CUDA-feature CPU/NVRTC tests, 4 Power peer-boundary tests and owning
CPU/CUDA all-target/format checks. Twelve hardware tests remain unexecuted.
The Linux qualifier built from source archive SHA-256
`7a449cf4272c3f6de6bf127a10f2eef58ddf2ede9d0c200a7adff1644f239b3d`
with binary SHA-256
`cdab4a6f46708de07d4642e2f2e606315f79212e9b134e832e52d53c01c24b8b`.
This is compiled control code, not hardware-qualified full model execution.

Resource-only commands and results:

- `python3 -m unittest test_deferred_launch.py`: 4 selector/launch tests passed.
- `python3 -m unittest test_resource_probe.py`: 2 inventory/refusal tests passed.
- `wsl.exe -d Ubuntu --user root --exec env PYTHONDONTWRITEBYTECODE=1 python3 /mnt/d/code/aster/target/h200-native/test_resource_bootstrap_uid.py`: 3 bootstrap tests passed.
- Exact admitted jobs, UIDs, scheduling/runtime observations, read-only quota
  and predict-only checks, input hashes and launch/observation sources are
  retained in `h200-resource-validation/manifest.json`. Independent local
  receipt validation requires the exact 8 UUIDs/SM90 profile, 8 round trips,
  and the complete 56-element directed peer set before setting the GPU
  allocation proof to true.

## Explicitly not claimed

- Complete native DeepSeek, native Rust SM90/XQ kernel qualification, actual TP/EP collectives, complete
  model generation, state/replay/DSpark qualification or an optimized H200
  service. No native endpoint or temporary Key exists yet.
- Full official checkpoint payload hashes, an independent observer reread of
  all XQ payloads, merged GGUF validation, XQ inference or equivalence between
  official and edited weights.
- Any native token/s result, a 1000 token/s target, hardware limit, or speedup
  derived from the previous SGLang/recipe reference service.
- Full workspace tests, optional Mistral execution, the absent external YAML
  test-suite submodule, or a passing full-repository format/drift gate.
- Any commit, push, shared model service restart, NCCL/bandwidth/pressure
  qualification, downloader restart or replacement of the reference deployment.

Latest resource observation: the second corrected eight-card job is Running
on node 0059, and all required resource CUDA/peer checks passed. The first eight-card attempt and
one-card diagnostic failed before CUDA because of the now-corrected startup
UID mismatch. The three older invalid-selector jobs are Stopped. Full native generation,
complete eight-card model execution, optimization, pressure tests and URL/Key delivery remain
incomplete; no completion is claimed.

## 2026-10-24 native multi-replica continuation

The preceding resource paragraph is historical. The exact node-0059 job
`aster-h200-resource-8-80c18900fc4b-47880672` finished Succeeded at
2026-10-23T22:23:15Z after its bounded one-hour lease. Its final API state is
retained in `native-multireplica-continuation/previous-allocation-terminal.json`.
The new normal-scheduler allocation is
`aster-native-xq-deploy-055d38ff2b70-23451623`, UID
`fb15474f-a8df-40d1-bf54-fcfe652e06aa`, on node 0249. Its independent resource
proof passed eight unique SM90 H200 devices, eight exact GPU round trips and
56 directed peer copies. Its bounded two-hour lease ends at
2026-10-24 08:29:43 +08:00. No other workload or scheduling policy was changed.

The sixteen original downloaded parts were independently rehashed during an
atomic, bounded merge. All 16 passed; the resulting 162954903552-byte GGUF has
SHA-256 `73df1934302f867601dd27f7fca59109d9b11674f50cc60526ec2a1cd4f3d389`.
The source parts remain intact. `python -m unittest test_prepare_payload.py`
passed 3 hermetic publish/corruption/deadline tests. The two official Engram
blobs are opened by their canonical content-addressed paths and their entire
files are verified; snapshot symlinks are not accepted as verified handles.

The first real CUDA qualification (v11) retained an attention failure:
`matmul only supported for contiguous tensors`, for a [1,512] query with
strides [3,3]. An isolated recheck reproduced the same failure. Explicitly
making the F32 query contiguous in attention and indexer fixed this case;
the regression uses a strided view with an independent numeric oracle.
The following exact binary receipts and original case logs are retained:

| Revision | Scope | Result |
|---|---|---|
| v12 | layout fix, existing native components | 424 controls and 12 hardware invocations passed |
| v13 | closed 2/4/8-card placement, per-group admission and peer ownership | 427 controls and 16 hardware invocations passed |
| v14 | authenticated sparse official Engram source | 430 controls and 16 hardware invocations passed |
| v17 | actual incremental greedy callback and immediate consumer cancellation | 431 controls passed on the real H200 host; 13 GPU cases explicitly ignored |
| v18 | private resident/release barrier example | 2 tests passed on the real H200 host; these tests claim no GPU/model execution |

The sixteen v13/v14 hardware invocations comprise one eight-card peer case,
the two-card case repeated on four disjoint physical pairs, and eleven
single-card component cases. They do not prove four simultaneously resident
complete model replicas. v17 compiled in the GPU-free build container but
its attempted local test launch exited 127 because libcuda.so.1 was absent;
an isolated linker-stub check then exposed missing libnvrtc.so.12. Neither
attempt executed tests or a GPU model. The original failed build receipt is
retained separately from the compile-only receipt and the later real-host
431-test pass. Hashing dependency optimization is an explicitly recorded
dev-profile build setting, not a release-mode inference speed claim.

The first full-model diagnostic was intentionally stopped only after exact
PID/start-ticks/UID/executable checks exposed slow unoptimized hashing. The
second (v16) verified the complete GGUF in 189.98 seconds and both complete
Engram files by 425.61 seconds, then timed out during model loading at its
664-second budget before the old lease expired. Both original failures and
stderr/stdout remain under `native-xq-full-model-first` and
`native-xq-full-model-hash-opt`. A GPFS read_bytes value of zero alone does
not establish a page-cache hit; earlier informal wording to that effect is
not an accepted measurement.

The current v18 full-model attempt uses native binary SHA-256
`a4db74e456206f0774e5573b9f32d53c654e6e46322788f53ed7a9cb9f624291`,
source archive SHA-256
`f4b0f1619e897621d165b5f44b72edb3c2c6223d1701bd8b8ca166249fb94bcc`,
and a 1200-second native deadline. It started at approximately 06:38:17 +08,
verified the complete GGUF and both official files, and reached
`loading_all_forty_layers` at 424.95 seconds. It has not yet produced a
passing generation receipt at this evidence update. Its process is observed
by exact PID/start-ticks/UID; timeout or observation truncation does not cause
a duplicate launch. Current logs are under `native-xq-full-model-deployment`.

A new frozen four-replica supervisor is staged but not launched. It requires
the exact single full-model probe to pass, assigns four disjoint UUID pairs,
waits for four private ready barriers, validates complete-model identity and
physical-device admissions, records simultaneous HBM, and then releases all
four native generators. It has a 3600-second maximum and kills only its own
children on failure. `python -m unittest test_replica_probe.py` passed 2
hermetic receipt tests; this is not multi-replica GPU execution evidence.
Spec FR-016/SC-009, tasks T028/T029 and the plan now require real complete
replicas plus routing/affinity and measured optimization. T028/T029 remain open.

### Explicitly not claimed for this continuation

- A passing complete-model generation, four complete resident replicas,
  model quality, sustained throughput, low-latency service or a speedup.
- A native Power Backend, verified API/SSE/tool/cancellation service,
  cross-request KV reuse, a reachable user URL or a delivered API key.
- GPU-resident full Engram copies, shared cross-replica HBM tables, TP/EP,
  batching, DSpark, 32K/128K support or completed pressure/optimization gates.
- A finished overall deployment, full-workspace green gate, commit or push.

## Complete native replicas and Power service preparation, 2026-10-24

This section supersedes the preceding in-progress full-model status. The v18
single-pair diagnostic finished with exit 0 and generated token IDs [1393,12]
from raw prompt [0,7,8,9]. It executed two model steps, 40 layers on each local
ordinal in total, and four peer copies totaling 409680 bytes. Generation took
8.892 seconds including initial execution setup; this two-token probe is not a
steady-state throughput measurement or a useful text-quality campaign.

The frozen four-replica supervisor then passed. Four complete 40-layer models
were simultaneously resident on four disjoint physical H200 pairs before the
private barriers were released. The common all-resident observation was epoch
1792796677.716; generation completed by epoch 1792796693.403. Every replica
generated [1393,12] with the same complete-layer/peer receipt. The NVML snapshot
reported [86161,70449] MiB used per pair, repeated across all eight cards.
Per-replica two-token generation times were 12.202,12.230,12.004,11.992 seconds;
these overlap and must not be summed or promoted as warm/sustained performance.
Original barriers, logs, process identities and receipts are retained under
`native-xq-four-complete-replicas`; the summary is
`native-complete-replicas-acceptance.json`.

New source adds an explicit mapping between model-local ranks and process CUDA
ordinals. Existing load APIs still use their original identity mapping. A
complete replica pool supports only declared 2x4/4x2 layouts, owns a separate
pipeline/state identity per worker, bounds pending work and output channels,
cancels the actual request when its response is dropped, imposes a 300-second
maximum request deadline and has a bounded drain. It shares held authenticated
source files, not mutable request state. Prefix KV reuse remains unsupported.

The native Power Backend injects this pool through the existing registry seam;
the composition disables default backends. Chat formatting is a bounded
text-role adaptation of the exact official V4.1 encoding source, with 24
independent oracle cases. The real official tokenizer is pinned by full hash.
Unsupported tools, images, sampling/format overrides and cache keys fail closed.
The initial serving profile admits at most 256 context tokens and 32 output
tokens. It does not advertise raw completions or embeddings. Incremental UTF-8
and thinking parsing preserve the exact final streamed token receipt; Power
chat accounting can explicitly select final native token usage rather than
counting transport fragments. This is an additive Backend capability.

The host can now inject an AuthProvider through PowerServerBuilder. A static
key set and an injected policy are rejected together before startup. Native
credential leases use private ACL with absolute start/expiry, a maximum
two-hour window, and an explicit private revocation marker. Missing, malformed,
insecure, not-yet-active, expired or revoked credentials deny authentication.
Restarting a process does not extend the absolute lease. Raw new keys are only
created in the task-private credential directory; an explicitly requested
local delivery copy is restricted to the current Windows user and SYSTEM.
Raw keys are excluded from all
logs, manifests, source snapshots and evidence copies.

Commands and observed results:

- `cargo test -p a3s-deepseek --lib --offline`: 433 CPU controls passed after
  device-map/prompt changes; after the replica pool, 436 passed.
- `cargo test -p a3s-deepseek --lib --features server --offline`: 437 passed
  after Backend integration, then 438 passed after the initial host lease code.
- `cargo check -p a3s-deepseek --features server --example serve_xq_native --offline`:
  passed. Source/test additions after that check are covered by the later
  frozen Linux/H200 run below.
- `cargo test -p a3s-power --no-default-features --features server,embedded-inference server::builder::auth_tests --locked --offline`:
  could not compile the existing Power test target because its prior
  `proxy.rs` references absent `proxy_usage_tests.rs`. The file was not found
  in the parent worktree, task checkpoints, v10 archive or a bounded repository
  search. No test module was removed or replaced to get a green result. The
  public builder conflict path is independently exercised by the owning
  DeepSeek host test and by the later actual service checks; no passing Power
  package test target is claimed.
- `cargo fmt --all -- --check`: failed with Windows OS error 206 (command line
  length). Owning-crate formatting was applied; a full workspace green format
  gate is not claimed.

The first GPU-free Linux server build (v19) failed before compiling the service
because offline cache lacked pinned adler2 2.0.1. A bounded cache archive was
then built from 1824 local Cargo packages, verifying every package against its
Cargo.lock checksum. No version was changed. v20 seeded 1569 absent packages
but exposed 12 missing module files in the deliberately minimal old runtime
source bundle. v21 overlays the exact current local dependency closure:
a3s-deepseek, a3s-power, a3s-runtime and a3s-acl (661 files, 9401366 bytes).
No private Studio source was added. Failed receipts and original compiler logs
are preserved; intermediate local bootstrap syntax errors occurred before any
container or model process started.

The final v21 Linux build passed, source archive SHA-256
`2c2ed2e45d05f946917ec086a7010768b33c209e0f04caf3af7afefde7ca957a`.
The service binary SHA-256 is
`13cd3ce92f7048fd6720119660e006ab08ccf75dea269586b3a11c21cff21870`
(126729576 bytes); the CUDA/server test executable SHA-256 is
`242108e793530829dd69ce59c28a558024eafa3e5486cddf11296d2e782c98b7`.
The build used the same owned GPU-free container, Rust 1.97.1/CUDA 12.6 and
recorded dev-package optimization flags; its entry was restored byte-for-byte.
The root lock hash changed only for the a3s-deepseek dependency entry, adding
existing workspace versions of the serving dependencies. The lock SHA-256 is
`1d4bff2ef1a5a843e63252761db14f78c911515ad35a7b87f75ef66c875ac5f7`.

The frozen v21 service operator has launched on the current owned H200 job.
Before model startup, the exact test executable passed **442 controls**, with
all 13 hardware-only cases explicitly ignored. This includes real Unix private
credential expiry/revocation and the public authentication-composition guard.
The service process is PID 2004/start-ticks 721033312/UID 10250. Shared sources
were verified and all four complete mapped replicas loaded successfully.
The task-private operator credential expires at epoch 1792801723, ahead of
the bounded allocation expiry; it is not a final two-hour user delivery.
New service logs and frozen ACL/input/worker files are retained under
`native-power-api-deployment`.

### Initial native API access, 2026-10-24 07:54 +08

The exact v21 server passed its owned loopback listener gate and then the
jump-host client checks, using `verify_native_power_api.py --phase
discovery|chat|stream|lifecycle` as separate sequential invocations. The
discovery result was 200 for the generated key and 401 for anonymous/wrong
credentials. The sole alias is `deepseek-v4.1-flash-1017-xq`.

Two non-streaming Chinese arithmetic requests returned the expected `4` and
`2`, both HTTP 200, with actual prompt/generated token usage. The SSE request
returned `OK`, incremental text, a terminal usage event and `[DONE]`.
Its first text took 10.147 seconds and total duration was 11.591 seconds;
these are short smoke observations, not a throughput qualification.
The actual HTTP credential lifecycle returned 401 while revoked, 401 while
expired and 200 after the exact original absolute lease was restored. The
restored remote credential retained mode 0600.

Direct Windows access to `10.102.242.75:30003` timed out. An owned hidden SSH
forward (PID 144492, start `2026-10-24T07:50:45.1822565+08:00`) now binds only
`127.0.0.1:30003` on this Windows machine through the known verified jump.
It forwards to the native node listener. The Windows client independently
received 401 anonymously and 200 with the task-generated credential.
An actual chat through `http://127.0.0.1:30003/v1` correctly returned `6` for
3+3, with HTTP 200 and usage 15 prompt + 2 completion = 17 total tokens.
The request took 13.016 seconds. Proxy use was disabled in these client checks.

The generated access key was exported directly over SSH into a new local
directory with inheritance disabled and an exact current-user/SYSTEM ACL.
It is not present in this evidence, any source archive, or the checkpoint.
The private key file is supplied to the user by a local file link. This is
provisional test access: its absolute expiry is **2026-10-24 08:28:43 +08**,
before the current allocation ends. The profile remains text-only greedy
chat, context 256, maximum output 32, temperature 0. No final two-hour access
window or permanent service is represented by this delivery.

Original API receipts and the key-free local access receipt are retained in
`native-power-api-deployment`; the independent summary is
`native-api-basic-acceptance.json`.

### Explicitly not claimed after the complete-replica smoke

- Broad text/tool quality, sustained or optimized performance, long-context support,
  pressure/recovery qualification, or completion of the overall deployment.
- A final two-hour user access window or a permanent H200 service reservation.
  The verified localhost URL and short-lived private test key are initial
  access only; the localhost URL belongs to this Windows machine.
- Raw completion/embedding APIs, tools/images, cross-request KV reuse,
  GPU-resident Engram tables, TP/EP, batching or DSpark.
- A full-repository green test/format result, the missing Power test source,
  any commit/push, or any change to other workloads or scheduler policy.

### 2026-10-24 single-request target, measured baseline and fusion candidate

The user explicitly clarified that **one request must generate 1000 token/s**.
The spec/plan/tasks retain this as a completion gate. Concurrent aggregate
throughput cannot close it. No profile in this evidence has met that gate.

The frozen native v21 API campaign completed three repetitions at offered
concurrency 1/4/8, with reversed order on the middle repetition, a fixed
synthetic prompt, temperature 0 and 16 requested output tokens. It ran
395.444 seconds, with 39 attempts: 27 successful, 12 HTTP 429 rejections.
All successful outputs were identical and reported exact 16-token usage.
At offered concurrency <=4 there were no request failures. Every eight-client
cell admitted four requests and rejected four after about one second.

Across the three separate cells at each concurrency, actual tokens divided by
summed cell wall time were 0.5114 token/s for one request, 1.2768 token/s at
four concurrent requests and 1.2705 token/s at offered concurrency eight.
These include prefill and transport, not only steady decode. One-request TTFT
ranged 9.340–12.184 seconds, and latency 29.255–34.342 seconds. No standalone
single-H200 model was run; each complete replica occupies a two-card group.
SSE text-fragment intervals are retained, but are not claimed as token ITL.

The 173 samples recorded peak GPU used memory 86257/70577 MiB per pair,
sampled per-card mean utilization 7.46–12.53%, process peak RSS 1.906 GiB,
about 2.738 process CPU cores on average and 100461983370 additional rchar
bytes. These counters do not establish disk bandwidth, page-cache hits or a
full-model kernel bottleneck attribution. Original source, frozen plan, all
request/failure journals and telemetry are under `native-api-baseline`.
The first local campaign staging command exceeded Windows command length
before SSH could launch; the same prepared identity was resumed using stdin
transport, with exclusive remote-stage creation and no duplicate experiment.

The first optimization candidate is original Aster SM90 CUDA code for the
fixed XQ 4x4 Sinkhorn schedule: preserve the initial column normalization,
19 row/column iterations, FP32 and epsilon 1e-6. A warp keeps the 39
normalizations in registers. Admission requires exact shape, nonnegative
finite input in [0,2], finite output and bounded validation storage; there is
no error-triggered fallback. It is enabled only by the explicit experimental
binary feature `xq-fused-sinkhorn`; the running v21 user service was unchanged.

The frozen v22 source/archive SHA256 is
`9330510883917445032ebee0098f5c0a4e29331282bb0f17070d09deceeed2c3`.
Its test binary `b4fe8e58a999d76475716daa0c236a18df2ff3102be55dd44186b426fb951685`
passed **443 controls**, with 14 hardware-only cases ignored, followed by
**7 explicitly selected H200 tests**: the new fused oracle and the existing
text/mHC, MoE, attention, indexer, Engram and loaded source/consumer state
compositions. The new oracle covers 1/3/8/129 matrices, strided inputs,
invalid dtype/values/budgets, an independent F64 absolute budget 2e-6 and a
tensor-control absolute budget 5e-7. No budget was relaxed after execution.

Three alternating unprofiled microbenchmarks each made 20 calls on eight
matrices. Tensor control took 0.080574/0.079985/0.080010 seconds; fused calls
took 0.003750/0.003681/0.003711 seconds. This is about **21.6x for this
subroutine**, not full-model speedup. Same-source v23 control and v22 candidate
have identical hashes for all 3373 source files, and differ in declared
fused-feature selection. Both server binaries built; full-model paired
execution remains open. Their exact identities are in
`xq-fused-sinkhorn-v22/paired-build-identity.json`.

An additional Nsight Systems 2025.3.1 trace of the tiny qualification passed,
with CUDA tracing and CPU sampling/context-switch tracing disabled. The
8139597-byte original trace has SHA256
`29af14a96c579bdcb2d95e9f5e4b07c18e1b3020df558fa543f2f1b67f9183be`.
It and original logs/CSV reports are retained under
`xq-fused-sinkhorn-v22/profile`. Its 30455 kernel launches cover the entire
test, including both control/candidate and setup; its cold module-load cost
must not be presented as steady inference. The trace shows repeated finite
predicate/reduction kernels in this component. A second explicit candidate
`xq-fused-validation` replaces their composition with one exact atomic flag
kernel and a scalar status read, preserving dtype/strided/nonfinite/negative
checks. It remains unqualified on H200 at this evidence update.

Observed commands/results in this slice:

- `python -m unittest test_api_campaign.py test_sample_service.py`: 5 passed
  locally and 5 passed on the jump host before the frozen campaign.
- `python -m unittest test_handover.py test_api_campaign.py test_sample_service.py test_deploy_service.py test_replica_probe.py test_prepare_payload.py`:
  13 passed; `python -m unittest test_resource_probe.py`: 3 passed.
- `cargo test -p a3s-deepseek --lib --features server --locked --offline`:
  441 Windows controls passed after Sinkhorn; 442 passed after the finite
  geometry addition. The latter original log is retained with the candidate.
- `cargo fmt -p a3s-deepseek -- --check`: passed before the finite addition;
  its formatting was subsequently applied. `cargo fmt --all -- --check`
  again failed with Windows OS error 206; original output is retained.
- `python tests/workspace_dependencies.py`: 6 passed.
- `python tests/crate_drift_report.py --json`: completed, reporting 62 shared
  drifted crates; this is an inventory, not a green drift-ratchet claim.

A six-hour successor allocation script is prepared for the same normal pool,
eight H200, 160 CPU and 1760 GiB, with exact prior RJob/Replica UID and terminal
checks before any new intent/staging/submission. A real invocation while the
old allocation was Running refused and created no successor intent. This
does not extend the current deadline or claim a new allocation. The resource
probe now accepts the explicit 21600-second bound for future sessions; the
running worker/input remains frozen. The current API key still expires at
08:28:43 +08 as delivered.

Explicitly not claimed here: 1000 token/s for any complete-model request,
full-model benefit from either fusion, TP/EP, DSpark, long context, tools,
prefix reuse, the required two 30-minute stress profiles, a new allocated
lease, permanent access or completion of the overall goal. Raw keys remain
outside source, evidence and checkpoints.

### Successor lease and combined fusion qualification

The initial v21 service stopped at its frozen lease boundary, with operator
PID 1395 and native PID 2004 both subsequently absent. The generated user
key expired at 08:28:43 +08. Its exact owned Windows SSH forward was closed
after checking PID, executable, start time and destination. The old URL/key
are not current access credentials. The exact old RJob and Replica were
then observed Succeeded before the successor submission; no running lease
or scheduler policy was changed.

The single new six-hour RJob is
`aster-native-xq-opt-e4ade4631c46-14799633`, UID
`1eb80683-dbe2-4eca-8923-e808af435ce8`; Replica UID
`774c2a47-c4fa-41f1-9e38-86653d13d23c`. Normal scheduling returned it to
node 0249. The new proof passed eight SM90 memory round trips and all 56
directed P2P copies, with no pre-existing CUDA workload. Its absolute end is
epoch 1792823463.7090256, **2026-10-24 14:31:03 +08**. The proof, ownership
audit and normal resource request are under `native-optimization-lease`.

The combined v24 binary (explicit `cuda,server,xq-fused-sinkhorn,xq-fused-validation`)
passed **444 controls**, with 15 hardware-only cases ignored, then **18 real
GPU invocations covering all 15 unique hardware cases**: one eight-card
peer test, four disjoint pair tests, and thirteen single-card component
cases. The finite-flag case covers BF16/F32, strided views, partial warps,
isolated invalid elements, NaN/Inf/negative rules and dtype rejection. Three
alternating 100-call measurements took 0.010280/0.010266/0.010149 seconds for
tensor validation versus 0.002185/0.002118/0.002100 seconds for the fused
predicate. This is a component measurement, about 4.8x, not model speedup.
Original outputs are under `xq-fused-validation-v24-h200-qualification`.

The v24 source archive SHA256 is
`0051291087a9474bd72b4c653a61fa7ec226f9b638a61ad4935719f60ff174c0`;
test executable SHA256 is
`7b424302c403b5f8bc0c2136d79f008a96c97ec961e10aa10b8e7646641b55d5`.
The complete-model server SHA256 is
`2e7aac7bca9aaec5717f5b6609b3ca196a81ab95798d2f460cbb332965b9e554`.
It was staged as a new immutable attempt and launched only after the exact
qualification passed and ended. Its own preflight again requires idle GPUs,
real CUDA libraries and the frozen inputs. Its state is retained under
`native-power-api-v24-deployment`. Full source verification/replica startup,
full-model quality and matched timing remain open at this update.

The qualifier now selects only two declared inventories: legacy v17 (431
controls/13 hardware cases) and combined v24 (444/15), preserving historical
input behavior. It bounds the total run to 900 seconds and reaps its own
child on timeout/interruption. `python -m unittest test_qualification_profiles.py
test_handover.py test_api_campaign.py test_sample_service.py test_deploy_service.py
test_replica_probe.py test_prepare_payload.py`: **14 passed**. The old frozen
operators and failed/negative evidence were not edited or replaced.

The goal remains incomplete. Single-request 1000 token/s, complete-model
fusion benefit, TP/EP, DSpark, long context/tool support, stress/recovery
qualification and final renewed user access are not claimed.

### v24 complete-model short measurements and native clock preparation

The v24 server completed shared-source verification and loaded four full
40-layer replicas on the same disjoint eight H200s. Actual jump-host HTTP
discovery returned 200/401/401 for valid/absent/wrong credentials. Two
non-stream arithmetic smoke cases returned the expected `4` and `2`, with
exactly two completion IDs each. End-to-end times were 11.853107 and
11.585268 seconds, compared with v21's 15.025430 and 14.814851 seconds for
the same input digests and token counts. This is a preliminary short smoke,
not a pure-decode or broad quality result. SSE then returned `OK`, exact
usage and DONE. Real HTTP revoke/expire/restore checks returned 401/401/200,
with the restored credential retaining mode 0600. Original receipts are
under `native-power-api-v24-deployment`; its key was never delivered.

The frozen v2 `single-request-v1` campaign ran three serial requests for
the same synthetic count prompt, 22 prompt IDs and 16 completion IDs each.
All three returned HTTP 200, identical text `1, 2, 3, 4, 5, 6`, and exact
usage matching v21. Cell times were 24.388950, 15.192851 and 15.196451
seconds. Weighted tokens / summed cell wall time changed from v21's
0.5114221265 to 0.8762601604 token/s, an observed 71.3379% increase.
This includes prefill and transport; it is not native decode throughput.
The cold/warm difference and historical baseline's interleaved concurrency
order prevent attributing the whole difference to the two fusions. The
round's result and these limits were reported immediately to the user.
All requests, telemetry, source, plan and process observations are retained
under `native-v24-single-api`; six campaign/telemetry controls passed on
both Windows and the jump host. There were no request failures.

After measurement the exact owned v24 timeout PID 1070/start 721405518 and
native PID 1681/start 721407765 were drained. Both were observed absent,
NVML reported no compute processes, and its operator credential was revoked.
The first drain preflight refused because NVML host PIDs were compared to
container PIDs. No signal or credential mutation had occurred. The corrected
drain independently validated the exact container PID/start/UID/command,
signalled only that wrapper through a pidfd, and verified idle GPUs afterward.
The negative attempt and final receipt are retained; no other workload was
signalled. This is an intentional experiment stop, not a serving fault.

Native generation now records monotonic nanosecond boundaries after each
complete model step/cache commit and before its selected-ID callback. The
first selected ID follows all prompt chunks; decode intervals count actual
generated IDs minus one, with terminal EOS policy explicit. Later intervals
include prior callback backpressure. Request-state allocation, queueing and
frontend time are excluded from this native clock and remain in client wall
time. Independent fake-clock tests exercise chunked prefill, callback cost,
EOS-only requests and backwards clocks. Full forty-layer execution counters
and replica identity accompany the receipt; this is not an SSE-frame timer.

Privacy review found that Power removes the top-level `timings` key when
token metrics are suppressed. Intermediate v25/v26 builds placed the new
receipt elsewhere; they were superseded before any deployment or HTTP use.
The corrected v27/v28 source nests it at
`prism_upstream.timings.native_generation`, preserving the existing privacy
boundary. A sibling backend test checks the envelope; actual HTTP privacy
verification remains open. The Windows server-feature suite passed 445
controls. The original Power package test target still cannot compile because
its pre-existing `backend/proxy_usage_tests.rs` source is missing; no passing
Power test claim is made and that test was not removed to obtain green.

v27 fused and v28 tensor-control Linux binaries built offline with the pinned
root toolchain/lockfile and no GPU request. All 3378 archived source file
hashes match between the two builds; only explicit fusion features differ.
v27 server SHA256 is
`4d686e124e7aa562702bec2f25ff2b922274c0f429e8222361d02ba2485763af`;
v28 server SHA256 is
`8c476cb64583afefaefb6de3c97913d371fe1b74d0a6e423818beb9b90472e8c`.
The qualifier preserves old inventories and adds exact v27/v28 declarations.
The v27 hardware run has passed 447 CPU controls at this update; its GPU
campaign is still running and no new full-model timing is claimed yet.

An owned CPU-only Nsight launch/start/stop protocol passed with no model
changes. The new explicit `nsys-interactive-v1` experiment composition keeps
profiler output separate from native JSON, records its native target PID,
and uses PID/start/UID plus pidfd revalidation before cleanup. The two new
ownership tests include recycled-PID refusal before signalling. Five focused
operator tests passed. This instrumentation is not an optimization result.

Explicitly not claimed: single-request 1000 token/s, native decode speed
from v24, full-model isolated fusion causality, a completed v27 GPU campaign,
a full-model Nsight trace, long-context/tool support, TP/EP, DSpark, final
stress/recovery acceptance, renewed user credentials or goal completion.

### Completed v27 clock measurement, full-model trace, and latest 4090 review

The v27 qualifier passed all **447 controls and 18 GPU invocations / 15 unique
cases** and exited. The explicit profiled service then passed 447 startup
controls, authenticated its full shared files in 424.838 seconds, loaded
four complete replicas and verified its listener. The three frozen single
requests completed with exact 22/16/38 usage and identical count text. Real
selected-ID decode rates were **1.300381 / 1.552408 / 1.504438 token/s**.
All intervals exclude terminal EOS here because the requests ended at length.
End-to-end weighted rate was about **0.731 token/s**, down about **16.6%**
from the v24 short campaign. This instrumentation/Nsight-launched variant is
diagnostic only, not a performance promotion. Collection was inactive during
those three measurements, but injection and cold/warm replica effects remain;
the difference does not isolate the native clock's cost. The regression and
failure to approach 1000 token/s were reported immediately. All raw records
and telemetry are under `native-v27-single-api`.

Two subsequent genuine non-stream arithmetic probes returned correct `4`
and `2`, from replica owners 3 and 0, respectively. Their raw metadata retains
the actual three complete model steps, `[60,60,0,0,0,0,0,0]` replica-local layer
counts, peer bytes/copies and native clocks, inside the protected timing
envelope. With the three preceding measured owners 0/1/2 this also exercised
all four replicas before diagnostic capture. No user key has been delivered.

The original full-model Nsight trace passed and is retained remotely and
locally, **209306825 bytes**, SHA256
`73be6919629dc439e8d016d796d52549d81a3638fed007d666f96bb48f0d01f0`.
`native-full-profile-v27/trace-artifact.json` identifies its exact paths. The
large original is outside the bounded source checkpoint; original CSV, tool
logs, request, frozen operator inputs and process-end proof are in that
evidence directory. The diagnostic operator exited with no stderr. Capture
was stopped successfully; the native server remains live in its owned lease.

The captured 16-ID request was correct and took 18.170644 seconds, with a
diagnostic decode rate of 1.293534 token/s. This profiled rate is excluded
from unprofiled promotion. CUDA driver statistics show **714257 cuLaunchKernel**
calls, **168683 cuMemcpyDtoHAsync** calls, **1202391 cuMemAllocAsync** and
the same number of frees. DtoH device-copy activity totalled only 4.645 MB
over 168719 activities (the driver/runtime views differ in count). Therefore
this is evidence of extremely fine-grained transfer/synchronization traffic,
not a bulk activation-bandwidth limit. `aster_xq_warp_f32_v1` had 32778
instances, 2.316435 seconds, 69.7% of summed kernel durations. Driver DtoH
API duration summed 3.972110 seconds, launch API duration 1.706784 seconds.
API and kernel durations are overlapping sums, not additive wall-time
partitions or GPU utilization. CPU stack attribution remains open. This
trace proves real CUDA work and motivates fewer status reads, temporary
allocations and launch boundaries before claiming hardware saturation.

At the user's request, `git fetch origin --prune` fetched Aster main
`cabdce8ab`; a detached review worktree was created inside this repository at
`.wt-4090d-review`. Existing root changes and the H200 worktree were preserved.
Power is now a submodule. Initializing its parent-pinned `f2c6635` failed
because that object is absent from the remote; all four corresponding local
commits remain in the existing local Power checkout. The fresh review clone
contained only `.git`, so its untouched checkout was populated from the
fetched remote main **d9f6acfba5221f1db3fde378b4b6fd26ec7fbf50** for review.
No parent pin, root working file, local Power commit or running service was
replaced. Source hashes and exact revisions are in
`4090-latest-source-review.json`.

The eight-4090D serving record uses an external llama-server, eight replicas
and two 32768-context slots per GPU. Its matched **45–50% aggregate** gain
did not improve ordinary single-request throughput. The separate ordinary
RTX4090 Qwen27B DSpark record reaches **32.249 -> 169.324 decode token/s**
on a narrow synthetic prompt through GPU target/draft residency, stable
batch-12 CUDA Graph shapes, ten-token proposals and six rollback snapshots.
It explicitly retains broader quality/output divergence limitations and
cannot qualify DeepSeek speed. Reviewed resident graph code retains Candle
tensors under the same request/runtime permit and one live reservation,
consuming handles rather than materializing every intermediate. The local
single-4090 Xolotl patches are admission/launch-plan and buffered upstream
forwarding changes, not native Rust kernels; they explicitly reject 4090D.

The H200 path already retains main weights/activations on CUDA; generic
resident APIs cannot alone remove its tiny finite/status reads. The next
native optimization priority is to reduce those reads and temporary churn
while preserving error/commit boundaries, then enable graph reuse and
DeepSeek-compatible block verification after their prerequisites pass.
v28's same-source control is frozen/staged only; no v28 GPU or complete-model
result is claimed. Two diagnostic lifecycle tests passed in addition to the
17 earlier operator tests. No new Rust behavior changed after the passing
focused formatting and six workspace dependency checks.

Explicitly not claimed: 1000 token/s, a numerical speedup copied from a
different model/card, isolated v27 instrumentation overhead, CPU-stack or
absolute hardware-limit attribution, v28 execution, actual HTTP privacy-on
qualification, TP/EP, DSpark support in the DeepSeek runtime, long context,
stress/recovery acceptance, final user access or goal completion.

The next original Aster candidate, **v29**, explicitly enables
`xq-validation-cache`. A private, non-Send, thread-local guard memoizes
successful finite/nonnegative predicates for identical immutable Candle
TensorIds during one complete native model step. First checks remain
synchronous at their original boundary; a failed check poisons the step and
refuses commit. Its fixed 8192-entry direct-mapped table retains no tensor or
GPU storage, charges metadata against the step budget, treats collisions as
misses, and is destroyed on every return/error. The pipeline accepts bounded
token IDs rather than caller-owned tensors. An audit found no in-place tensor
writes in the production native graph; all custom CUDA kernels write fresh
outputs. This scope must never surround arbitrary externally mutable tensors.
The feature is off by default and preserves the immediate control path.

Windows controls passed **449 tests**, then four focused cache cases passed
after adding checked counter overflow handling. Real H200 qualification passed
**451 controls and 19 GPU invocations / 16 unique cases**. The new case checks
F32/BF16, strided views, predicate strength, NaN/Inf/negative refusal and step
isolation. One hundred repeated validations became one real check plus 99
proven hits: three component samples fell from 2.189–2.249 ms to 0.067–0.078 ms,
about **29–33x for this repeated-check component only**. This is not an
end-to-end model speedup. Raw qualification is retained under
`xq-validation-cache-v29-h200-qualification`.

The native selected-ID timing envelope now also reports the closed validation
policy and checked actual/hit counters. These remain inside Power's protected
`timings.native_generation` envelope. Campaign v3 freezes four serial warmups,
requires owners 0/1/2/3 exactly once, then runs three serial 32-token measured
requests. Warmup failures are journaled and abort without retries. Twenty
operator tests and six root dependency checks pass. Focused Rust formatting
passes; root `cargo fmt --all -- --check` still refuses with Windows error 206
(command/file-name length), whose complete log is preserved.

Both Linux binaries were built offline from **3381 identical source files**;
the file hash maps, original build receipts and logs are under
`native-validation-cache-v29-build-pair`. Candidate v29 server SHA256 is
`8acb4cce19d70903ae0c5a85f8f0d58abe4169a0a241a9c3c5bf895ad16a6e20`;
cache-disabled control v30 is
`0bd62a0d64889124c03474eb4b66cba05decfb6dd6b3fa2c2c123fe7f38f0e27`.
Both retain the earlier explicit Sinkhorn/finite fusions and the same native
token clocks. The initial paired-build helper completed v29, then refused
before creating v30 because its shared exec namespace replaced a text local
with bytes. That failure was preserved; an isolated namespace built v30 once.
There was no remote GPU rerun or input replacement from that local error.

The owned v27 diagnostic service was drained by exact PID/start/UID checks;
both processes disappeared, the private key was revoked, and the eight GPUs
were empty. v29 then passed 451 startup controls, verified its full shared
sources in **423.506 seconds**, and began loading four complete replicas.
At 10:12 +08 its exact native process remained live without stderr; no API
throughput result is available yet. Its warmed campaign is prepared and waits
for the same listener. v30 qualification inputs are frozen/staged only and
have not executed on the GPUs. Matched v29/v30 warm measurements, output
parity and a promotion decision remain pending. No current user access key
has been delivered, and single-request **1000 token/s remains unqualified**.

v29 subsequently became ready and completed all four distinct-owner warmups
plus three measured serial 32-token requests, without failures or output
differences. Native selected-ID decode rates were **1.702678 / 1.693857 /
1.747373 token/s**, weighted **1.714319 token/s**. Weighted request end-to-end
rate was **1.364400 token/s**. The three measured requests recorded 591587
actual finite checks and 243316 proven hits, avoiding **29.143%** of repeated
checks. Raw warmups, requests, native clocks, telemetry and summary are in
`native-v29-warm-single-api`. These warm 32-token results do not isolate a
speedup against the earlier cold/short/Nsight variants. The exact v29 wrapper
and native process were then drained, both disappeared, the key was revoked,
and CUDA application inventory was empty.

The same-source cache-disabled v30 passed **451 controls / 19 GPU invocations**
and exited qualification before its separate service launched. At 10:34 +08
its exact process was still loading complete replicas, after shared-source
verification in 423.494 seconds. Its identical four-warmup/three-measurement
campaign is prepared and waiting. A matched cache adoption decision remains
pending; neither a historical percentage nor a component multiplier is used
as its full-model speedup.

The next original Aster experiment explicitly adds
`xq-fused-activation-codecs`: four fresh-output SM90 kernels encode/decode
E4M3 and packed E2M1 using the original seven-step bisection/thresholds,
even-code ties, reciprocal sign and signed zero. Owner finite/shape/budget
checks and original F32 division normalization remain. The tensor controls
remain callable, defaults stay off, input/output counts use a checked u32 ABI,
strided views become contiguous, and cudarc tracks storage/stream lifetimes.
The new independent hardware case covers every decoded byte, all finite
midpoints and adjacent F32 values, signed zero, strides, BF16-rounded inputs,
exceptional control parity and alternating component cost. **It has not run
on the GPUs yet.**

The initial v31/v32 binaries compiled, but an additional real NVRTC 12.6
compile-only precheck refused `stdint.h` because runtime compilation has no
host-header search path. No GPU context or kernel was created. That failed
source and both unqualified build receipts are retained. The self-contained
correction passed strict SM90 NVRTC with `ftz=false`, `fmad=false`, no fast
math, producing 13841 PTX bytes. Corrected candidate **v33** and control
**v34** contain **3386 identical source files**, and both built offline.
Their server SHAs are respectively
`c2ff70b641918ac1aefcddaa5499c55106975ce50ade855cab1ad0a3564bf06f` and
`28e2a44103026e26e330478fca6f988be981976064c6f567b44a2a27dde56a24`.
Both qualification stages are uploaded/hash-verified only; GPU launch is
deferred until the current full-model comparison is terminal and drained.
The corrected build/compile provenance is in
`native-activation-codecs-v33-build-pair`.

The codec source passed **450 Windows server-feature controls**, focused
Rust formatting, **20 operator tests** and **six workspace dependency tests**.
The mandatory root fmt attempt still fails with Windows error 206, retained
separately. There is no codec H200 numerical result, component timing,
complete-model speedup, CUDA Graph/TP/EP/DSpark implementation, performance
promotion or final user delivery claim from these staged artifacts.

The warmed same-source v30 control then completed all seven requests. Its
three native decode rates were **1.568611 / 1.561124 / 1.614935 token/s**,
weighted **1.581202 token/s**, versus v29's **1.714319**: an observed
**8.419% native decode improvement**. End-to-end weighted rate was
**1.264122 -> 1.364400 token/s**, **+7.933%**. Matched physical-owner samples
improved **8.547 / 8.502 / 8.201%**. All fourteen warmup/measured outputs were
identical with exact 22/32/54 usage. The cache remains an experimental
candidate; this was one candidate block followed by one control block, not
three alternating full-model blocks or sustained/broad-quality qualification.
The raw control campaign and telemetry are in `native-v30-warm-single-api`;
`native-v29-warm-single-api/matched-v30-comparison.json` records the checks,
counts and limits. Control counter zeros mean its step-scope counters were
not collected, not that the immediate finite validations were absent.

Before the subsequent owned-process drain could signal anything, a fresh
allocation check refused: the exact RJob and Replica were now **Stopped**.
A subsequent v33 qualification launch preflight also refused before creating
any process/result marker. The platform recorded pod deletion at
**2026-10-24 10:40:54 +08** and `LifecycleStopped` at **10:41:00 +08**, before
the immutable planned lease end at 14:31. Its events do not identify the actor
or underlying reason; neither OOM nor expiry nor user action is inferred.
The historical service receipt still says `service_listener_verified`, so it
must not be treated as current availability. The undelivered private v30 key
was separately revoked in its exact owned auth directory; no container PID
signal or successful process-drain claim is made. Current status pointers
mark the allocation stopped and service unavailable.

The minimal platform/event and cleanup proof is
`native-optimization-stop-20261024-1041.json`. v33/v34 still have no H200
numeric or full-model result and their stages remain bound to this stopped
allocation; do not edit those frozen inputs or retry the launch-requested
intent. A user clarification is pending on whether the stop was intentional
before any replacement resource request. Source work and completed evidence
remain available locally. No service address/key is currently deliverable,
and the overall optimization/deployment goal remains incomplete.


The next native candidate adds explicit, default-off `xq-borrowed-kernel-inputs`.
Read-only finite-check/activation kernel arguments use Candle `contiguous()`:
already contiguous offset views retain storage; strided inputs still copy.
The forced-copy control and owning weight/KV snapshot copies remain. GPU
kernels already slice each contiguous layout's exact offsets and retain
cudarc event tracking. Two new CPU tests cover offset guards, signed zero,
strides and U8 views. **452 Windows controls, 20 operator tests and six local
dependency guards pass**; focused formatting passes. Root workspace fmt
still fails on Windows os error 206. Same-source v35/v36 Linux CUDA builds
both succeeded, but no GPU numerical check or model speedup is claimed.
Their source maps and receipts are in `native-readonly-input-v35-build-pair`.

The user subsequently explicitly requested an original Xolotl trial. That
instruction authorizes restoring bounded resources for this trial and
supersedes the pending resource-stop clarification. The fresh eight-card
request was never assigned a node and was stopped before a two-card trial
was submitted. The earlier optimization RJob remains Stopped. The pair
passed actual CUDA memory round trips and both peer directions; original
Xolotl starts with only CUDA ordinal 0 visible. Original-engine results are
kept separate from the native a3s-power path. No new public endpoint/key or
1000 token/s qualification is asserted by these preparations.


Original Xolotl single-H200 experiments then ran on a fresh two-GPU allocation,
with only CUDA ordinal 0 visible to every inference process; the other GPU
remained idle. The previous eight-GPU jobs are terminal. The V3 XQ payload,
official Engram blobs and tokenizer are reused with pinned identities. Original
engine b345 single-card runs complete and actually emit meaningful text:
counts, arithmetic 42 and a Fibonacci function. A 60 GiB expert arena still
caused file-tier expert reads. A 160 GiB arena budget holds all 15360 experts
(142.4 GiB actual), removing those reads without dropping any routed expert.
Its count decode improves from weighted 23.218 to 45.658 token/s; the cold
128-token code sample improves from 20.599 to 36.931. Adding DSpark reaches
97.829 on counts, but 54.145 on the cold code sample. DSpark changes some
code output IDs versus plain greedy, so no bitwise/lossless claim is made
across different verify widths or confidence policies.

Broader campaigns use four public synthetic prompts, each one warmup plus
three measured serial requests: 32 tokens for counts and 128 for code,
English LRU prose and Chinese KV-cache prose. Actual original-engine context
is clamped to 4096 despite the requested 256; repeated prompts reuse their
prefix, while all emitted completion IDs are recomputed by the model. Rates
use actual token arrivals and N-1 intervals. Cold samples, outliers, exact
IDs, raw stderr and full worker sources are retained. No aggregate throughput
or profiled speed substitutes for single-request decode.

Depth 5 improves counts past 100 but regresses code/prose versus depth 4.
Turning off D3 prefetch and using a 0.45 confidence threshold observes count
110.177, code 100.357, English 65.204 and Chinese 71.315 weighted token/s.
These short measurements are not universal speed or sustained acceptance.
The user replaced the earlier target: the active requirement is now
**one H200 / one request / at least 500 generated token/s**, still unmet.

The fetched current upstream e9d0 snapshot and pinned patched ggml were built
for SM90 with CUDA 12.6, GCC 11.4 and Release settings. Original kernels pass
actual CUDA FP8/E4M3, FP4/E4M3, FP4/pow2 and HC-mix bitwise controls. Two
default-off experiments share one exact new binary: bounded graph metadata
(256 default; closed options through 2048 MiB) and asynchronous attn-router
compute only before its existing same-backend asynchronous readbacks/fence.
No finish/snapshot synchronization or model operation is removed.

New-source control / 1024 MiB / 1024 MiB plus async mixed weighted rates are
76.760 / 80.820 / 81.329 token/s. All 17 requests per profile have exactly the
same emitted IDs. The cache-only block observes +5.29%, with a count outlier;
async adds only +0.63% and slightly regresses code/prose. This is one sequential
block per profile, not alternating sustained qualification. Both remain
experimental; async is not adopted as a global optimization. A diagnostic
Nsight capture of a warmed English request is now running separately, never
used as the unprofiled speed result. No HTTP listener or API key is delivered
by these protocol trials. Complete measurements and default-off patch are in
`original-xolotl-single-h200`; the active 500 token/s goal remains incomplete.


### Xolotl H200 CUDA trace and expert row layouts (2026-10-24)

Single-visible GPU0, immutable e9d0826 engine + default-off graph patch, same
weights/prompts/DSpark depth5/conf0.45, arena160 GiB, PF0 and 1 GiB pass metadata.
R2 and R4 select existing `STRATA_EXP_MODE_T143/T11` layouts; Q2_0 retains its
control layout. Every one of the 17 request output ID sequences matches the
cache1024 control in both runs. All measured samples, including outliers, remain.
Mixed serial decode: control 80.8204, R2 89.5452 (+10.80%), R4 91.0824 (+12.70%)
tok/s. R2 count/code/English/Chinese: 120.9958/102.8369/75.8914/88.4147; R4:
113.5969/106.4493/77.1023/90.0539 tok/s. One sequential block per configuration;
these are candidates, not alternating-block confirmation or a universal rate.

Nsight interactive capture succeeded after three prose warmups, 128 output IDs,
engine exit0/reaped. Trace SHA256
`40481df9d08bd9fd5f0b238bb570b5d8ba7da2e26af6a5194ce8c32b308d723b`,
14,192,505 bytes, retained on the owned GPFS artifact path from the trial receipt.
Recorded events: 188,813 kernels and 45,936 copies over 2.1992 seconds; expert
gate/up/down kernels sum 0.67177 seconds of 1.44871 seconds recorded kernel time.
Recorded GPU busy union is 1.48647 seconds, **not** summed API waiting time.
Nsight 2025.3.1 warns driver13.2 is unsupported (uses CUDA12.9 trace libraries)
and some events might be missing; event counts and busy fraction only describe
the recorded trace. The profiled 57.87 tok/s is diagnostic and excluded from
unprofiled optimization comparisons. Stats generated its SQLite successfully;
the subsequent unnecessary export refused the existing SQLite. Read-only
`pragma quick_check` passed. No trace was overwritten or rerun to hide this.

The first capture refused unsupported `nsys start --duration=20` before capture;
its exact target was intentionally reaped (137), not diagnosed as OOM. V2 removed
that option and succeeded. Both attempts and exact frozen operators remain.

Next candidate: default-off PTQ1_0/Q3_K decode-once grouped kernels, separate
immutable build. Runtime values are closed (0/143/11/both); old kernel override
remains available for direct bitwise hardware controls. Numerical qualification
and full-model acceleration are pending, not claimed. The 500 tok/s goal remains
unmet; no HTTP service/key has been delivered by these protocol-only trials.


### Xolotl decode-once kernel hardware qualification (2026-10-24)

The separate SM90 Release build completed (engine SHA256
`e943305094fd8612718cf817985cf232ee457e31d434c0512b32a8097e7f30b8`).
Patch `04d402b60751fe31ca742b2402e4b5ffbecda7d91af9f7e106c0b7692fccffeb`
adds default-off PTQ1_0/Q3_K Split load/apply and routes only grouped expert
launchers through it. Original whole-block PTQ layout is compile-time required;
the older-kernel override still selects an independent scalar control. Model
weights, routes, activations, grid sizes and reduction order remain unchanged.

`CUDA_VISIBLE_DEVICES=0 ASTER_XQ_SPLIT_MMVQ=both
build/aster_xq_split_parity --aster-xq` ran on NVIDIA H200 SM90: 12/12 grouped
cases bitwise equal, zero failures, exit0. Tests cover six gate/down pairs at
5120x2304 and 1024x512, nine groups with 0..11 entries, unused grid rows and
scattered output destinations; output finiteness and unwritten sentinels are
checked. Synthetic data seed18, small finite scales. The whole model has not
yet been qualified at this point.

Microbench timings include activation quantization: PTQ type143 scalar/split
at T1/3/5/8: 116.30/121.76, 316.54/281.74, 515.85/450.38,
816.25/697.57 us. Q3_K type11: 162.39/177.42, 439.30/228.85,
718.95/405.99, 1138.19/489.45 us. Single-token regressions are retained;
these synthetic kernel timings are not full-model token/s. Original frozen
patch, build worker, control worker, exact binary identities and stdout are
retained; full-model control/candidate comparison is next. No 500 tok/s claim.


### Xolotl hybrid profile: three alternating pairs (2026-10-24)

All-on decode-once first observes 80.5859 -> 83.7121 mixed serial tok/s
(+3.88%), but code regresses 4.65%; it is not selected. The hybrid keeps
PTQ1_0 on existing R4 (`STRATA_EXP_MODE_T143=4`) and selects Q3_K's new
decode-once kernel (`STRATA_EXP_MODE_T11=0 ASTER_XQ_SPLIT_MMVQ=11`). Q2_0,
routes, experts, activations and weights are preserved. The exact same
`e9433050...` binary runs all new controls/candidates, GPU0 only.

Three independent process pairs alternate C/H, C/H, C/H, each one warmup
and three measured requests for four public prompts plus arithmetic. Mixed
rates C/H: 81.8408/91.8142 (+12.19%), 84.5981/95.6128 (+13.02%),
84.9996/92.9078 (+9.30%). All four cases improve in every pair; all 51
paired request ID sequences are equal (102 total requests). Every process
exits0 and is reaped. Serial pooling of all measured N-1 token intervals:
83.7891 -> 93.4179 tok/s (+11.49%). Count/code/English/Chinese controls:
112.0719/98.6990/69.7455/82.8520; hybrid:
129.3948/110.8107/78.3789/90.4377 tok/s. Raw outliers remain; code minimum
88.8027, so this does not even claim every measured request exceeds100.

This hybrid is selected only as the following experiment baseline. Source
flags remain off by default; no HTTP service or key is delivered. The active
single-request 500 tok/s requirement remains unmet. Short repeated-prompt
equality is not long-context or broad model quality qualification.

The protocol operator now has a 900-second trial alarm and a 950-second outer
deadline within the immutable resource lease, plus SIGTERM cleanup. Two owned
CPU-only child-process controls exercise the exact worker handler/finally for
alarm and termination: both reaped their child and closed its pidfd. The
tested worker SHA256 equals the hybrid's frozen worker; no GPU work is
claimed for these lifecycle controls. All historical operators remain frozen.

Next bounded candidate, still unbuilt/unqualified at preparation: default-off
SM90 Q8_0 dense projections at widths2..8 select ggml MMQ instead of MMVQ.
It does not transcode weights; TensorCore accumulation/activation rounding
may differ, so paired finite numerical controls and full-model output/quality
review are required. No bitwise, speed or 500 tok/s claim is made for it.


### Xolotl Q8 TensorCore candidate and refused broad switch (2026-10-24)

V1 stopped before compilation/GPU work when the appended CMake test-target
patch did not match the preceding appended split-target context. Its failed
root, rejects and logs remain. V2 changes only that patch context; separate
SM90 build completes (engine SHA256
`282d819b5a806fb97677a225399bd4bc62c2c39bd440985024c2c6caccece2b1`).
The default-off broad selector changes Q8_0 widths2..8 from MMVQ to MMQ.

Twenty-two real-CUDA synthetic matrix controls run each exact graph five
warmups and twenty timed repeats, with paired outputs retained on owned GPFS
and hashed. All values finite; three unchanged M1 controls are bitwise equal.
The nineteen switched cases differ at relative L2 ~2.05e-4..2.32e-4, failing
the predeclared 2e-4 L2/max-normalized gates. No full-model V2 trial is launched.
This is a refused equivalence threshold, not evidence of model quality harm.
Small 5120x1280 M2 worsens 10.735 -> 19.545 us, while 1280x32768 M8 improves
53.015 -> 25.981 us and 5120x129280 M6 improves 348.106 -> 277.795 us. Broad
MMQ is not adopted and microbench times are not converted to model token/s.

Primary source diagnosis: MMVQ stores q8_1 scale through FP16, whereas MMQ's
D4 layout stores FP32. V3 retains the original numerical limits and restricts
dispatch to large 1280x32768 and 5120x129280 matrices at widths2..8. Its new
MMQ overload rounds only selected D4 input scales through FP16; all original
entry points, M1, small shapes, other types and MoE paths retain original
behavior. The second quantizer overload preserves callers, including the
macro-renamed embedded Strata prefill translation unit. V3 build and new
hardware/full-model qualification are separate and pending at preparation.

Future Q8 full-model trials are bounded to600 seconds with650-second outer
cleanup deadlines inside the immutable resource lease. Actual alarm and
SIGTERM child-reaping controls pass on the new worker; the previous hybrid's
exact frozen worker/proof are retained separately. No 500 tok/s claim is made.


### Current single-H200 300 tok/s milestone (2026-10-24)

The user now requests 300 tok/s first. This is the current milestone;
historical 500/1000 requirements and failed trials remain in the record.
300 is unmet. Measurement remains serial `(N-1)/(last-first)` token-arrival
intervals; actual context4096, four short prompts, no generated-response reuse.

Q8 V3 real-SM90 controls pass22/22 at the unchanged2e-4 numerical limits
(max relative L2 2.4565e-7); all15 unselected cases are bitwise equal.
Same-binary full-model control/candidate complete17 requests each, exit0
and reap: mixed90.26349 ->85.87207 tok/s (-4.8651%). Code/English/Chinese
token sequences differ, while count and arithmetic agree. It is not adopted;
synthetic equivalence within tolerance does not establish output identity or
broad quality. The exact two-shape MMQ/scale-rounding patches remain default off.

A separate same-binary DSpark threshold pair uses the qualified expert
hybrid, GPU0 only, depth5, PF0. Confidence0.45 ->0.20 yields
92.07139 ->79.48042 mixed tok/s (-13.6752%). The twelve measured samples
per profile include every outlier; all seventeen requests finish, exit0 and
reap. Request token sequences are not all equal. The lower threshold is not
adopted; the previous93.41786 pooled hybrid remains the selected baseline.
Actual worker alarm/SIGTERM controls pass both CPU-only child-reaping cases.

Both full-model pairs preserve frozen workers, stderr, input IDs, all output
IDs, monotonic arrivals, numerical controls and comparison operators. Commands:
`summarize_xolotl_trial.py --mode single-current-q8-mmq`,
`summarize_xolotl_trial.py --mode single-current-split-conf020`,
`summarize_xolotl_trial.py --mode single-current-split-conf045-final`,
`compare_xolotl_conf300.py`, and `check_xolotl_conf300_cleanup.frozen.py`.

The completed two-H200 allocation is stopped only after GPU-idle proof and
reaped trials; its exact job and replica UIDs are terminal before submitting
one new single-H200 allocation. The follow-up has a separate immutable
one-hour lease, restartNever, no overlapping allocation, and no HTTP/key claim.
The platform admits20CPU/220GiB/oneH200 despite requesting40CPU/440GiB;
resource validation and any model load must use the actual admitted limits.

Anonymous HEAD attempts for the original8.42GB higher-precision DSpark
sidecar time out through both compute exec and the dev-jump transport.
No download, completed weight hash, or higher-precision inference is claimed.

Explicitly not claimed: 300 tok/s reached, an upper hardware bound, every
request above100, broad model quality, long-context performance, or a serving
endpoint/API key. No product source flag is promoted by these experiments.


### Device-resident expert verify inputs on the new single H200 (2026-10-24)

The new allocation validates exactly one physical H200, SM90, driver595.71.05,
143771MiB NVML memory,700W limit. Actual cgroup allowance is20CPU/220GiB.
The old two-card job/replica are terminal before submission. This is a new
node and CPU allowance: use its same-binary control, not cross-node timings,
for an isolated optimization comparison. Immutable one-hour lease remains.

Default-off `ASTER_XQ_DEVICE_VERIFY=1` keeps the batched expert input tensor
on the CUDA backend instead of copying it to host and then back. Host route
IDs/weights, existing dense and tier fences, quantization, expert arithmetic,
and outputs remain. Actual CPU expert jobs trigger an exact D2H copy before
their pool work. CPU dense, unbatched, and either remote-helper mechanism
refuse this new entry point. Existing public method signatures are retained.

SM90 build completes with engine SHA256
`6c6ae00cf26236f6e6aa6c9c3f20261e6e35313a4f498f056bf4f6354d4b1811`.
Twelve grouped expert bitwise controls plus fused-quantization and HC-mix
CUDA controls pass; CPU-only alarm/SIGTERM child-reaping controls pass both.
Full generation control/direct:94.99749 ->96.26502 mixed serial tok/s
(+1.3343%, one process pair). All17 paired request ID sequences agree;
both exit0 and reap. This small gain is not yet stable-speed qualification
and does not promote the default flag or replace the qualified baseline.

Separate correctness-only control/direct campaigns force the batched PCIe
share to zero, using the public prompt `1+1` and max2 generated tokens.
Each request actually runs41 CPU experts (plus439 GPU hits); the cold prompt
runs137 CPU experts. All4 paired request ID sequences agree, exit0/reaped.
The CPU-fallback timing is not a model speed or300 tok/s qualification.
Commands/operators and exact frozen workers, stderr, IDs and monotonic
arrivals are retained with the single-device allocation and cgroup proof.

A separate pending kernel combines weight-decode-once with2/4 interleaved
output rows per warp for PTQ1_0 and Q3_K. It retains the scalar lane-k and
warp-reduction order and has a closed default-off selector. Preparation and
source patch are retained separately from build and hardware qualification.
No performance or correctness result is claimed for this pending kernel.

Explicitly not claimed:300 tok/s, stable transport speedup, long context,
broad quality, a model-serving address/API key, or any GPU1 work.


### Combined decode-once and row-interleave result (2026-10-24)

The new SM90 build completes, engine SHA256
`72e53b0d3b2652ab8721ac0fbeb89d46d50e854ccf2ab1416bd731a7e37ffa7b`.
Row2/row4 each pass12 grouped-expert bitwise controls (24 total), with
unused groups/entries and scatter destinations. FQ/HC-mix CUDA controls and
both actual worker alarm/SIGTERM CPU-only child-reaping controls also pass.

The same-binary serial full-model control/row2 pair completes17 requests
each, exit0/reaped, all17 paired output ID sequences equal. Mixed speed
94.77734 ->85.51606 tok/s (-9.7716%). Count129.21982 ->115.22597;
code115.57320 ->103.12128; English78.69821 ->71.12273;
Chinese91.07215 ->82.92161. Every case regresses; row2 is not adopted.
Row4 is slower than row2 on all Q3_K micro widths, so its full-model trial
and the second control are not launched after this screen. No row4
full-model performance claim is made. Source defaults remain off.

The `-r2` name also triggers older generic row metadata in the launcher.
The frozen worker's later PTQ-specific selector overwrites both T143/T11,
so the effective candidate selectors remain T143=0,T11=0, split=both,
interleave=2. The original intent and frozen worker are retained. Comparison
normalizes this superseded metadata only after requiring the explicit later
selector; all other model/input/config fields must match.

Commands: `qualify_xolotl_split_rows_build.py --observe`,
`run_xolotl_split_rows_campaign.py`,
`summarize_xolotl_trial.py --mode single-current-rows-control`,
`summarize_xolotl_trial.py --mode single-current-rows-r2`,
`compare_xolotl_split_rows.py`, `check_xolotl_rows_cleanup.frozen.py`.
All samples, raw token arrivals, exact historical workers and stderr remain.
300 tok/s remains unmet. The previous qualified expert hybrid is preserved;
the transport +1.3343% single pair is not promoted to stable qualification.


### Standalone SM90 TensorCore ternary-code prototype (2026-10-24)

The previous goal turn made progress through actual same-binary full-model
tests; no300/500 milestone was met. This turn changes no model-serving path.
A standalone CUDA prototype uses `mma.sync.aligned.m16n8k16` with FP16
representations of integer ternary/q8 codes, original FP32 scales, and the
old per-lane block pairing/butterfly. Parent Xolotl/ggml MIT notices remain.
The exact parent fixture, libraries, compile/link commands, source hashes,
worker, outputs and receipts are retained. Compilation is GPU-free,
CUDA12.6.20, C++20, O3, SM90; GPU controls expose exactly one H200.

V1 refuses at compilation because NVCC cannot deduce a mixed initializer-list
range. V2 uses an explicit typed shape array in a separate fresh root; no GPU
result is claimed for V1. V2..V5 each pass all6 controls (24 total): actual
5120x2304 and1024x512 expert geometries, zero-sized groups, scattered input
tokens, unused output rows, and windows1/3/5/8. Every gate/up float is bitwise
equal to the existing R4 path; post-SwiGLU q8 bytes are identical; finite and
NaN sentinel checks pass. No tolerance is loosened. These are synthetic
phase1 results, not generated-token/model quality qualification.

Same phase1 functionality includes input quantization, gate/up, SwiGLU and
q8 output; the candidate additionally writes a temporary h row. One warm
launch plus20 CUDA-event timed repeats per side are retained; no model tok/s
is inferred. At7 groups/window5, baseline/candidate microseconds:
V2 138.2896/330.2976; V3 138.6832/322.3936;
V4 138.3072/337.5040; V5 138.3248/335.2896. All are slower.

V2 retains a512-byte local frame on the main shape. V3 makes reduction
indices compile-time constants, removes local frames/spills, but uses254
registers. V4 keeps only five pending binary-tree levels in bit-reversed
leaf order; every numerical gate still passes, but the compiler spills
1092 bytes at128 registers (736-byte stack). V5 adds a compiler memory
clobber at the MMA operand boundary; it does not remove those spills or
reverse the regression. It uses shorter120/30/90-second compile/link/GPU
budgets and300-second outer cleanup, retaining all6 cases and20 repeats
inside the current immutable resource deadline.

The prototypes are not integrated or adopted. The broad single-request
baseline remains about95 tok/s on this allocation (transport single-pair
96.2650 is still not stable-speed qualification).300 and500 remain unmet.
Next investigation must separate packed-weight decoding from matrix work;
the current tests do not establish a hardware upper bound or that Tensor
Cores alone can deliver either target. No endpoint/key is delivered.


### Exact INT8 MMA and L2-evicted controls (2026-10-24)

V6..V9 retain all six strict cases, but regress. V6/V7 predecode synthetic
GU codes to FP16, excluding preparation from timing and reporting the extra
332881920-byte seven-group footprint. Window5 reference/candidate times
are138.9008/238.8208us and138.6400/215.4160us. These expanded diagnostics
do not fit an all-model single-H200 cache and are not adopted. V8 stores
two ternary codes per nibble, retaining original half scales:34/28 of
the original GU bytes,43868160 bytes for seven full-size experts. A shared
lookup causes severe spills and138.9920/1238.6912us at window5. V9 switches
to a warp-register lookup but still spills:138.9296/1223.0719us. Neither
enters the model engine.

V10 uses exact INT8 codes/INT32 MMA, retaining original FP32 scale arithmetic
and old leaf pairing/butterfly in a bounded loop. No model weights/scales
are rounded or changed. It removes spills but window5 is138.4016/147.3360us.
V11 partitions that same tree among four cooperating warps:64 registers,
4096 shared bytes, no spills; window5 is138.7792/123.8512us. V12 losslessly
uses signed two-bit code fields and shift/mask expansion instead of base3
division. All81 valid four-code word combinations pass a host exhaust.
Its window5 is138.4624/92.9808us and window8 is209.2240/93.5856us; window1
and3 remain slower. V10..V12 each pass all six strict GPU cases unchanged.

V13 keeps V12 arithmetic unchanged. It reads twice the device-reported L2
size through a volatile global buffer, with an observable atomic result,
before each CUDA-event interval;125829120 bytes are read. Eviction cost is
excluded. All ten alternating reference/candidate pairs in each of six
cases are retained. This is a cache-eviction control, not a full-model
working-set or token-speed test. All six strict checks pass. Window5
medians are in the retained comparison JSON (about140.8/97.1us), window8
about211.7/97.6us; small windows1/3 still regress. Preparation (~0.45ms for
seven groups) and the21.4% larger GU code-cache bytes remain outside these
phase1 intervals and must be included in any model integration decision.

V2..V13 now retain72 strict GPU cases: zero differing gate/up floats,
identical post-SwiGLU q8 bytes, finite written outputs and untouched NaN
sentinels. These prototypes change no serving path and qualify neither300
nor500 tok/s. The last full-model measurements remain94.9975 control and
96.2650 transport experiment on the previous single-H200 allocation;
the latter is one pair and is not a stable speed qualification.

The previous single-H200 job/replica reached Stopped before submission
of the continuation job. The new exact-UID single-H200 allocation proof
and immutable15:21:12 +08 deadline are retained; there is no resource
overlap, HTTP listener or API key. An anonymous Windows metadata probe
can now reach the pinned public original MTP sidecar (8421868640 bytes).
Download/hash/transfer and model qualification have separate receipts;
this HEAD response alone establishes none of them.


### Original-PTQ TensorCore engine A/B (2026-10-24)

V14 decodes original PTQ bytes directly, with no auxiliary weight storage
or preparation. All six strict GPU checks pass, but window5 regresses:
138.5520/182.9392us reference/candidate. V15 replaces each repeated modular
multiply-by3 loop with an exact power and unrolls the four q8 subblocks.
All1280 byte/depth states pass a host exhaust; all six strict GPU controls
pass. Window5 is138.6544/98.8912us, and window8 is209.1920/100.0048us.
Ten alternating L2-evicted pairs per case are retained as in V13. Small
windows1/3 remain slower. V2..V15 total84 strict standalone GPU cases.

A fresh opt-in experiment integrates this original-PTQ GU path into the
existing native expert dispatch. Small groups (<4 entries) retain the old
R4 kernel; larger groups use INT8/INT32 MMA. It applies only to type143,
5120x2304 gate/up with the existing R4 mode and no LoRA. Other paths,
down projection and the existing SwiGLU/q8 implementation remain. There
is no changed weight, scale, GPU cache blob format, CPU interface or public
Rust API. `ASTER_XQ_PTQ_MMA` defaults0; only0/1 are accepted. Both flag
modes pass six exact controls (12 integrated checks), including empty
groups, input scattering, partial8-column windows and unchanged sentinels.

The immutable parent archive is copied into a new owner-only directory;
one rebuilt CUDA object replaces its matching archive member. The old
source, libraries and engine are not mutated. Full original/patched source,
header, diff, worker, compile/link commands, archive/binary hashes, outputs
and resource receipts are retained. Both full-model tests use binary
fc958d782461c3d87747da94cb5c394de6b672c596429cc52dcc876c8c513443.
The only plan difference is the new flag. Context is actually4096, one
visible physical H200, unchanged main model/rank/Q2_K MTP/Engram, DSpark
depth5/confidence0.45, graph metadata1024MiB, no route bias/skip/file.

Control/candidate each finish17 serial requests with exit0 and a reaped
engine; all17 paired token sequences are identical. Across12 measured
requests, mixed real generated-token rates are94.691953/94.210710 tok/s
(-0.508220%). Counts129.1932/128.6713, code114.7562/114.3245,
English78.9250/78.3334 and Chinese91.0274/90.7075 tok/s. Warmups and
arithmetic42 are retained separately. This one paired round establishes
no stable gain and meets neither300 nor500. The candidate stays off.
The local GU microbenchmark improvement is not a model-speed improvement.

Next investigation must account for small-group distribution and the cost
of the additional dispatch. A single-kernel uniform group branch has not
been implemented or tested. The original-precision MTP sidecar is also
being fetched anonymously to the local workstation: the first bounded
600-second transfer times out with a retained1280141744-byte prefix.
After its PID is terminal, a separate3600-second bounded resume preserves
and hashes that prefix, resumes the pinned revision, and requires the
complete8421868640-byte SHA256 before any transfer/model test. This is
the auxiliary MTP file; the163GB main quantized model is already present
and loaded successfully. No result is claimed for the partial sidecar.

After all research workers and both model engines finish, GPU idle is
verified, and only exact job51cd429c-43d9-45bf-a38f-ff8eabca2809 and its
replica are stopped. A subsequent exact-UID observation confirms both
Stopped. No HTTP listener/key is delivered. A new GPU allocation requires
fresh terminal-predecessor and ownership/resource proofs.


### Single-kernel PTQ dispatch and GPU group counter (2026-10-24)

The new exact-UID continuation follows a fresh terminal predecessor guard;
job13500b32-b68b-4d0f-8c70-08cc1e4e5e7d admits20CPU/220GiB/one H200,
with its own fixed one-hour deadline after the CUDA memory round trip.
The prior job/replica terminal proof, submission, startup image-pull events,
physical GPU UUID and resource result are retained. No jobs overlap.

The candidate merges the previous two launches into one group-uniform kernel.
Original R4 arithmetic is factored into a private inline device body; groups
below4 use it, while larger groups use the unchanged exact INT8 MMA body.
Original PTQ blobs/scales and public interfaces remain. The new kernel uses
128 registers,4096 shared bytes and no stack/spills; standalone R4 uses127
registers. A separate template adds one diagnostic counter per logical group,
not per row block. Default0 keeps the old path, and diagnostics are off in
both timing profiles. All18 strict cases pass (off/on/diagnostic). The device
counter exactly matches1184 logical groups and4928 entries from the fixed
synthetic fixture. It works across graph replay and does not copy routing
metadata back to the host. Histogram bins0..7 are exact group sizes; bin8
is8 or more. Real-model diagnostic counters include prompt and decode calls;
their elapsed rate is not used as model-speed qualification.

Each timing profile finishes17 serial requests, exits0 and reaps. All17 paired
token sequences are equal. The new same-binary result is
94.470597/93.214044 tok/s
(-1.330100%). It is one paired round and provides no
stable gain; the candidate stays off and meets neither300 nor500. This does
not establish a hardware ceiling. Complete sources, patch, compiler/link
commands, archive/binary hashes, exact workers and outputs are retained.

Primary pinned engine source clamps served DSpark depth to5. No depth8 test
is launched or claimed. One/four versus16 host threads are separate pending
profiles on the same binary, with CUDA execution and model/routing unchanged.
The original MTP transfer may launch only after complete local SHA validation;
GPFS upload is followed by another complete SHA and immutable publication.
The four complementary HTTP range probes terminate without any complete
64MiB chunk and are not substituted for the live sequential resume. No
model result is claimed for a partial sidecar. No HTTP listener/key is issued.


### Explicit shutdown diagnostics and original MTP result (2026-10-24)

The initial merged-kernel real-model diagnostic finished successfully but
did not print its atexit counter. Pinned native serve intentionally calls
`std::_Exit(0)` to avoid a detached stdin reader holding cin's teardown lock.
The missing counter does not establish that the new kernel was not executed.
V3 retains that shutdown policy and dumps the GPU aggregate explicitly before
tier.close, with a diagnostic-only device synchronization. Default timing
profiles have diagnostics off. Original/patched main sources, exact parent
C++ compile command, links, header and hashes are retained. All18 numerical
and exact synthetic histogram checks pass again. The17-request real-model
diagnostic exits0, reaps, and has identical output IDs to control.

Its actual eligible PTQ groups are [0, 102227, 27622, 11347, 5254, 2294, 1609, 252, 194],
150799 logical groups and237338 entries.
93.631921% of groups and
80.691672% of entries belong to groups
below4. This is process-wide type143,5120x2304,R4,no-LoRA execution,
including any startup, prompt and decode calls. Bin8 means8or more.
It is not an exclusive decode histogram or token-rate qualification.
The next kernel work should prioritize those small groups; uniform-window5
or8 microbenchmarks do not represent their distribution.

The first3600-second resume ends at8321500432 bytes with curl28. Its exact
handle is terminal before a separate300-second continuation resumes the
last100368208 bytes. Complete Windows SHA256 matches the pinned8421868640-byte
file. A fresh private GPFS directory receives one SCP upload; its independent
whole-file SHA matches before atomic publication. Both source/transfer/hash
workers and receipts are retained. The main model was already present.

On the exact same binary and main-model inputs, Q2_K/original MTP rates are
94.470597/91.443453 tok/s
(-3.204324%). Each finishes17 requests with exit0
and a reaped engine; all17 token sequences equal: False.
This whole-profile comparison also includes the changed draft footprint and
acceptance. It is not a gain, and Q2_K stays selected. Original precision is
not assumed faster. No300/500 milestone is met.

The same-binary16/four-host-thread screen gives
94.470597/92.967156
tok/s (-1.591439%), all17 output pairs equal.
The one-thread screen reaches its300-second alarm during loading, before
READY or any request, and exits with a reaped engine (-15).
No one-thread decode speed exists. Sixteen threads remain selected.


### Exact PTQ activation-sum reuse: full-model regressions (2026-10-24)

The measured eligible expert distribution motivates small-group work. V1
retains the original ternary decoder, per-block FP32 scaling and warp
reductions, and precomputes exact int32 activation-code sums once per entry.
It never divides the rounded q8 half sum by its scale. A default-off closed
operator flag selects0,gu,both; only PTQ143,R4,5120x2304,no-LoRA is eligible.
The temporary float-h scratch is used before GU/SwiGLU or after quantization
before Down. Weights and public APIs do not change.

All39 GPU cases pass: exact GU and final Down floats, identical post-SwiGLU
q8 bytes, finite written outputs, and untouched output/GU sentinel rows.
Cases include empty groups,1/2/3/5/8-entry groups, mixed PTQ/Q3 projections,
arbitrary token and destination maps, more input tokens than entry capacity,
fallback shape, grouped-v1 and separate phase1/phase2 execution.
The new GU uses101 registers versus127 for original R4, both without spills.
Down uses80 for both. Compiler resource savings are not model-speed gains.

The exact same binary gives94.422852 tok/s with the flag off,
91.623769 with GU reuse (-2.964413%), and91.283100 with GU/Down reuse
(-3.325203%). Each profile completes17 serial real-model requests,
exits0 and reaps. Every paired output ID agrees. No variant is adopted.
The small synthetic cases also show the extra launch cost. V2 therefore
moves the exact sum into640 bytes of shared memory in the original block;
its build, numerical gates and separate full-model outcomes are retained
individually. A prepared or numerically correct kernel is not a speed claim.

The first local model launcher encounters a variable-name error before
writing any intent or creating any remote model process. Its corrected
operator is retained. No trial was silently restarted or overwritten.
Neither the300 milestone nor the500 broader goal is achieved here.


### PTQ sum reuse rejected after three paired full-model rounds (2026-10-24)

V2 passes another39 exact GPU controls. Its first same-binary GU result is
92.105277 to93.344551 tok/s (+1.345497%); GU/Down is93.669060 (+1.697821%).
These are one-pair observations, not stable gains. Before any repeats, the
ABBAAB order and adoption gate are frozen: three complete17-request pairs,
all51 output pairs equal, every pair positive, and pooled gain at least2%.
The next two GU pairs yield-0.719850% and-0.750808%. All six engines exit0
and reap, with all51 output pairs identical. Pooled rates are
92.281683/92.235591 tok/s,
-0.049948%. The predeclared gate fails, so the entire
activation-sum direction remains off. No300/500 milestone is achieved.

The next action is a separate bounded GPU timeline capture of the existing
R4/Q3 configuration with sums off. Its three warmups and one captured prose
request are diagnostics only. Its600-second alarm, exact target PID/start
identity cleanup and separate CPU statistics operator are retained. No
speedup or complete diagnosis is claimed merely from preparing that worker.


### Current R4/Q3 timeline redirects the next experiment (2026-10-24)

The separately captured existing R4/Q3 profile completes three warmups and
one captured128-token prose request, with a reaped engine. The14206044-byte
trace SHA is7fb4df56b43862e98ef57270782333db7a51d92c96d00469d43696903f382862.
The CPU-only statistics command succeeds, with a34590720-byte SQLite file
passing quick_check. Exact full kernel symbols and counts are retained,
without inferring unknown kernel meanings from word-list categories.

The recorded kernel sum is1254918053 ns. The exact Q3_K expert GU/Down
symbols total203760939 ns (16.236992%),
versus147071307 ns (11.719594%)
for the PTQ143 R4 GU/Down symbols. Individual Q8 dense specializations are
also among the largest recorded kernels. The capture records188813 kernels,
45919 copies and9561 cudaStreamSynchronize calls. Recorded GPU busy union
is1293497751 ns across2020980987 ns of recorded event span. Nsight warns
that driver13.2 is unsupported by its12.9 collection libraries and not all
events may be collected. These are diagnostic recorded events, not exact
hardware utilization. API waits overlap GPU execution and are not added to
GPU time, and the profiled token rate is not a service performance claim.

An explicitly untested next hypothesis isolates Q3_K row interleaving while
retaining PTQ R4 and split11. The historical row experiment simultaneously
replaced the PTQ path, so it did not settle that isolated question. Its
exact current13-case GPU fixture and same-binary full-model gates must pass
before any claimed gain. Larger dense and host synchronization execution
changes remain necessary research; no300/500 feasibility or speed ceiling
is established by this capture. No further PTQ-sum variant is planned.


### Q3-only rejection and asynchronous dense-chain prototype (2026-10-24)

A39-case exact current-fixture screen keeps PTQ143 R4, Q3_K mode0, split11
and sums off, while selecting only Q3 row0/2/4. Every GU/Down float, q8 byte,
finite and sentinel check passes. In the heterogeneous mixed-format cases,
Q3 Down whole-call times are306.732819/306.783997/314.862396 us; Q3 GU
times are308.489624/313.998413/398.291199 us. These cases give no useful
positive signal, so neither variant is taken to another full-model screen.
The scope is those actual synthetic cases, not an all-Q3 speed ceiling.

The source-linked next prototype instead queues persistent single-sequence
CUDA finish and same-backend attention work before the existing route
readback fence. It is default off, preserves weights/math and the tier's
cross-stream fence, and drains pending work before non-reusable allocator
operations, pass/whole graph-cache invalidation and destruction. V2 also
drains any partial failed graph submission before returning an error.
Caller-owned finish graphs, multiple slots and row-mode finish stay on
the existing synchronous path. Exact source, compiler, archive substitution,
private build result and hermetic lifetime-order test output are retained.
V1 was compiled/host-tested only and is superseded before any live-model use.

Host tests are not GPU correctness or performance evidence. Before adoption,
V2 needs paired17-request full-model output identity, actual candidate-path
activation, separate allocator/cache stress and repeated timing if positive.
Cont3 job and replica both complete before one bounded cont4 request is
submitted; no immutable lease extension or overlapping GPU allocation occurs.
No300 or500 token/s result is claimed here.


### Separate stable single-H200 API delivery (2026-10-24)

The user explicitly requests one serving H200 and a different H200 for
optimization, and chooses this Windows computer as the client. Their two
physical GPU UUIDs and exact allocation/replica identities are retained.
The serving allocation is bounded to six hours from its successful resource
probe, with access expiring at 2026-10-25 00:37:50 Asia/Shanghai. It is never
used for the experimental dense-chain candidate. The qualified e9433050
baseline runs with the pinned upstream Xolotl API, official template and
tokenizer, ctx4096, DSpark depth5/conf0.45, PTQ R4 and Q3 split11. This is
the original Xolotl implementation, not completion of the a3s-power Rust
native engine. One request executes at a time; other clients queue.

The first service attempt fails its CPU security tests before GPU startup
because the public bundle omitted upstream serve/chat_template.jinja. Its
failure and exact worker are preserved. V2 supplies the two upstream data
files, passes all23 security tests, the upstream DS41 API/tokenizer/tool
tests, and exact five-prompt template/token-ID identity before model load.
The real Windows SSH path then passes model-list authentication, rejection
of absent/wrong/old keys, arithmetic, code, Chinese SSE and two simultaneous
clients' output isolation. The key is generated into owner-restricted private
files only. No credential content is copied into evidence or checkpoints.
The local loopback tunnel is hidden, bounded to the access window and retries
SSH failures. The server supervisor has a bounded restart budget.

An actual short API load test then warms four fixed synthetic prompts and
runs16 requests at each client concurrency1/2/4/8: all64 measured requests
succeed, with zero errors or timeouts. Aggregate end-to-end throughput is
90.0238/91.8880/92.3623/91.9693 completion tokens/s. TTFT P95 is
0.18375/1.76975/4.30025/8.06625s and total request P95 is
1.64775/3.08275/4.547/9.08975s. The request mix emits32 or128 tokens.
These are Windows/API wall-clock measurements, including queue/network
costs. They are not a long soak or a300/500 token/s qualification. Raising
client concurrency leaves throughput almost unchanged and increases queue
delay, as expected for the single active engine request.


### Dense-chain V3 paired improvement and scope (2026-10-24)

V2's first full-model pair regresses95.1364->86.6998 token/s (-8.8678%)
and changes8 of17 output sequences. It is rejected, never served. Source
inspection locates a missing dependency when DSpark immediately reads state
on a different CUDA stream after queued finish. An actual SM90 regression
reproduces6 stale reads without the fence and6 exact reads with it. V3 adds
explicit external state-access fences as well as the allocator/cache and
destructor guards. The failed local repeat preflight (missing a profile
lookup, before any model intent or GPU launch) is preserved; corrected V2
operators run the unchanged predeclared campaign.

The three same-binary V3 flag0/1 pairs are93.4120->94.8655 (+1.55597%),
93.3228->94.8060 (+1.58932%), and93.3988->96.4520 (+3.26894%) token/s.
Pooled rates are93.377857->95.368418 (+2.131727%). All51 paired sequences
match; all6 engines exit0 and are reaped after102 requests. The predeclared
each-pair-positive and pooled>=2% gate passes. Separate allocator-reuse-off
and256MiB cache stress runs9 requests per side, causes2 actual pass-cache
resets per process, preserves all9 paired sequences and reaps both engines.
Its86.1235->86.3840 (+0.30246%) timing is diagnostic only.

The qualified V3 receipt is promoted as the next optimization control only.
The independent stable API continues to use the e9433050 baseline. Source
defaults remain off. Qualification covers the measured single-sequence,
ctx4096, DSpark5, short32/128-token prompt cases; it is not long-context,
multi-slot or long-soak validation. Neither300 nor500 token/s is reached.


### Server VIP,131K context and pending WorkBuddy acceptance (2026-10-24)

The4096-context service rejected the user WorkBuddy35700-token request.
A shadow exact stable e943 binary qualifies131072 context;35,700 actual prompt
tokens return42 with HTTP200, without truncation. The old service is gracefully
replaced; original processes are reaped. At the user's explicit request all
Windows forwarding processes, the temporary /32 alias and the task firewall
rule are removed. A separate owned MetalLB VIP10.102.93.68:80, pool bgp-pool-v3,
is directly reachable from this Windows with HTTP proxies disabled and from
the other physical H200 node. No other physical LAN machine or absence of VPN
is claimed. Superseded NodePort and default-pool VIP are removed with atomic UID
preconditions. API keys stay in restricted runtime files only.

Actual WorkBuddy requests carry~35K-37K tokens and27 tools even for hi, and a
37388-token request is cancelled after127seconds before generation. Increasing
prefill batches256to8192 and enabling8192MiB/8-slot RAM conversation caching
qualifies a public35700-token cold request with48.02s first output, an unrelated
side request, then exact35700-token cached-prefix restore with0.0501s first
output (actual usage reports35700 cached tokens). This is adopted for cache
settings only; cold latency is still slow. Serving/optimization roles are
swapped within the same two physical H200 allocations, with exact drain/idle
proof before the previous serving GPU becomes the optimization GPU. A bounded
server-side worker retires the owned VIP at its current immutable lease end,
unless service ownership/deadline has since been reassigned.

The installed WorkBuddy bundled lite-wb client loads the user's actual approved
models.json and returns hi successfully in two new non-persistent sessions:
first output60.77s/41.96s, not a latency acceptance. GUI automation initialization
fails twice with Windows path-not-found error3, so no GUI end-to-end pass is
claimed. A real native tool-call test fails: the model writes a complete JSON
object inside a DSML invoke; upstream's parameter-tag-only adapter silently
returns empty arguments. Truncated public model output proves the JSON syntax.
A strict JSON parser overlay is prepared with bounded hermetic controls and is
not yet deployed. V5chunk512 prefill validation is in progress on the separate
optimization GPU. No8-card resource admission,8-card load test,300/500decode
target or completion of the Rust-native engine is claimed.


### Current topology and131K short load (2026-10-24,20:50 CST)

Fresh cluster identities confirm exactly two separate one-H200 allocations:
GPU117a serves the single V4 replica on node10.102.214.86/pod100.97.136.42;
GPU0349 validates V6b on node10.102.204.31/pod100.97.24.7. VIP10.102.93.68:80
selects only the first replica, target30003. There is no a3s-gateway in the
serving path, no multi-replica load balancing and no Windows forwarding.

Current V4 uses context131072, prefill batches8192 and RAM KV caching8192MiB
with8 conversation slots, but executes only one model request at a time.
Direct Windows/proxies-disabled SSE short pressure testing uses four fixed
public prompts,32/128 output tokens, four warmups and16 measured requests for
each concurrency1/2/4/8. All64 measured requests succeed,6656 completion tokens,
zero observed errors/timeouts. Aggregate API wall throughput is respectively
68.22/69.88/71.52/70.57tok/s; P95 first output0.282/2.414/5.555/17.691seconds;
P95 total duration2.222/3.996/5.910/19.035seconds. Post-load health is200,
loaded=true, context131072. This is not a long-context concurrency/soak test
or isolated single-request decode measurement. Current throughput is lower
than historical4096-context90-92tok/s; causal attribution is still unproven.

The actual bundled WorkBuddy streaming client completes two hi turns in the
same process, first output42.46s then6.77s; latency acceptance and GUI acceptance
remain false. V5chunk512 gives no improvement and is drained. Strict V6b tool
JSON parsing passes CPU controls and is loaded only on the validation GPU.
Real GPU cold35700/side/restore controls pass, but the native tool stream lacks
finish/usage and qualification fails. It is not promoted. No300/500tok/s target
or Rust-native completion is claimed.


### User-requested1M context promotion (2026-10-24)

V7 loads1048576 context and answers short arithmetic but its exact131073-token
public request fails after165.14s: DSpark batch seed captured nothing. The API
reports READY despite this generation failure; health alone is not acceptance.
The engine source explicitly supports STRATA_SERVE_BATCH_TAIL=0, which keeps
DSpark decoding and seeds its tail through the established pass path instead
of the failed batch capture. V8 uses that supported profile with the identical
e943 executable/weights/tokenizer. The exact same131073-token prompt, SHA256
898033b30b21697c88880272596db87b8e6264cedb4697bd4a61a3955adb58ef,
returns42, finish=stop, HTTP200, actual prompt usage131073, first output163.8876s.
The VIP selector is switched with exact UID/resourceVersion gates toGPU0349.
The immediate post-switch health check is unsuccessful; the existing switch is
then re-observed without repeating a mutation. Windows direct health confirms
loaded/max_context1048576 and real arithmetic returns42 in0.344s. Address/key
remain the same; no Windows forwarding is installed. A new bounded server-side
expiry worker binds the new owner/deadline. The old V4 slot is idle before its
exact supervisor is terminated, then API reaping/GPU idle are proven before
GPU117a becomes optimization again. Exactly two physical H200s remain.

The user replaces the500tok/s goal with deep optimization of single-H2001M
context correctness and speed. Full1M-length/long-needle/quality qualification,
current1M throughput comparisons and native tool/WorkBuddy acceptance remain
unproven. These gates are not closed by the over128K smoke test. Serving lease
ends2026-10-24 16:37:50UTC, with guarded server-side cleanup at expiry.
