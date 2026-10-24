# Official 1017 inference through a3s-power on eight H200s

Status: representative end-to-end API checks passed. An exact-usage performance
baseline was measured; acceleration tuning and the original XQ goal remain active.
No 1000 output tokens/s result has been established.

## Runtime and access

```text
Windows HTTP client -> owned SSH local forward -> H200 a3s-power :30102
  -> private loopback recipe :30103 -> existing SGLang :30000 -> eight H200s
```

- Local SSH entry: `http://127.0.0.1:30102/v1`.
- Internal Power endpoint: `http://10.102.213.24:30102/v1`.
- Model alias: `deepseek-v4.1-flash-1017`.
- Existing replica: `deepseek-v4-1-flash-1017-private-24500123-6697f-cfcd2`.
- Node: `gpu-lg-cmc-h-h200-0633.host.h.pjlab.org.cn`.
- Private task directory: `/root/aster-h200-official-20261022`, mode 700.
- API credential: that directory's `api.key`, mode 600. Its value is never
  stored in these reports or this repository.
- Initial normal frontend PIDs: Power 15659, recipe adapter 15658.
- After the batching campaign: Power 16688, recipe adapter 16687;
  private frontend admission is now 32, within the reported upstream limit.
- Windows SSH forward PID 164288 was checked by process identity and reused.

The official snapshot is
`models--deepseek-ai--DeepSeek-V4.1-Flash-1017/snapshots/1bae0e1088993b9b82de08f59de5be5a34e42170`.
All 48 index-referenced shards exist, totaling 510296708312 file bytes against
510286023000 tensor bytes. This is presence/size evidence, not a full checksum
pass over the 510 GB model. The running server's model path matched this snapshot.

Actual SGLang version: `0.0.0.dev1+gda64c5cbb`; TP8/EP8, `dsv4` attention,
`flashinfer_mxfp4` MoE runner, memory fraction 0.7, maximum 32 running requests,
prefill chunk 4096, maximum prefill tokens 8192, strict thinking and Radix cache
enabled. The existing engine remained running throughout this work.

## Completed real checks

Eight checks passed in both the synthetic benchmark configuration and the
restored normal configuration:

1. Anonymous model discovery returns 401.
2. Invalid credentials return 401.
3. Authenticated discovery returns the official model alias.
4. Buffered arithmetic returns exactly 42.
5. Streamed arithmetic returns exactly 117, with finish and terminal events.
6. Automatic tool selection returns `bench_sum` with integers `a=19`, `b=23`.
7. Unsupported forced-function selection returns 400 rather than 500.
8. A client disconnect releases the frontend request; its active gauge returns
   to zero. This does not establish cancellation of an unrelated engine request.

See `qualification-exact-benchmark.json`, `qualification.json` and
`normal-frontend-restoration.log`. These are actual GPU-backed requests through
Power, not health-only checks. The pinned official recipe refuses a forced
function in its default thinking mode; this limitation is retained explicitly.

The SSH jump client also completed a real streamed request with the expected
answer, exact usage and terminal event; see `jump-inference.json`. After normal
redaction was restored, a Windows HTTP client completed the entire SSH-to-H200
chain: expected answer passed, about 187 ms to first output and 406 ms total for
that short example. See `windows-client-inference.json`. This last correctness
check uses privacy-rounded counters and is not a speed benchmark.

## Performance baseline

Three rounds per concurrency, 256 generated tokens per request, through the
Power endpoint, using unrounded usage reported by the upstream:

| Concurrent requests | Median aggregate output tokens/s |
|---|---:|
| 1 | 65.1924 |
| 2 | 89.1453 |
| 4 | 160.1776 |

All nine batches completed. Counts include generated reasoning tokens. See
`benchmark.json` and its matching `benchmark-frontend.json`. The metric divides
the sum of completion tokens by the entire batch wall time; one-request and
aggregate throughput remain distinct. These are measurements on a shared
backend, not an isolated comparison of engine configurations.

The first alternating direct-recipe/Power comparison ended after five successful
requests; the next request did not complete within the 180-second deadline.
The file/log timestamps differ by 179.999 seconds. Its failed request details
were not retained, and its root cause is not established. The incomplete result
remains in `direct-comparison.json` and must not be promoted.

A subsequent instrumented comparison retained every result and completed all
eight requests. It observed median direct-recipe throughput 45.9370 tokens/s and
Power throughput 55.5167 tokens/s. A contemporaneous native load observation
reported another request using 743936 tokens, and latency varied materially
within both arms. The descriptive ratio 1.2085 does not prove acceleration by
Power or isolate proxy overhead. See `direct-comparison-observed.json` and
`observed-comparison-load.jsonl`.

## DeepInfer reference and batching campaign

The current DeepInfer main resolved to revision
`9bd9cf243fc53ef9afbf8f04d391d989117d6ab9`. Eight reference files were read
and hashed; see `deepinfer-reference-manifest.json`. The
[README](https://github.com/deepseek-ai/DeepInfer/blob/9bd9cf243fc53ef9afbf8f04d391d989117d6ab9/README.md)
lists SM100 and Ascend 950 hardware, CUDA 13, and an offline engine. It excludes
the complete KV system and cross-replica service load balancers. H200 reports
SM90; this is not an officially supported direct DeepInfer deployment target.

The [deployment Q&A](https://github.com/deepseek-ai/DeepInfer/blob/9bd9cf243fc53ef9afbf8f04d391d989117d6ab9/doc/inference_deployment_qa.md)
describes shared 3FS KV storage, quota-based prefill scheduling, a decode load
balancer considering request count and KV length, EPLB, DSpark verification and
bounded SWA replay. Its shared-cache prefill routing does not use prefix affinity.
Gateway's previously deployed bounded prefix hints and measured-work routing
are adaptations for another fleet. This new private H200 path does not traverse
that Gateway, so those changes are not evidence of H200 acceleration.

The safe H200 capability inspection in `deepinfer-h200-capabilities.json` found
Radix cache, CUDA graphs and scheduling overlap enabled. Speculation, EPLB and
DP attention were disabled. The upstream supports 32 running requests, while
our initial Power frontend admitted only four. The native model and engine
configuration were not restarted or changed to test batching.

The owned frontend was temporarily started with exact synthetic accounting and
32 slots. Three rounds at each of five concurrencies completed, totaling 183
successful requests of 256 generated tokens each:

| Concurrent requests | Median aggregate output tokens/s | Median TTFT, ms |
|---|---:|---:|
| 1 | 65.1760 | 176.8 |
| 4 | 160.3178 | 437.8 |
| 8 | 235.0647 | 712.7 |
| 16 | 316.4108 | 978.7 |
| 32 | 382.8811 | 1713.4 |

See `deepinfer-batching/benchmark.json` and `campaign.json`. The observed
32-request aggregate is about 2.39 times the four-request aggregate in this
campaign. This compares offered batch sizes and frontend admission; it is not
a matched-workload causal estimate of a Power kernel speedup. Aggregate
throughput must not be described as one user's generation speed. No 1000
tokens/s result is established.

Higher offered concurrency increased both aggregate throughput and latency.
The 32-request result is a capacity setting for the requested throughput goal,
not proof that each client became faster.

The selected private admission is 32. Normal redaction was restored and the
eight real API checks passed in both modes. The campaign always attempts
restoration in `finally`; a synthetic-failure regression verifies restoration
of the original admission. Eleven operator tests passed on H200; Windows
passed nine and skipped the two Linux socket tests. The artifact manifest
binds the tested operator source and fourteen retained remote artifacts.

A Windows follow-up after batching failed while reading the task credential
over a new jump connection, before sending inference. Its safe failure stage
is retained in `deepinfer-batching/windows-followup-observation.json`. The
earlier successful Windows inference is preserved, but no new Windows inference
pass is claimed for the 32-slot restoration. Windows access to the forwarded
health and metrics endpoints subsequently returned healthy, active limit 32,
zero active and zero waiting requests. No service was restarted because of
this client observation failure.

Direct DeepInfer kernels remain unsupported on the reported H200 target.
MTP/DSpark, EPLB, alternative attention parallelism and prefill budgets still
need supported H200 engine configurations and a separate allocation for
controlled comparisons. The current shared engine is not evidence that these
features have been enabled or verified.

## Fixes and software evidence

- The proxy formerly stopped on `finish_reason`, before the trailing usage
  event, and chat presentation counted SSE chunks. It now requests upstream
  usage, preserves the trailing event, validates nonnegative u64 counts and
  their total, and selects authoritative accounting for proxy chat. Missing
  usage is not converted into a fabricated chunk count.
- Upstream 400/422 refusals are classified as client errors; chat returns 400.
- The loopback adapter retains the pinned official recipe, supplies its own
  internal auth only to loopback callers, and reads the existing SGLang key on
  the server. It keeps streaming incremental. Public recipe SHA-256:
  `ad69210e9c5be88aec4bede3ad3b91906dbc8c9dbc44bf12c1673c58b9584ccd`.
- A real upgrade exposed a TIME_WAIT false refusal in the port precheck. The
  check now uses Linux listener reuse semantics while still refusing a live
  listener. Both conditions have small real-socket regression tests.
- The tested and deployed release binary SHA-256 is
  `0076e2a46734b54a51c6aea7b3e56dedb5326c3ed4b32b0f0ead919122c45d76`.
  It was linked against the H200 glibc 2.35 sysroot; its highest observed GLIBC
  requirement is 2.34. `--version` and inference ran in the actual H200 container.
- Rust 1.97.1 focused checks passed: proxy 65, OpenAI chat 78, Runtime service 3
  (146 total). Seven operator tests passed on the H200 container. Tests are
  evidence for these boundaries, not a replacement for real inference.
- The isolated Power worktree is based on
  `f2c66358b38b1cbabcfc0bd153d756724d671a0a`. Build-only dependency adaptation
  selects local ACL 0.3.0 and Runtime 0.8.0 and initializes the Runtime's new
  network-policy fields with their existing default posture. Optional llama
  bindings use the existing pinned `dfd12e4` source cache. The portable proxy
  patch and `power-build-provenance.json` retain the serving change separately.
- `cargo fmt --all -- --check` was attempted and reports formatting in the
  pre-existing optional llama source cache. The Power package-only formatting
  check passed. Those cached third-party files were not rewritten.
- A concurrent parent-repository release merge changed the parent HEAD and
  removed this untracked evidence directory. Results were recovered from the
  task's remote logs. The parent reported an unrelated `AA crates/power`
  gitlink conflict; this work preserves that merge state.

Power's normal privacy mode rounds token counts. Exact synthetic benchmark mode
was used only for measurement. Normal log redaction was restored afterward and
all eight real checks passed again. The benchmark helper refuses rounded counts.

## Reproduction and remaining work

On the H200 replica, the normal frontend is managed with:

```sh
python3 /root/aster-h200-official-20261022/operator/h200_official/validate.py check
python3 /root/aster-h200-official-20261022/operator/h200_official/validate.py stop
python3 /root/aster-h200-official-20261022/operator/h200_official/validate.py start
```

Only an explicit `start --exact-benchmark-usage` permits the synthetic benchmark;
stop the owned frontend before changing modes, then restore ordinary `start`.
The existing engine is not stopped by this operator. Comparison scripts and
results remain in the private task directory and copied public task logs.

The original IndrasMirror XQ download and deferred deployment continue separately.
The new proxy binary and exact-benchmark/normal-mode lifecycle still need to be
synchronized into that pipeline before its performance campaign is used. Its
current installer remains pinned to the older binary; the original goal is not
redefined around this official-model validation. Further engine tuning needs a
separate eight-H200 allocation and verified comparisons of supported parameters.

The public cache inventory contains 406 model directories and 543 snapshots;
presence, missing-shard and inspection-error states are recorded in
`shared-weight-inventory.csv`. A directory entry is not proof of usable weights.

At 2026-10-22 14:16:54 CST, the XQ main download had transferred
56648756739 / 162954903552 bytes (34.7635%), including 2424794627 bytes still
in flight and unverified. Zero of sixteen full main parts had been published.
The 5661492320-byte MTP sidecar was published. The main downloader and deferred
launcher were live with their previously recorded process start times, and no
XQ deployment submission existed. The preceding 2674.54-second observation
averaged 928470.51 bytes/s, implying roughly 32 remaining hours if maintained;
this is an estimate, not a completion promise. See `download-progress-latest.json`.

## Explicitly not claimed

- No 1000 output tokens/s result or maximal hardware throughput is established.
- No proxy speedup is inferred from the confounded direct comparison.
- The first comparison timeout has no proven root-cause attribution.
- The eight API checks do not prove every parameter, client, modality or context.
- There is no independent official-model eight-H200 tuning deployment yet.
- No full checkpoint hash or TEE attestation of remote inference is claimed.
- No XQ generation has completed; the original XQ optimization goal remains active.
- No credentials or user session state are stored in this evidence directory.
