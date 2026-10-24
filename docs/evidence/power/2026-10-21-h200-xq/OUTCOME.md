# Remote H200 XQ deployment and throughput tuning

Status: in progress. No successful XQ generation or throughput result is claimed yet.

## Objective

Deploy `IndrasMirror/DeepSeek-V4.1-Flash-1017-XQ-Uncensored` through a3s-power
on eight remote H200 GPUs, using the supplied PJLab SSH entry and the local
`../rjob/rjob/sglang-h200.md` operational reference. Optimize toward 1000 output
tokens/s where attainable. Report single-request decode and aggregate output
throughput separately; prefill throughput is a separate metric.

## Validation placement and identities

The validation GPU RJob was stopped at 2026-10-22 00:38 CST while model staging
continues. Its IP below is historical; no inference endpoint is currently ready.

- SSH entry: `yangchao-dev.yangchao.ailab-hrprdduanyan.ws@h.pjlab.org.cn`.
- Namespace: `ailab-hrprdduanyan`.
- GPU quota group: `hrprda3s_gpu_pool`.
- RJob: `a3s-power-xq-h200-20261021-11612728`.
- Replica: `a3s-power-xq-h200-20261021-11612728-cfcd2`.
- Node: `gpu-l-lg-cmc-h-h200-0302.host.h.pjlab.org.cn`.
- Pod IP: `10.102.98.42`.
- Resources: eight H200s, 160 CPUs, 1802240 MiB host memory.
- GPU inventory: eight `NVIDIA H200`, 143771 MiB each; CUDA compute capability 9.0.
- Deployment root: `/nvme/a3s-power-xq-20261021` (host NVMe mounted explicitly).
- Staging root: `/mnt/shared-storage-user/yangchao/Workspace/aster-h200-xq`.
- Model revision: `9d3c01d86709261e51d566b02e1dda75f40d009a`, V3.
- Joined-model expected SHA-256:
  `73df1934302f867601dd27f7fca59109d9b11674f50cc60526ec2a1cd4f3d389`.
- Xolotl revision: `b3452666e07a6374d06bb8c2185dffa271e8f65f`.
- Xolotl source archive SHA-256:
  `faf35a4a783a6f95f8bafa39c4004d3b97dce93b4b36c5128c9663531005eadc`.
- Xolotl's patched ggml base: llama.cpp `3cf03257f219afbe7334045ff7c6a06ac68c627d`.
- Power source: `669e6bd5acf33f49138c4559ef015da74e524b91`.
- First Power Linux binary built with Rust 1.97.1, server feature, release profile:
  `c852ed1955e5645dee83e87c05341d9e3cf6d75b2b8ba2108e68848c6a013ac7`.
  Rejected by the actual GPU container: weak pidfd references were version-bound
  to GLIBC_2.39 on the build host; the GPU image has glibc 2.35.
- Replacement Power binary, linked against the GPU image's glibc 2.35 sysroot:
  `62c33ee45f97a62fe5b39571294b9b6dbb645754b04faba53aab4e4ba1a81e63`.
  `objdump -T` reports no GLIBC_2.36-or-newer references; `--version` runs in
  the existing glibc 2.35 ClickHouse image with networking disabled. Transferred
  to the actual GPU container, verified the binary SHA-256 again, and passed
  authenticated frontend checks there.
- Target sysroot archive SHA-256:
  `9dff98b8a4bb9665e308e96efa30453b892e21f3aceb01ee068095978a9b5cac`.
- Optional 1017 Q2_K DSpark sidecar (5661492320 bytes), pinned repository LFS
  SHA-256: `5f92242e2ebed06e6831bbcae4e35e679c9138cdf6df0c8b36e8013c99c79a34`.
- H200 `sm_90` engine binary SHA-256:
  `95c50615e46c376c325d2ae4518c660943e520cc12eea250caee026c5593fb79`.
- Preserved validation engine archive (99072745 bytes) in shared storage:
  `c5574540f36a37deef52ec4f72acca894b738f97f72dfac2bef37c6becfb3c95`.
- Extracted Engram L1 (101377628584 bytes):
  `5cc4ca3be6302a50597684d234dd47ae7ff7b3a5b42d386515b58f4ecd17662b`.
- Extracted Engram L14 (101380404328 bytes):
  `35c6bb1c15139a691d530c4ea469d1983031074c1a84b4e7f7668fef2015b68b`.

## Completed checks

- Created a separate GPU task. Existing serving RJobs were not stopped.
- Verified local NVMe availability (about 3.4 TiB free at creation), CUDA 12.6,
  CMake 3.30.2, and required Python packages inside the GPU replica.
- Extracted the two Engram tables from the existing official 1017 snapshot to
  local NVMe. Upstream extraction verified 2000 random rows per tensor.
- Built a3s-power on the existing Linux build host, using an isolated worktree.
  `cargo build --locked --release --no-default-features --features server` passed.
- `cargo test --locked --no-default-features --features server --lib backend::proxy`:
  62 passed, 0 failed.
- Decompressed Power on the actual H200 replica and verified its pinned binary
  SHA-256 before activation.
- Built the CUDA engine on that replica: Release, CUDA 12.6, architecture 90,
  patched ggml, FQ_OP and HC_MIX enabled. The image lacks static cuBLAS archives;
  an explicit build-only option selects shared CUDA dependencies. Upstream's
  default static-link setting is preserved when the option is not supplied.
- Operator helper tests: 48 passed in one combined run, 0 failed on the jump
  host. Eighteen cover fetch integrity/resumption, network recovery and CDN reuse, two cover download destination
  boundaries, eight cover activation/process ownership/batch/readiness gates, three
  cover benchmark accounting, four cover sparse-file progress accounting, and
  three prevent early/duplicate GPU reservation, and three cover separate winner
  qualification and reject incomplete long-context benchmark runs. Two check
  private download credentials and prevent sending them to unrelated proxies.
  Five check nonweight preparation, corruption refusal, and replacement of a
  previously successful readiness report after a failed check.
- Three additional Windows Node proxy checks passed: anonymous access is
  rejected, invalid passwords are rejected, and authenticated clients cannot
  connect to an unlisted destination. They use synthetic credentials.
- The H200 bootstrap waits for all parts and requires the pinned joined-model
  SHA-256 before activation. A partial download cannot open the inference API.
- Actual H200 Power frontend smoke: health/startup passed, unauthenticated
  `/v1/models` returned 401, and the authenticated request returned the configured
  model alias. The temporary loopback test listener was stopped afterward.
  This check explicitly records `inference_tested: false`.
- Corrected operator config generation to store SHA-256 of the API token.
  Power interprets a 64-character hexadecimal configured value as an existing
  hash, so storing the raw 64-hex token incorrectly refused valid requests.
- The upstream Python server's CLI imports successfully on the H200 image.
  The C++ engine loads its dynamic libraries and rejects unsupported `--help`
  with its documented argument-error status; this is not a model-load check.

## Work in progress

- Pinned V3 weights are downloading with resumable ranges and per-part SHA-256.
- Direct Internet access from the jump host and GPU nodes is unavailable.
  The SSH server exposes reverse listeners on wildcard addresses despite an
  explicit loopback request. The replacement task listeners therefore require
  authentication and restrict destinations; see the socket audit below.
- The pinned ggml subtree is complete: 1376 files verified by Git blob identity.
- Native `hf_xet` 1.7.0 was tried through a loopback-only CONNECT adapter. It
  published no bytes to its incomplete model file in the observed test and
  reduced adaptive concurrency to four. The test process was stopped; no
  claim that this transport improves the constrained network is made.
- The HTTP range downloader now handles eight model parts concurrently, with
  sixteen ranges per part. The DSpark sidecar downloads separately.
- CPU idle download helpers could not schedule and have all been stopped.
  The authenticated project quota API confirms three GPU workload groups,
  a CPU workspace group, and a system group; there is no CPU workload group.
- The deferred launcher waits on the jump host without reserving GPUs. Once
  all 16 published parts exist it submits one new eight-H200 RJob, records its
  server-generated name in `deployment-state.json`, and runs `remote_install.py`.
  Ambiguous submission results refuse automatic resubmission to avoid duplicates.
  The exact submission command passed the installed RJob CLI's dry-run check.
- The installer rebuilds on the newly allocated node, recreates or verifies the
  Engram tables, checks the compatible Power frontend, joins the GGUF, and starts
  the bounded tuning campaign. Once SHA-256 passes and the engine reports
  `loaded: true`, the campaign runs
  arithmetic/tool-call correctness checks plus three-round API benchmarks.
  It compares replica layouts, KV packing, batch slots, and optional DSpark;
  rejected configurations restore the last known working profile. This is
  prepared automation, not evidence that any candidate has passed inference.
- Validation logs, Engram identities, frontend evidence, and the built engine
  were copied to the user's shared staging directory before releasing GPUs.

The model is not ready: downloaded byte counts, sparse destination file sizes,
successful CUDA compilation, and API health checks are not inference evidence.
Retain final per-part checksums and the joined checksum before reporting success.

## Follow-up transport comparison, 2026-10-22

- Authoritative process checks confirmed the range downloader, sidecar downloader,
  and deferred GPU launcher alive before changing the transport.
- The fixed-concurrency variable exists in the installed `hf_xet` 1.7.0 binary.
  A controlled native trial disabled high-performance mode and fixed concurrency
  at four, following the workaround in upstream huggingface_hub issue #4893.
- After about ten minutes the native transfer averaged about 0.35 MB/s, with no
  reconstructed file bytes published. It did not improve this network path. The
  comparison was ended deliberately and both resumable HTTP downloaders were
  restored; their live process handles were checked afterward.
- A separate 32 MiB incompressible loopback payload through each of the four
  SSH reverse SOCKS listeners measured 8.25–15.47 MB/s. These are tunnel tests,
  not model download or inference rates. No IPv6 address was advertised for the
  tested HF AWS CDN name, so an IPv4-only retry was not pursued.
- Retained numeric records: `tunnel-throughput.json` and
  `xet-fixed4-observation.json`. The upstream issue is a diagnostic lead, not
  proof that its reported CDN issue caused this deployment's low throughput.
- A later bounded fixed-32 Xet comparison fetched the otherwise unstarted
  sixteenth part while leaving both HTTP range groups running. Its progress hook
  reported 16022368 network bytes in 204.86 seconds, about 0.078 MB/s, and zero
  reconstructed bytes. It did not improve this path; the trial and its temporary
  CONNECT adapter were deliberately stopped. Both handles were confirmed gone,
  while the original range groups and deferred launcher remained alive. No
  native file was published or promoted. This concurrent comparison does not
  establish why the path is slow. See `xet-fixed32-parallel-state.json` and
  `xet-fixed32-parallel-observations.jsonl`.
  [Hugging Face's Xet documentation](https://huggingface.co/docs/hub/en/xet/using-xet-storage)
  describes the fixed-concurrency setting; it does not promise a speedup here.
- A five-minute HTTP comparison reduced model traffic from eight concurrent
  parts to one unstarted part with 16 range workers; the sidecar stayed running.
  The original process group was temporarily stopped, with an independent
  360-second restore watchdog. About 30.5 MB arrived in 300 seconds, which did
  not improve throughput. The original group was resumed automatically, and the
  trial's partial sixteenth part is retained for normal verified resumption.
- A socket audit found a reverse listener bound to all interfaces rather than
  the intended loopback address. Replaced the five anonymous reverse SOCKS
  listeners with authenticated forwarding on ports 18095–18098. A local
  loopback-only exit accepts the temporary credential and permits HTTPS only
  to the explicit model, source, and package download domains. Four end-to-end
  probes reject anonymous clients, accept the private credential, and refuse
  an unlisted destination. A real HTTPS manifest download returned 200 and
  matched the staged SHA-256. The five old listeners were confirmed absent.
- Temporary credentials are generated in memory and staged over SSH only to
  `~/.aster-h200-xq-download` (mode 700; files mode 600), outside shared storage
  and this repository. Curl receives the private configuration directory only
  for the exact task proxy endpoints. No password is placed in command-line
  arguments or evidence. The downloader and historical Xet comparison helper
  use the authenticated endpoints; `authenticated-download-smoke.json` retains
  only numeric and boolean verification results.

The future tuning campaign now checks long-context exact-copy retrieval before
retaining a short-prompt throughput winner, then runs a larger-prompt benchmark.
Request cohorts differ near the beginning of the prompt, so the first batch
does not inherit another cohort's cached prefix; subsequent rounds repeat the
same prefix. Actual prompt counts come from API usage. These real-model checks
remain pending until all weights are available.

## H200 host-memory and failure-path preparation

- Pinned upstream `Ds41FileBlobs::open` explicitly enables `O_DIRECT` decode
  reads to avoid page-cache churn on an 84 GiB consumer-PC cgroup. It supports
  `STRATA_DECODE_DIRECT=0`, where `read_part` uses buffered `pread` instead.
  This provides a suitable comparison on the requested 1760 GiB H200 host.
- Added buffered-read candidates for two-card and single-card replicas. After
  the joined-model identity gate, those candidates sequentially warm the GGUF
  using a bounded 16 MiB read buffer. The file-cache mode and warmup time are
  retained in the active profile. GPU inference/performance remains untested.
- Cache-preserving candidates set the upstream keep-cache token limit to the
  selected context capacity rather than the consumer default of 4096. Native
  cache shrinking and memory fallback remain in force; this needs GPU validation.
- The tuning campaign compares DSpark draft depths 2, 4, 8, and 12, retaining
  both single-request and aggregate measurements. Depth sweeps require observed
  native draft activity and passing correctness checks.
- The campaign independently qualifies the highest measured single-request and
  aggregate candidates with long-context copy checks and larger-prompt runs.
  A failed candidate cannot become qualified by being ranked under the other
  metric. The serving profile is restored after these checks; the report records
  both qualified choices, separate target flags, and the active selection metric.
- Pinned V4.1 source confirms `Ds41MoeTier::kMaxMulti = 16`, and its wrapper
  test clamps requested parallelism to 16. Added 8- and 16-slot single-card
  replica candidates at explicit 32K/128K contexts and retained smaller-slot
  baselines. Eight replicas can therefore be tested with up to 128 concurrent
  requests. This is an experimental capacity, not measured output speed. The
  campaign also tests DSpark's solo path on the best measured batch layout;
  native DSpark remains disabled inside concurrent batch windows.
- Retained direct-read baselines and cache-preserving comparisons for the
  eight-stage and four two-card layouts. DSpark candidates must report actual
  draft counts in native single-request timings; a silent fallback is not
  accepted as proof of speculative decoding.
- A real isolated-process regression reproduced a cleanup flaw: when the
  launch process exited first, its child was left running. Fixed group cleanup
  now uses a private atomic ownership record and an inherited random instance
  marker, validates every live group member, and waits for the entire group.
  Tests cover the exited leader and a matching command with a different owner.
- Checked the project's ModelSet API: it contains no existing model deployments
  to reuse. The installed optional local proxy did not complete the bounded
  connectivity probe; it was stopped and the original download path continues.
- A further temporary local-core probe checked all 88 explicitly configured
  outbound nodes against the pinned Hugging Face checksum manifest, using the
  core's per-node delay API and a 5000 ms request timeout. None passed. No
  selector change was made, the owned temporary core exited, and the Windows
  system-proxy setting remained disabled. Only numeric probe results are retained
  in `proxy-candidates-summary.json`; provider configuration was not copied.
- Read-only Windows checks found no HTTP_PROXY, HTTPS_PROXY, or ALL_PROXY in
  process, user, or machine settings. WinHTTP reports direct access, no PAC URL
  is configured, and the system proxy resolver also returns a direct Hugging
  Face route. No additional configured proxy exit was found.
- Platform-side pulling was investigated without creating resources. The
  `modelset.modelpp.cn/v1alpha1` discovery endpoint exists, but the credential
  cannot read its cluster-scoped CRD. The public OpenAPI lookup returned generic
  metadata definitions without establishing a usable ModelSet schema, and the
  installed BrainPP SDK source search did not identify a model-pull method.
  The separate `model.modelpp.cn` discovery
  endpoint returns NotFound. These checks do not establish a usable platform
  downloader; they do not establish that every platform capability is absent.
- `download-rate.json` records 16032634648 transferred bytes of 168616395872
  expected model-plus-sidecar bytes at 2026-10-22 03:06 CST. The preceding
  1380-second window averaged 915234 bytes/s. At that rate, remaining transfer
  time is about 46.3 hours; this is a conditional staging estimate, not inference
  throughput or a deployment completion promise. The range downloaders and
  deferred launcher were verified alive at the same observation.
- Read-only RJob prediction at 2026-10-22 02:26 CST reports insufficient
  schedulable resources for 8 GPUs, 160 CPUs, and 1760 GiB. The only node with
  eight free H200s is marked maintenance and unschedulable. Project quota has
  room for the request; removing the extra GPFS selector or group sharing
  restriction in prediction did not make it schedulable. No prediction created
  a job. The deferred submission retains the validated resource requirements
  and waits for all model parts before requesting GPUs. See
  `resource-prediction-summary.json`; availability must be checked again later.

## Download recovery and observation fixes, 2026-10-22

- All four previous forwarding sessions returned terminal connection-reset
  errors, and remote socket checks confirmed the listeners were absent. The
  local relay process was still alive. Replaced these terminal handles with
  `keep_download_tunnel.ps1` supervisors using `ssh -N`, keepalives, per-port
  exclusive locks, and automatic reconnect. Each replacement listener passed
  its real SOCKS authentication handshake. This does not establish why the
  earlier sessions reset.
- Both download parents were confirmed missing after the outage. Recovered
  eight-part HTTP downloading plus the sidecar using the existing range state;
  observed subsequent range completions and increasing transferred bytes.
  The deferred GPU launcher remained live and was not restarted.
- Pinned SHA-256 identities for the small checksum manifest and model tree
  allow verified cached metadata to be reused immediately on resume. A focused
  test proves that valid pinned metadata needs no new network request.
- The actual manifest lists the weight parts and joined GGUF, omitting rank
  and expert-map entries. Consequently the former optional checksum lookup
  re-fetched these cached auxiliary files on every resume. Added explicit
  pinned identities for both. A complete offline-resume regression first
  failed on the old implementation and passes after the fix; all cached model
  inputs are now reused without network access. Contradictory manifest entries
  are refused.
- A real observation failed when a range file disappeared between `is_file`
  and `stat`, and when its state file disappeared during publication. Two
  regression cases reproduced those errors before fixing the status reader.
  These checks prevent a polling race from being interpreted as a dead worker.
- Kernel socket inspection observed 254 incoming relay connections near the
  former limit of 256. The relay limit is now 1024, retaining authentication,
  destination restrictions, and connection timeouts. This is capacity headroom,
  not evidence of a throughput improvement.
- An earlier sixteen-part experiment coincided with the unavailable forwarding
  transport. Its measurements are invalid for comparing file concurrency. A new
  bounded comparison measures a fresh eight-part baseline, checks authenticated
  connectivity throughout, waits for actual candidate range workers, enforces
  a host-memory floor, and restores eight-part downloading unless the observed
  candidate rate improves by at least 20 percent. Neither comparison below
  produced a valid candidate speed measurement, so eight files remain active.
- The fresh-baseline comparison measured 879056 model bytes/s with eight
  files, then encountered a refused forwarding connection after starting the
  candidate. It was invalidated and restored eight files. All four SSH
  supervisors remained live, observed their children exit with connection
  resets, and established second-attempt children automatically. No manual
  tunnel restart was needed. A subsequent comparison uses these fresh handles;
  the interruption does not establish its cause or a sixteen-file speed result.
- That subsequent comparison measured 877156 model bytes/s in a fresh
  eight-file baseline. It also encountered a refused forwarding connection
  after starting sixteen files, invalidated the candidate measurement, and
  automatically restored eight files. The restored model process and sidecar
  were subsequently observed live, with increasing transferred bytes. All four
  authentication probes succeeded again. The candidate is not retained; these
  observations do not prove that file concurrency caused the connection resets.
- A cgroup audit found a 6442450944-byte (6 GiB) jump-container memory limit.
  At the retained snapshot, usage was 4973625344 bytes, leaving about 1.37 GiB
  of unreclaimed headroom despite a larger host `MemAvailable`. Cgroup memory
  failure and OOM-kill counters were zero, and the PID controller recorded no
  limit events. These are not evidence of an OOM cause. The experimental
  admission check now uses the smaller of host availability and container
  limit minus usage, refusing more workers when that headroom is insufficient.
  See `download-resource-observation.json` and `files16-trial-state.json`.

## Windows native Xet direct-path comparison

- Installed an isolated Windows environment with `huggingface_hub==2.2.0` and
  `hf_xet==1.7.0`. The candidate used a fresh task cache, explicit public access,
  fixed download concurrency 16, and cleared process proxy settings. It fetched
  only pinned V3 part 09 and did not start any local inference.
- The SDK reported 33982603 network bytes over 378.562 transfer seconds, zero
  reconstructed bytes, and no verified part. The network counter averaged
  89768 bytes/s; it is not verified model throughput. The existing HTTP model
  and sidecar downloaders stayed active throughout, so this observation is not
  an isolated transport ranking. It supplied no evidence for promoting Xet.
- Ended the bounded candidate deliberately, confirmed its process/tool handle
  terminal, and retained only the numeric summary in
  `local-xet-trial-summary.json`. No local candidate part was published remotely.
  The existing HTTP parents and deferred GPU launcher were still live, with
  increasing range progress after the candidate stopped.
- A temporary remote Windows-wheel fetch controller was interrupted after the
  local installation succeeded. Its owned downloader group exited and its
  loopback CONNECT adapter was confirmed absent. Existing model downloaders
  and the authenticated forwarding supervisors were not stopped by this cleanup.

## CDN redirect reuse candidate

- A real HEAD request to the pinned Hub part returned a 302 redirect to
  `us.aws.cdn.hf.co`. Reusing that same URL for two distinct 65536-byte ranges
  (offsets 0 and 33554432) returned 206 and the exact requested lengths. Only
  numeric results and the public hostname are retained in `direct-cdn-probe.json`.
  HEAD is sent only to the Hub; the resulting CDN URL is signed for GET.
- Added opt-in `prepare_assets.py --direct-cdn`. Each file's range workers share
  a validated HTTPS CDN URL for up to 900 seconds and refresh after 401/403.
  A late failure for an older URL cannot invalidate a newer one. Signed URLs
  stay in memory and curl stdin, outside argv, progress state, and shared logs.
  Existing per-part and joined-model SHA-256 gates are unchanged.
- Six hermetic cases cover metadata boundaries, concurrent reuse, expiry and
  stale failures, transient metadata recovery, and 403 refresh without publishing
  an error body. The integrated refresh check also asserts that the signed query
  is absent from curl arguments. The combined jump-host helper run passed 36
  before the network-recovery additions below.
- A bounded comparison uses eight model workers for both baseline and candidate,
  tracks the real container memory headroom, and restores ordinary ranges on
  rejection. Its original measurement added active tail bytes to a counter that
  already included them. Therefore the original 886516-to-1278011 bytes/s result
  (1.442 times) is invalid and withdrawn. Raw observations remain retained in
  `direct-cdn-trial-state.json`; corrected calculations are in
  `direct-cdn-trial-state-corrected.json`. The sampling helper now counts each
  tail once. No tail is treated as a verified model part.
- Recalculating the same snapshots gives 875747 versus 913622 model bytes/s,
  about 4.3 percent higher over these short windows. Median established proxy
  connections decreased from 276 to 158, about 42.8 percent. That independent
  connection count remains valid, and eight-worker CDN reuse is retained for
  fewer connections without an observed slowdown. This does not establish a
  sustained speed improvement; publication can briefly overlap byte counters.
- The twelve-worker comparison had the same counting error. Its original
  1.435-times rate is invalid; corrected rates are 889449 versus 933884 bytes/s,
  about 5 percent higher, below its 15 percent promotion threshold. Restored
  eight-worker CDN downloading and confirmed the replacement process live.
  Both the raw `direct-cdn-workers-trial-state.json` and corrected
  `direct-cdn-workers-trial-state-corrected.json` are retained. A subsequent
  tunnel reset does not establish that the candidate caused it.

## Persistent recovery from temporary download failures

- Confirmed that the former sidecar parent had exited after repeated HTTP 000
  failures. Added opt-in `--retry-network` for model and sidecar range workers:
  recognized DNS, connect, SOCKS/HTTP transport, timeout, rate-limit and server
  failures keep retrying with a delay capped at 30 seconds. Retry logs contain
  numeric outcomes and artifact names, never signed CDN URLs or credentials.
  The default retry limit remains twenty failures.
- Permanent metadata, certificate, local write and unsupported responses still
  refuse publication. A permanent failure cancels sibling retry loops rather
  than waiting forever for them. An expired CDN URL is refreshed, while repeated
  401/403 responses retain the bounded refusal. Full-part SHA-256 remains the
  publication gate.
- Six new hermetic tests cover recovery beyond twenty range and metadata
  failures, the unchanged default bound, permanent refusals, malformed metadata,
  and sibling cancellation. The complete jump-host suite passed 42 tests; see
  `operator-tests-network-retry.log`.
- Deliberately upgraded both owned download process groups after those checks,
  verified the former groups had no live members, and preserved their range
  state. Main PID 217634 uses eight files with CDN reuse; sidecar PID 217779
  retains ordinary ranges. Both use persistent network retries and were observed
  live. This was a software upgrade, not a restart based on an observation
  timeout. See `network-retry-upgrade.json` for before/after byte counters and
  the exact source identity. Deferred GPU launcher PID 87716 was not restarted.
- A subsequent 182.195-second observation confirmed those three exact PIDs
  remained live and both download commands included `--retry-network`. Main
  transferred counters advanced by 154237463 bytes and sidecar counters by
  16969043 bytes; main completed-range counters also increased by one 32 MiB
  range. Four authenticated tunnel probes passed, with 128 main and 16 sidecar
  range workers observed. All 27 operator source hashes matched the local
  manifest. See `network-retry-observation-summary.json` and the retained JSONL.
  This verifies normal resumed transfer, not recovery from an injected live
  outage; outage recovery is currently established by hermetic tests. No full
  model part was published in this observation, and GPU inference is pending.

## Exact-revision mirror probe

- Following the endpoint substitution documented by [HF-Mirror](https://hf-mirror.com/),
  checked the same pinned revision without credentials or global setting changes.
  The Windows request returned the 1686-byte checksum manifest with its exact
  pinned SHA-256, after 59.406 seconds. A separate 65536-byte model-prefix range
  returned 206 after 75.781 seconds; its hash matched the corresponding bytes
  already staged by the existing downloader.
- The large-file probe redirected to `us.aws.cdn.hf.co`, the same CDN hostname
  already used by the active downloader. Direct jump-host manifest and range
  probes both hit their ten-second connection limits with HTTP 000 and zero
  bytes. These measurements establish no faster alternative transfer path, so
  no downloader or relay destination change was promoted. They do not prove
  that every mirror path is unavailable. Full-part SHA-256 remains required.
- Retained `hf-mirror-manifest-probe.json`, `hf-mirror-local-range-probe.json`
  and `hf-mirror-jump-probe.json`. The active main and sidecar PIDs remained
  217634 and 217779; deferred launcher 87716 was live, and all four authenticated
  tunnels passed at the continuation snapshot.
- A subsequent exact-path recheck of the documented public HF cache found no
  directory for this repository and no pinned-revision parts. It cannot replace
  the live download. The bounded lookup is retained in `shared-cache-recheck.json`;
  it does not establish absence from every possible storage location.

## Longer alternate-exit retest

- The original five-second candidate scan retained no failure reasons. Retested
  the same 88 explicitly configured proxy entries with the documented
  [per-proxy delay API](https://wiki.metacubex.one/api/#proxiesproxies_namedelay),
  allowing 30000 ms per request and 35 seconds at the controller client.
  No provider configuration or credentials were copied into this repository.
- All 88 requests returned HTTP 503 from the temporary core, with observed
  durations 4.750 to 5.016 seconds; the full scan took 55.312 seconds. This
  supplies no usable alternative exit. Increasing the outer timeout did not
  change these responses; their timing alone does not establish the underlying
  network or provider failure. Numeric records are retained in
  `proxy-candidates-extended-summary.json`.
- No selector update was needed. The owned temporary core PID 171772 exited
  and was subsequently confirmed absent. The existing download relay and
  remote download parents were not restarted. An optional request for an
  already available faster exit was sent while resumable downloading continues.

## HTTP/2 connection-reuse comparison

- The default `/usr/local/bin/curl` 8.17.0 lacks HTTP/2. The system curl 7.81.0
  initially loaded that same replacement library; selecting its system library
  directory in only the test subprocess restored its matching libcurl 7.81.0
  and nghttp2 1.43.0. No global loader or downloader setting was changed.
- A real CDN range returned HTTP/2, status 206, and the exact expected 65536-byte
  prefix. Used the [documented curl parallel mode](https://curl.se/docs/manpage.html)
  to compare eight 256 KiB ranges in 45-second windows, with the same system
  binary, proxy, signed URL and pinned model prefix. Signed URLs and credentials
  stayed outside argv and evidence. Existing model downloaders stayed active,
  so this is not an isolated full-model throughput comparison.
- HTTP/1.1 opened eight connections and received 1673869 matching prefix bytes
  in 45.016 seconds. HTTP/2 reused one connection and received 217996 matching
  bytes in 45.008 seconds. Both bounded probes ended at their time limits; no
  requested range completed and no model artifact was published. Reduced
  connection count supplied no observed transfer improvement, so this candidate
  was not promoted. This does not establish a universal HTTP/2 performance result.
- Retained `http2-prefix-probe.json` and `http2-multiplex-comparison.json`.
  Main and sidecar PIDs 217634 and 217779 remained live after the comparison.

## Nonweight preparation readiness, 2026-10-22

At 10:19 CST the jump-host launcher passed the new nonweight preflight and
returned to waiting for weights without reserving GPUs. The deployment bundle
is prepared in `/mnt/shared-storage-user/yangchao/Workspace/aster-h200-xq`.
This is preparation readiness; model loading and real inference remain pending.

- `remote_install.py --preflight` verifies eleven pinned archives, metadata and
  small auxiliary files, decompresses and hashes the compatible Power binary,
  checks both source revisions, verifies all 1376 ggml files by Git blob identity,
  and checks all 28 operator files against `operator-files.json`. It reads no
  GGUF weights and needs no GPU. See `nonweight-preflight.json`.
- The prepared engine is the previously built H200 `sm_90` Release archive;
  Power is the previously validated glibc 2.35 binary. The new installer still
  rebuilds the engine and recreates or verifies Engram tables on the selected
  node. Sources and build flags are staged, so these steps need no Internet
  download. Engram data itself is weight data, sourced from the pinned public
  snapshot mounted by the RJob.
- The complete Linux operator run passed 48 tests, including corruption cases
  and refusal to reserve GPUs when preparation is missing. See
  `operator-tests-nonweight-preflight.log`. A failed preflight replaces a prior
  successful readiness report rather than leaving a stale ready flag.
- The exact eight-H200 submission command passed the installed RJob CLI with
  `--dry-run=true`, exit code zero. No GPU reservation was requested by this
  check. The command includes both shared mounts, host NVMe, the H200 tag,
  resource requests and the validated container image; see
  `nonweight-rjob-dry-run.json`. Actual resource availability is checked by the
  scheduler when the weights are ready.
- Generated 28 non-DSpark configurations across eight-stage, four two-card and
  eight single-card layouts, checking KV packing, cache preservation, direct or
  buffered reads, and one through sixteen slots per single-card replica. This
  was configuration validation only, not GPU execution. The 21 baseline tuning
  cases, optional DSpark profiles and draft depths 2/4/8/12 are prepared in the
  campaign. DSpark still requires its sidecar's pinned SHA-256. See
  `nonweight-config-check.json`.
- Deliberately upgraded the owned deferred launcher from PID 87716 to 244040,
  checking its old command, start identity and lock before terminating it. The
  new process passed preflight and logged `WAITING_WITHOUT_GPU_RESERVATION`.
  It rechecks preparation after all sixteen published parts appear and before
  submission; the GPU installer checks again on entry. Main PID 217634 and
  sidecar PID 217779 remained live with unchanged start identities. There was
  no deployment submission record. See `deferred-preflight-upgrade.json`.

Weight completion will trigger the prepared sequence: recheck preparation,
submit one eight-H200 RJob, check actual hardware/NVMe, prepare engine and
Engram data, check Power authentication, join and verify GGUF, start inference,
then run correctness checks and compare throughput profiles. The authenticated
Power endpoint uses port 30002 and the loopback Xolotl upstream uses 8150.
Single-request and aggregate throughput have separate qualification and target
flags. No 1000 tokens/s result has been measured.

## Validation to retain

1. Joined GGUF, rank, tokenizer, Engram, source, and binary identities.
2. H200 engine build and real startup logs, including actual stage placement.
3. Authenticated Power API, streaming, tools, cancellation, and error checks.
4. Repeatable cold/warm prefill, single-request decode, and concurrent output
   throughput through the Power endpoint.
5. Compare an eight-stage instance, four two-card replicas, and eight single-card
   replicas. Only single-card replicas enable native batch slots; test one,
   two, four, eight, and sixteen slots per replica, with explicit context and memory limits.
   Profile changes must retain a same-day baseline and output/correctness checks.

## Reproduction commands and runtime findings

Operator helpers on the jump host:

```sh
cd /mnt/shared-storage-user/yangchao/Workspace/aster-h200-xq
python3 remote_install.py --preflight
python3 -m unittest -v test_prepare_assets test_download_proxy test_service test_benchmark test_status test_deferred_launch test_autotune test_download_auth test_remote_install
python3 status.py --root /mnt/shared-storage-user/yangchao/Workspace/aster-h200-xq
```

The Windows download exit uses the installed Node runtime and
`scripts/h200_xq/start_download_exit.ps1`; it generates a fresh private
credential without printing it. Forward remote ports 18095 through 18098 to
its Windows loopback port 18890, using the supplied SSH entry, before starting
the fetcher. `test_download_exit.py` runs three local protocol checks with a
temporary test credential; it skips when Node is unavailable. The exit relays
downloads only; inference remains on the remote H200 job.

For the compatible Power link, the existing Linux build host uses a compiler
wrapper that invokes `/usr/bin/cc --sysroot=<target-sysroot>
-B<target-sysroot>/usr/lib/x86_64-linux-gnu/`. The target sysroot contains the
GPU container's glibc, libm, libmvec, libgcc_s, loader, libc linker scripts,
libc_nonshared archive, and CRT start files. `lib64/ld-linux-x86-64.so.2` points
to its target loader. Build from `/code/aster`:

```sh
CARGO_TARGET_DIR=/code/Power/target \
CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER=/code/aster/target/h200-xq/cc-h200 \
/home/user/.cargo/bin/cargo build --locked \
  --manifest-path /code/aster/.wt-power-h200-xq/Cargo.toml \
  --release --no-default-features --features server \
  --target x86_64-unknown-linux-gnu
```

Source inspection disproved an initial cache-budget concern: after prefill,
`open_cache` recalculates each stage's budget from the actual remaining VRAM.
The initialization-time layer-share factor is not the final decode budget.
No speculative patch to that factor was applied. Peer handoffs already exist;
the generated engine environment enables the upstream handoff self-test.

## Explicitly not claimed

- No 1000 tokens/s result has been measured.
- No XQ end-to-end request has completed on these H200s yet.
- Unit tests and a successful Power build do not prove GPU inference.
- Xolotl layer splitting is distinct from SGLang TP8/EP8.
- No claim that eight serial stages yield eight times the decode speed.
- No production gateway cutover or replacement of existing model services.
- No credentials or user session state are stored in this evidence directory.
