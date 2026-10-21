# Cache feedback and cost-aware serving

Created: 2026-10-21. Branch: existing isolated serving worktree; no commit requested.

Input: 用户要求把当前硬件和 Prism 后端能做的优化全部落实。

Gate: Gateway scheduling and the existing, user-authorized eight-GPU deployment.
This extends the completed 005 campaign and the deployed prefix-affinity slice.

## Scenarios and requirements

1. A failed, truncated or cancelled response must never create a warm-prefix
   observation. Test fragmented JSON/SSE, tool-only completion, error frames,
   missing finish/DONE, over-budget frames and downstream drop in Gateway.
2. Eligible replicas should be compared using measured uncached prefill and
   decode cost plus outstanding work. Estimates are routing hints, never token
   accounting or a tokenizer authority. Preserve grant, health, protocol,
   priority, finite admission, and the existing one-operation locality band.
3. Successful authoritative upstream timings may update bounded, expiring
   performance estimates. Reject inconsistent, nonfinite or missing values;
   client replay usage never trains the model. A reported cache miss invalidates
   older locality observations for that execution signature.
4. Reserve estimated work before upstream dispatch; release it on fallback,
   error, timeout, EOF and cancellation. Never leave a detached observer task.
5. Evaluate native batching/prefill settings with identical model, sampling,
   FP16 cache and 131072 context per sequence. Promote only repeatable gains
   with correct tool/text output and cancellation/overload recovery. Preserve
   prior slot/speculation/executor investigations and failures from 005.
6. Record the capability boundary for real KV occupancy/epoch, token-exact
   admission, P/D transfer, DSpark/model kernels, and CPU/GPU overlap. Do not
   advertise capabilities unavailable in the current backend protocol.

Success: owner tests, retained matched runtime observations, guarded rollout
and rollback, and a complete capability/decision matrix in
`docs/evidence/gateway/2026-10-21-cost-scheduling/OUTCOME.md`.

## Clarification decisions

No missing user preference blocks implementation. Existing authorization covers
the original server, reversible canaries and deployment. Quality, context,
isolation and admission bounds take precedence over a faster benchmark.

## Explicitly not claimed

Full DeepInfer algorithm compatibility, engine KV residency attestations,
cross-replica KV transfer, exact gateway tokenization, general speculative gains,
or fixes to unrelated workspace failures.
