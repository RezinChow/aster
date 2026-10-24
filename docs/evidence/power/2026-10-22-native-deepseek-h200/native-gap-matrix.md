# Native DeepSeek capability audit

Observed 2026-10-22. This is a source and public checkpoint-schema audit,
not an H200 execution qualification. No shared service was changed.

## Identities and limits of observation

- Power source: `f2c66358b38b1cbabcfc0bd153d756724d671a0a`, with retained
  serving edits and the workspace integration in progress. A source revision
  does not identify the dirty working tree or a GPU binary.
- Official checkpoint: `deepseek-ai/DeepSeek-V4.1-Flash-1017`, revision
  `1bae0e1088993b9b82de08f59de5be5a34e42170`. Downloaded public config,
  tokenizer config and index hashes are in `official-model-audit.json`.
  A subsequent read-only inspection on H200 verified all 48 shard headers
  against the index; its hashes and byte/dtype totals are retained in
  `remote-official-headers.json`. Tensor payloads and whole-shard hashes
  have not been verified here.
- DeepInfer model reference: revision
  `9bd9cf243fc53ef9afbf8f04d391d989117d6ab9`; seven model files and their
  hashes are in `deepinfer-model-reference-manifest.json`. These are reference
  inputs, not imported production code or evidence that its kernels ran.
- The local `cargo check --offline -p a3s-deepseek` passed during minimal
  workspace integration. The model crate then contained documentation only.
  This proves neither model support nor CUDA compilation. Adding vendored
  dependency test members subsequently requires further lock resolution.
- The earlier H200 Power binary in the official evidence directory is a
  `server` build serving through recipe/SGLang. It is not a native control.

## Checkpoint requirements

The exact config declares `DeepseekV41ForCausalLM` / `deepseek_v41` and
`deepseek_v41_text`, with 40 text layers, hidden width 5120, 64 query heads,
one KV head, head width 512, RoPE width 64, and sliding window 128. Routing
uses 384 logical experts, top 6, one shared expert, `sqrtsoftplus`,
`noaux_tc`, normalized selected scores and routed scale 1.5. The router
projection is BF16 and the correction bias is FP32 in the reference model.

Quantization declares FP8 dynamic activations, 32-by-32 weight blocks,
UE8M0 scales and FP4 expert weights. Decoder semantics additionally include
compressed/reused KV and index states, CED/Engram, mHC, and three DSpark
NextN modules. Image routing uses a separate correction bias; the vision
encoder and aligner are independent required capabilities for image inputs.
The tokenizer config alone is insufficient to implement prompt encoding.

The index maps **96,085 tensors to 48 shards**, with
`metadata.total_size = 510286023000` tensor bytes. Header inspection found
the same total, the same 96,085 keys and no trailing data in any shard.
This is not an estimate of device allocations or a full payload check.
The adjacent deployment note reports a different file-total figure; neither
figure proves that the complete runtime layout fits a particular HBM budget.

| Header storage dtype | Tensor count | Payload bytes |
|---|---:|---:|
| BF16 | 520 | 3,952,883,712 |
| F32 | 387 | 169,229,128 |
| F8_E8M0 | 47,589 | 23,563,015,184 |
| F8_E4M3 | 357 | 204,015,223,296 |
| I8 | 47,232 | 278,585,671,680 |

For example, `layers.0.ffn.experts.0.w1.weight` is physically I8 with shape
`[2304,2560]`; config and the model loader define its packed FP4 meaning.
Do not treat a packed container's signed byte dtype as an INT8 GEMM schema.
Power's current safetensors 0.7 metadata supports both FP8 dtype tags, and
raw range reads can preserve those bytes; actual native quantized execution
remains unimplemented in the model owner.

The read-only device query at Unix time `1792659658.4896245` observed eight
H200 SM90 GPUs, each reporting 143,771 MiB total and 122,188–122,668 MiB
used. The node hosts the reference service and is not a free native test
allocation. This observation authorizes no shared-service restart or GPU
allocation claim.

## Gap matrix

Paths below are relative to `crates/power/src` unless otherwise stated.
“Present” identifies a source mechanism, not an H200 proof.

| Capability | Present source mechanism | Missing model implementation or proof | Producing tasks |
|---|---|---|---|
| Embedded execution | `inference/runtime.rs`, `accelerator/`, Candle device integration | Exact V4.1 model dispatch and full token loop; `crates/deepseek/src/lib.rs` currently advertises none | T005, T007–010 |
| Public tensor boundary | `inference/tensor.rs` validates owned F32 tensors; `graph/plan.rs` owns a finite static graph | Typed quantized execution must preserve the existing F32 API rather than changing its semantics | T006, T008 |
| Weight storage | Power raw/range reads plus model-owned pinned index/LFS hashes and BF16/F32/dense-FP8/Engram-FP8/packed-FP4 descriptors | Full layer parameter binding, real checkpoint payload verification and qualified device upload | T002, T006–009 |
| Dense/math kernels | Existing generic graph and model-owned accelerator injection | SM90 FP8/MXFP4 kernel and ABI qualification, scale/layout conversion, scratch accounting and numerical comparison | T003, T008 |
| Model layers | Model owner has shifted mHC, sparse Power-range Engram FP8 lookup/projection/gate, FP32-logit routing, effective RMSNorm, explicit-cache RoPE, transactional compression/main/window/index KV, exact codecs/topology, atomic selected-state commit, raw device matrices/FP8 casts, full single-device MoE and shifted FFN half, index Q/K and main compressor, complete Q/SWA/grouped Wv/Wo attention and shifted attention half; 263 CPU tests | Full official parameter/layer/model binding, exact FP32 RoPE frequency/cache construction, runtime cross-layer KV/index/candidate sharing, complete model-state registration, optimized low-precision kernels; CUDA/GPU/vision qualification | T007–009 |
| Expert routing | Model-owned BF16 gate/FP32 logits, stable score selection, weighted SwiGLU, actual packed-row dispatch and shared-first F32 combination on a single device | Grouped low-precision GEMM, qualified GPU execution, actual multi-rank collectives/reduction profiles | T007–008, T013 |
| Placement/residency | `inference/residency/` owns pinning, bounded prefetch, route history and tiers | Quantized model-owned device handles, full peak budget, measured HBM/Engram placement and no unnecessary per-token host reload | T011 |
| Multi-device execution | `accelerator/mesh_execution.rs` validates directed transfer declarations and records bounded tensor transfers | Actual eight-card model placement, peer-copy profiling, TP/EP all-reduce/all-to-all and rank failure recovery | T009, T012 |
| Expert balancing | Route-history and hottest-expert observations | Atomic logical-to-physical expert map epochs, redundant byte budgets and measured replica copying/benefit | T013 |
| Graph reuse | `inference/shape_profile.rs` provides finite shape/identity selection | V4.1 CUDA graph bindings and trace evidence for launch/fusion improvements | T014 |
| Continuous batch | `inference/execution_batch/` owns membership and atomic lifecycle | Model KV slots, ragged per-row state, actual batched GPU kernels and correct join/cancel/finish | T015 |
| Cost-based scheduling | `inference/execution_cost/`, tuning contracts | Valid H200/model/kernel-bound prefill cost curve, fairness and measured overlap | T016–017 |
| Prefix reuse | Existing serving/cache ownership boundaries | Exact V4.1 recurrent/index/Engram/KV snapshot and isolation; one EP group is not eight complete replicas | T018 |
| SWA replay | No qualified V4.1 replay in the new model owner | Complete state/replay proof, window plus backtracking bound, separate quality profile and full-prefill control | T019 |
| DSpark | Generic speculative backend contracts exist elsewhere | Exact V4.1 draft/target binding, verification, sampling and complete rollback across all ranks | T020–021 |
| User service | `backend/mod.rs` registry, OpenAI service and proxy usage fixes | Native composition, real incremental text/tool output, exact counts, actual GPU cancellation and limited credentials | T010, T024, T026 |
| XQ | Download verified by original downloader; bounded codecs/header and Power-authenticated storage; exact expert partitions and packed CUDA controls; F32 text/mHC/MoE, activation/RoPE/attention/compressor/indexer and Engram components; separate immutable config/architecture, all 53 F32 request participants, complete shifted attention half and callable source/consumer decoder-layer pipeline with cancellation/rollback and aggregate admission; Windows/Linux builds and CPU suites pass | Actual H200 qualification, real full-payload native open, giant Engram table placement, verified peer cache/trunk transfers and the full 40-layer model/token loop/backend/service, efficient kernels, eight-card optimization/stress and draft compatibility | T004, T009, T010, T022 |

## Optimization order implied by the audit

1. Close root workspace/build integration, reference fixtures and exact schema.
2. Implement the complete native model with cache reuse, replay and DSpark off.
   A capacity-first layer split is acceptable before efficient collectives.
3. Keep weights and state resident where the measured full peak budget allows;
   then profile real eight-card TP/EP, expert batching and load balancing.
4. Add real continuous batch, calibrated prefill chunks and measured scheduling/
   compute/communication overlap.
5. Add precise KV reuse, then separately qualify bounded replay and DSpark.
6. Qualify XQ independently; compare native profiles under matched inputs and
   workload, validate rollback, and only then deliver the user endpoint/key.

The first missing item on the critical path is full model semantics and
low-precision native execution, not a gateway affinity parameter. DeepInfer's
public release explicitly leaves the serving KV system and cross-replica
load balancing to the service owner. Its replay, scheduling and speculative
ideas remain useful without treating its SM100 kernels as H200 binaries.

Primary references:
[DeepInfer README](https://github.com/deepseek-ai/DeepInfer/blob/9bd9cf243fc53ef9afbf8f04d391d989117d6ab9/README.md),
[MoE parameters](https://github.com/deepseek-ai/DeepInfer/blob/9bd9cf243fc53ef9afbf8f04d391d989117d6ab9/deepinfer/model_executor/models/v4_modules/moe.py),
[MoE execution](https://github.com/deepseek-ai/DeepInfer/blob/9bd9cf243fc53ef9afbf8f04d391d989117d6ab9/deepinfer/model_executor/models/v4_modules/mlp.py),
[official configuration](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017/blob/1bae0e1088993b9b82de08f59de5be5a34e42170/config.json).
