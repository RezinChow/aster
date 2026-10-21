# WorkBuddy long-context stream failure

Later follow-up: [replay metadata compatibility](../2026-10-21-workbuddy-replay-metadata/OUTCOME.md)
replaces the Power wrapper binary to accept additional observed v5.8.3 history
fields. It preserves the native process identities and context capacity proved
in this record. The Power hashes below identify this earlier context correction.

The reported `Inference failed: prism upstream stream returned 400 Bad Request`
was investigated against the live GPU deployment. Native Prism logs in the
incident window record requests of **33338, 33785, and 50184 tokens** rejected
because each native slot admitted only **32768 tokens**. The earlier WorkBuddy
protocol acceptance used short prompts and did not prove this workload would fit.

All eight native replicas now expose **131072 context tokens per slot**, retaining
two slots per GPU. Long annotated requests pass through the production Gateway,
including a public streaming tool call and a second request returning its result.

## Evidence for the cause

[incident-context-errors.json](incident-context-errors.json) preserves only native
unit identities, event timestamps, requested token counts, and the context bound.
It contains no user prompt or conversation. The native incident events were read
with `journalctl -u 'prism-27b@*'` for 10:30–10:37 UTC on 2026-10-21.

[baseline-overflow.json](baseline-overflow.json) is an independent synthetic
counterexample on an unchanged 32K replica: a tool-history prompt tokenized to
55418 tokens, and native HTTP 400 returned `exceed_context_size_error`,
`n_prompt_tokens: 55418`, and `n_ctx: 32768`. No real user request was captured or
replayed, so these records establish the observed failure mode rather than an
exact replay identified by a client request ID.

## Deployed correction

The active native command used `-c 65536 --parallel 2`; the total context was
split into two 32768-token slots. Merely reading `/etc/a3s/prism-27b.sh` would
have missed the active systemd override. The model's startup metadata reports
`n_ctx_train = 262144`.

[rollout_context.py](rollout_context.py) added the persistent per-instance
`92-workbuddy-context-20261021.conf` override, changing total context to 262144
and retaining `--parallel 2`. It uses the exact existing process arguments for
everything else. The native executable, model weights, FP16 KV cache precision,
Power binary, authentication, Gateway routes, and ACL files were not changed.
Each native replica was observed idle before restart, then checked through its
own `/props` endpoint and GPU memory query. This was an observed idle window,
not a transactional Gateway drain.

- [rollout-canary.json](rollout-canary.json): GPU 7 promoted first.
- [rollout-remaining.json](rollout-remaining.json): GPUs 0–6 promoted after the
  canary long-context tests passed.
- [context-audit.json](context-audit.json): first all-eight verification.
- [final-audit.json](final-audit.json): final verification after live tests; all
  native and Power services active and enabled, matching running executables,
  each native `/props` reporting 131072 context tokens and two slots.

The previous 90-series native overrides remain in place. Rollback consists of
removing only the new 92-series override for the affected instance, reloading
systemd, and restarting that native unit. It restores the previous 32K slot
limit. The separate WorkBuddy message compatibility release is retained.

## Validation

[qualify_long_context.py](qualify_long_context.py) generates bounded synthetic
reference data and a complete assistant/tool history. Gateway requests carry
`agent`, `conversationRequestId`, and `startsNewUserRequest` annotations. Successful
checks require complete SSE, `[DONE]`, the expected finish reason and answer,
absence of stream errors, and reported prompt usage at or above the target size.
No history truncation is performed. Actual usage, rather than a byte estimate,
proves the long prompt reached inference.

| Evidence | Result |
| --- | --- |
| [canary-120k.json](canary-120k.json) | Native canary processes 120417 prompt tokens and returns `READY` |
| [canary-two-60k.json](canary-two-60k.json) | Both native requests pass, using 60423 and 60424 prompt tokens and returning `ALPHA`/`BETA`; native active count reaches two |
| [private-120k.json](private-120k.json) | Gateway → Power → Prism processes 120417 prompt tokens and returns a complete `READY` stream |
| [public-55k-tools.json](public-55k-tools.json) | Public production endpoint emits the correct streamed `bench_sum(19,23)` call at 55430 prompt tokens; replaying the assistant call with null content and the tool result returns `42` at 55237 prompt tokens |
| [public-protocol-regression.json](public-protocol-regression.json) | Existing WorkBuddy protocol suite rerun: 13/13 pass, including text/tool SSE, null and omitted assistant content, unknown field refusal, and missing-credential refusal |

The public follow-up omits the now-unneeded tool definition, explaining its
slightly smaller prompt count despite additional messages. The synthetic
reference text is retained unchanged. The initial native 120K and dual-60K jobs
overlapped on the canary; their timings include contention/queuing and are not a
throughput or latency benchmark. The separate Gateway 120K request completed in
97.533 seconds. The public tool call and result took 27.750 and 26.860 seconds.

Representative commands, run against existing artifacts:

```sh
python rollout_context.py --indices 7 --record rollout-canary.json
python qualify_long_context.py --index 0 --tokens 55000 --expect-overflow --output baseline-overflow.json
python qualify_long_context.py --index 7 --tokens 120000 --output canary-120k.json
python qualify_long_context.py --index 7 --tokens 60000 --parallel 2 --output canary-two-60k.json
python rollout_context.py --indices 0 1 2 3 4 5 6 --record rollout-remaining.json
python qualify_long_context.py --gateway --tokens 120000 --repeat 10914 --output private-120k.json
python qualify_long_context.py --public --tokens 55000 --repeat 5005 --exercise-tools --output public-55k-tools.json
python audit_context.py
```

Rollout commands require root on the GPU server. Native checks run there on
loopback. The public check ran from the Windows workstation through the real
public endpoint; credentials stayed in memory. No new Rust source was changed
or binary rebuilt in this correction, so the earlier 1953-test library result
is referenced as prior binary evidence, not a newly run configuration test.
The scripts and evidence remain uncommitted in the existing Aster worktree.

## Explicitly not claimed

- No WorkBuddy GUI or private conversation replay was performed. The live proof
  is long synthetic traffic matching the observed annotations and tool history.
- 131072 is a finite per-request context budget; prompt and generated tokens
  must fit it. Inputs beyond that budget remain unsupported. Power's generic
  stream error wrapping for native overflows was not changed by this capacity
  correction.
- This is not a 16-way load test or a promise of short first-token latency at
  120K. Long prefill increases latency. The eight replicas retain 16 configured
  slots in aggregate.
- GPU free memory was about 1292–1324 MiB in the recorded audits. Additional
  GPU-resident models or workloads were not admitted or qualified in that margin.
- Model weights, quantization, speculative decoding, other platform models, and
  unrelated repository formatting were not changed or newly qualified here.
