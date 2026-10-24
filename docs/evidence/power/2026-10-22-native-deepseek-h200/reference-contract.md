# Tiny reference and frozen comparison contract (T003)

The CPU reference is a bounded mathematical oracle, never a fallback for a
native CUDA request. It does not advertise full DeepSeek execution.

Freeze before reference implementation:

- Each fixture has at most 4,096 finite scalar elements, positive dimensions,
  checked products and exact payload lengths. Reject malformed shapes,
  non-finite inputs, invalid parameters and non-finite intermediate results.
- Scalar FP8 E4M3, FP4 E2M1 and UE8M0 decoding must exactly match representable
  binary values, including signed zero. Reject reserved NaN encodings. UE8M0
  byte zero denotes `2^-127`, not floating zero. These decoders alone do not
  specify tensor packing order, quantization blocks or runtime GEMM layout.
- F64 linear, RMSNorm, activation, softmax and gate fixtures use
  `absolute_error <= 1e-12 + 1e-12 * abs(expected)` against independently
  calculated constants. Expert IDs, output dimensions and refusal conditions
  require exact equality.
- Routing ranks by `sqrt(softplus(logit)) + correction_bias`, takes stable
  descending top-k (lower logical ID wins ties), and normalizes the selected
  **unbiased** scores with denominator `sum + 1e-20`, then scales by 1.5.
  The model caller must explicitly select text versus image bias.
- SwiGLU clamps the gate only above the positive limit; the value is clamped
  on both sides. Negative gate values must not be symmetrically clipped.
  RMSNorm accepts effective norm weights; exp-norm conversion belongs to the
  exact model weight schema.

Independent constants were calculated with Python 3.12 `decimal` at precision
80 (ordinary real arithmetic, not a second invocation of the Rust candidate):

| Fixture | Inputs | Expected |
|---|---|---|
| RMSNorm | x=[1,2,3], effective weights=[0.5,1,2], eps=0.25 | [0.22549380840084865,0.9019752336033946,2.705925700810184] |
| Gate correction changes selection | logits=[-2,0,2], bias=[3,0,0], k=2, scale=1.5 | IDs=[0,2], weights=[0.2944914208404129,1.2055085791595872] |
| Very small gate scores | logits=[-100,-100], zero bias, k=2, scale=1.5 | each weight=0.027856676507872002 |
| Asymmetric clipped SwiGLU | gate=[-20,20,2], value=[-50,20,3], limit=10 | [4.122307236380407e-7,99.99546021312976,5.284782467867295] |

Provenance:
[OCP MX 1.0, sections 5.3.1/5.3.3/5.4.1](https://www.opencompute.org/documents/ocp-microscaling-formats-mx-v1-0-spec-final-pdf),
[TileKernels routing reference](https://github.com/deepseek-ai/TileKernels/blob/c1cf914a82e6901c679445f872051ce44ac2cc63/tile_kernels/torch/topk.py),
[TileKernels activation reference](https://github.com/deepseek-ai/TileKernels/blob/c1cf914a82e6901c679445f872051ce44ac2cc63/tile_kernels/torch/swiglu.py).
Reference input hashes are in `tilekernels-reference-manifest.json`.

The C1/C2 state oracle now retains complete bounded history and emits only
completed blocks. All 32 chunk partitions of a six-token fixture produce
the same state and emissions as one-shot prefill. Every accepted prefix is
compared with fresh computation; partial rejection removes future blocks
while preserving the pending score/latent row. This is a mathematical state
oracle, not the native cache layout or proof that all model states roll back.

The official reference service subsequently scored six fixed public inputs
three times (18 requests, 357 input rows, zero generated tokens). Exact input
IDs, selected target logprobs and top-five probabilities are retained in
`reference-logprob-calibration-1792662925.json`. Across these API observations,
113 scored positions per round repeated exactly; 104 positions have a top-two
margin of at least 0.1 nats. Cache reuse was not controlled, so this does not
prove independent recomputation or kernel batch invariance.

`qualification-budget-v1.json` freezes tiny and same-official-model comparison
ceilings before any native candidate runs: target-logprob maximum 0.05 nats,
RMS 0.01 nats, and no top-one changes at those 104 stable-margin positions.
Layer ceilings and all-required-checks task quality are engineering acceptance
policies, not measured native accuracy. Missing reference activations refuse
operator qualification; full native quality, layer captures, long-context
state, actual GPU cancellation and calibration checks remain mandatory in
T007–T024. No capacity or performance claim follows from the smoke corpus.
