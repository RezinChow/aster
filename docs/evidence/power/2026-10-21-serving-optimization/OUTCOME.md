# Power serving optimization — execution record

Follow-up: [actual ordinary-client stall investigation](../2026-10-21-client-stall/OUTCOME.md)
reproduced resets on the original public HTTP endpoint with full tool schemas.
The bounded qualification below does not establish that this client issue is
fixed; an SSH workaround passed while public-path repair remains outstanding.

## Result

Server implementation, rollout and the declared operational qualification are
complete. All eight actual production workers run Power v4 with two native
slots retaining32768 context per sequence; the candidate Gateway is deployed.
Actual Power/Gateway rollback rehearsals and final authenticated readiness
checks passed. Isolated GPU7 passed twelve sustained-load cells and four strict
cancellation/overload scenarios. The shared eight-card campaign passed12/12,
and the separately specified-interface public campaign passed4/4.

The matched same-GPU slot study measured45–50% higher aggregate output at load,
with31–36% longer p95 completion latency; ordinary single-request throughput
stayed effectively unchanged. The shared eight-card run served4747 verified
successes plus1631 closed admission refusals. The actual public8080 run served
1464 verified successes plus4125 HTTP429 refusals, with no unexpected outcomes.
These are different measurement scopes, not a causal eight-card/WAN speedup.

The original default-route public timeout remains failed. Selected-interface
testing changes only the benchmark's outgoing-interface condition and does not
repair the default VPN path or identify an unknown forwarding device. Actual
Windows ACP/SDK two-turn acceptance passed12.282/13.843s in one fresh no-tools
session; its earlier30s failure remains retained. Work UI and the user's Darwin
path were not qualified. Global formatting/full CI baseline failures remain
explicitly recorded; this is not an all-checks-green claim.

Specification: [005](../../../../specs/005-power-serving-optimization/spec.md).
Implementation tasks: [tasks](../../../../specs/005-power-serving-optimization/tasks.md).

## Preserved starting state

- Existing GPU server repositories `/code/Power` and `/code/aster` are the
  user-directed targets; no repository was created or cloned.
- Power HEAD `830760c`, existing dirty snapshot
  `20ed6b9ce5a7e578c924bb6b4acd9776b57cadc8` (template/GGUF reader changes).
- Gateway dirty snapshot `02f45d09c112c4b7a81d2219f4d915a7a22375a1`.
- Preserved production Power binary: `/opt/a3s/bin/a3s-power`; active production
  ports remain Gateway 8080, Power 18200–18207 and llama-server 18100–18107.
- Baseline private canary: port 19200, preserved binary and private GPU-7 upstream 19100,
  fresh benchmark-only identity/configuration; no production credential copied.
- Benchmark runtime files live under `/code/Power/.git/optimization-20261021`.
  Credentials and unredacted configuration from that directory must never be
  copied into this evidence tree.

## Predeclared qualification gates

These rules are fixed before formal paired performance campaigns. Earlier
20%/25% aspirations are not measured results or unconditional delivery promises.

1. Preserve target GGUF, tokenizer/template identity, sampling, output budget,
   effective per-sequence context (32768) and corpus across paired comparisons.
   Record a deliberately changed experimental factor; changing target/model,
   context or corpus cannot qualify an optimization of the original workload.
2. Correct text/tool output, finite admission, cancellation recovery, privacy
   suppression and unknown-usage handling are hard gates. Unexpected errors or
   leaked permits prohibit promotion. Deliberate 429 overload refusals are
   reported separately, alongside total and successful-request throughput.
3. For service changes, compare first meaningful output and completion wall time;
   role/heartbeat frames do not establish TTFT. SSE deltas are not tokens. Use
   only engine-authoritative counts for aggregate token-throughput claims.
4. Run three matched repeats per formal campaign: concurrency 1/8/16/32,
   60-second dispatch window, 120-second absolute per-request deadline and
   15-second cleanup allowance. Report drain time and request-budget exhaustion.
   Small-sample percentiles are descriptive, not proven tail-capacity claims.
5. At ordinary supported load (one request per verified slot), unexpected error
   count must remain zero and p95 TTFT/completion latency must not regress by more
   than 10% across repeated runs. A candidate needs a repeatable user-visible
   improvement (tool first-output latency or successful throughput) beyond repeat
   variability; a correctness-only change does not prove decode acceleration.
6. GPU experiments have a 90% total-VRAM guard on a co-resident canary. Record
   failed/OOM/incompatible cases and retain the previous safe profile. Do not
   reduce effective context to make a high-slot configuration appear faster.
7. New state/profile generations cannot reuse incompatible cache state. Cache
   capability stays unsupported unless authenticated isolation and recurrent
   restore/branch correctness have been proven for the actual backend.
8. Canary rollback must restore the old binary/configuration/profile and prove
   recovery before the selected candidate is rolled out one worker at a time.

## What landed

- Formal specification/plan/tasks/research and read-only consistency analysis.
- Applied Power provider/API changes: owned incremental SSE, indexed tool
  reconstruction, authoritative upstream usage, meaningful-output timing,
  bounded HTTP admission and cancellation cleanup. Unknown finish reasons and
  tool types fail closed; failure audit follows the existing privacy provider.
- A 64 KiB GGUF metadata reader preserves parser behavior while avoiding the
  original approximately 1.27 million small header reads during cold autoload.
- Power candidate v3 was built with `--locked --release --no-default-features
  --features server` in 65.506 s. Its private running binary SHA256 is
  `038e96fb23cab83fdbb7122df52ffda22e95daef59d316b64f3ad74967ba1093`.
  [Captured source patch](power-v3-source.patch) SHA256:
  `3e9b950215064ac1754d6a28ca7142472042ace630f7e4c8637081f223020348`.
- Final Power v4 additionally accepts legal assistant tool histories with null
  or omitted content at the OpenAI request boundary. Backend/public message
  types and ordinary string histories remain unchanged; duplicate-field and
  malformed-call validation stays typed. Focused tests passed 7/7 and the full
  library passed 1947/1947. Its release binary SHA256 is
  `75afe5de8d423547fdb9b9bb302b17ca9e168d6f6fe13a18d29fbce9492bf1c1`.
  [Independent compatibility review](v4-compatibility-review.md) records the scope.
  [Source/build proof](v4-artifacts/power-v4-source-proof.json) preserves the
  test-only annotation after the build separately; the unchanged serving code
  is represented in [the full source patch](v4-artifacts/power-v4-full-source.patch).
- Gateway fixes passed the focused Linux suites: preserve normal complete POST responses,
  cancel on read EOF, and return explicit 504 when the total deadline expires
  before response headers. The original production Gateway was preserved during
  private qualification; the later actual cutover/rollback/restoration is below.
- Actual eight-worker promotion uses two native slots per GPU, retaining32768
  context per sequence (65536 total per worker), and finite Power active2,
  queue8/1000ms admission. Native metrics/slot observations are enabled. The
  existing PTQ1 GGUF, pinned llama-server artifact and non-speculative execution
  remain the runtime basis; no DeepInfer kernel or compatible draft was imported.
- Qualification tooling now has 28 passing hermetic cases, including absolute
  slow-drip deadlines, actual slot/context/process ownership, native counter
  reconciliation, GPU guards, cancellation and failure evidence retention.

## Real full-path and cold/warm qualification

[The final T007 run](t007-e2e-v3-3.json) completed all **11 candidate scenarios**:
text/tool SSE and JSON, malformed JSON, authentication and unsupported-tool-choice
refusals, queued cancellation, cancellation before first meaningful output and
mid-generation cancellation. Each cancellation returned to native idle, zero
Power admission gauges and a correct recovery request. The baseline passed the
first eight scenarios but failed all three cancellation cases: queued work could
still dispatch after cancellation, and the legacy active-request gauge leaked.
These failures are retained as baseline behavior, not removed from comparison.
Two earlier incomplete attempts remain beside the final raw record.

The [cold/warm experiment](cold-warm-final.json), reproduced by
[its bounded helper](cold-warm-repro.py), used three repeats with alternating arm
order. Cold private Power processes used separate `A3S_POWER_HOME` directories;
API model registration and its approximately 14-second file hash were completed
before measurement. All 12 outputs passed and native completion counts were two.
Median cold request wall time was **843.123 → 281.545 ms**; model-load time was
**666.147 → 103.633 ms**, while native engine time stayed **47.180 / 47.170 ms**.
Median warm request wall time was **85.097 / 86.182 ms**: no warm speedup was
measured. These buffered requests have no asserted TTFT.

[Context qualification](t008-context-v3-1.json) passed **15/15 scenarios** in
22.204 seconds. Both Power arms processed an actual 31780-token prompt, returned
the expected `READY`, and reconciled reported prompt usage with the native
processed-plus-cached counter delta. With 16 tokens reserved, this stayed within
32768. A native 33108-token overflow returned 400; both Gateway/Power paths
returned explicit typed 500 errors without native output or a fake completion.
The status translation remains a limitation, rather than being called a client
400. Ten same-prefix/divergent-prefix/interleaving cases returned the expected
ALPHA/BETA outputs and actual counter differences established reuse. Native
erase did not guarantee cold RAM state, so observed reuse was retained as reuse.
These tests cover one fresh benchmark identity, not authenticated cross-tenant
cache isolation. All final request/admission gauges and native work returned to
zero. [The statement](t008-context-statement.json) records these boundaries.

## Interim runtime decisions — not deployment acceptance

All following trials used the pinned PTQ1 model and existing runtime on GPU 6,
one slot with 32768 context, FA enabled, temperature 0 and fixed seed. Each
measured arm used three requests after warmup. Private engines were stopped and
GPU memory returned to 8210 MiB. These trials preceded the full-load and actual
canary gates documented later; this small cohort alone did not qualify rollout.

| Executor trial | Median request wall time | Decision |
| --- | ---: | --- |
| Existing graph/MMQ settings, monitored | 1366.429 ms | Reference |
| CPU/memory binding to NUMA 1 | 1366.387 ms | No measured benefit; preserve placement |
| CUDA Graph disabled | 2027.565 ms | Reject regression |
| PTQ1 MMQ maximum batch set to 1 | 1438.503 ms | Reject regression |

[Raw executor observations](p5-results.json) include monitoring overhead and
NUMA page-placement limits. These are controlled runtime ablations, not GPU
kernel traces: `nsys`/`ncu` are absent. Existing cached model pages did not all
move to NUMA 1.

[Ngram capability trials](p4-results.json) and their
[qualification limits](p4-statement.json) demonstrate actual draft execution;
the initial incorrect `/props` default-field gate was retained separately and
excluded from results. On a repetitive 128-token fixture, fixed-depth 8 reduced
median wall time from 1366.951 to 621.194 ms; adaptive depth 2–8 took 670.347 ms.
This fixture had 100% acceptance and does not establish general acceleration.
The [additional qualification](p4b-results.json) exercised partial rejection:
fixed depth 8 accepted 214 of 255 proposed tokens on each ordinal continuation.
All 27 measured count/tool/ordinal payload digests matched the corresponding
non-speculative result, and count/tool expected-output predicates passed. Tool
comparison excludes randomized call IDs while retaining the raw message digest.
These small fixtures used warm ngram history. Cold history, authenticated
isolation, long context and concurrent-load qualification remain prerequisites
for promoting speculation; production speculation remains unchanged.

## Commands and measured evidence

- Server: `cargo test --locked --no-default-features --features server --lib
  -- --test-threads=16`: **1940 passed**, 0 failed, 6.46 s test time.
- Server Aster: `python3 tests/workspace_dependencies.py`: **6 passed**;
  `python3 tests/crate_drift_report.py`: exit 0, existing drift set retained.
- Owner suites before the full Power run: chat 78, provider 29, GGUF 39,
  server 230 and configuration 170 passed. These overlap the full library run;
  their counts must not be summed into a distinct-test claim.
- [Local client/helper tests](local-qualification-tests.json): qualification
  28/28, E2E fixtures 4/4 and context fixtures 4/4, all with CPython 3.12.14.
- Gateway focused post-fix suites reported managed scheduling 9/9,
  distributed entrypoint 22/22 and ordinary entrypoint 94/94. The
  [independent review](gateway-independent-review.md) passed. Candidate Gateway
  SHA256 is `eaf9f4ca8baf38074d1548badebbd3b42bd08ab5174e2f9136101ccbcfb6c1fd`.
  Source/build checks are recorded in [Gateway verification](gateway-verification.md).
  Six changed Gateway files were ported to the local checkout with normalized
  source hashes matching the remote files and existing dirty work preserved.
  [Local verification](GATEWAY_LOCAL_SYNC.md) records passing owner format checks
  and **zero executed Windows runtime tests**: baseline static-CRT linking fails
  on `ort_sys`, and an isolated dynamic-CRT attempt fails on mixed native CRTs.
  Both failures were reproduced independently; no dependency or guard was changed.
- `guard-smoke-v3`: one-second dispatch per arm, concurrency 1, four synthetic
  warmup cases; both arms completed two measured requests with zero unexpected
  errors and native counter/identity/VRAM guards passing. This is a tooling
  smoke check, not the 60-second formal campaign.
- Global format checks expose existing differences outside the changed owner
  files: server Aster `apps/studio/src-tauri/src/tenant.rs:379`; Power
  `src/bin/a3s-power-cuda-fusion-bench.rs:40`. Owner checks pass. Local Windows
  root formatting also hits OS error 206. No unrelated files were formatted.
- Local Windows workspace guard: 5/6 passed; the Studio companion fixture
  independently reproduces `rc.exe` access denied (OS error 5). Local crate
  drift guard refuses missing API/Cloud lineage roots. The corresponding
  initialized server checkout passes both guards; no guard was weakened.

The baseline is the preserved actually deployed binary, SHA256
`29d239e2495400036af24c7b1bca248e397bbb15b5c13646533d519fb2f345af`.
Its exact source/features cannot be independently reconstructed; the captured
starting source snapshot is traceability evidence, not a claim that it produced
that binary. The candidate has separately recorded source/build identity.
The [initial source diff](power-initial-snapshot.patch) is reproducible with
`git -C /code/Power diff --binary 20ed6b9^1 20ed6b9`, SHA256
`4336d97d7e8f60416801a4c8462824ab51e0a28c68856b2369acb4e7c22186ec`.
T007 was refined to preserve the actual deployment control rather than rebuild
an artifact whose relationship to production cannot be established. Comparisons
will establish complete-artifact behavior, not isolate compiler/feature effects.

The initial one-second smoke retained two metadata transcription errors
(65-character tokenizer/template hashes); its historical records remain intact
and are excluded from formal acceptance. Correct identities were read directly
from the retained `bounded_gguf_header` probe, and provenance validation now
rejects malformed optional hashes. A [corrected smoke](guard-smoke-metadata-corrected-v3/)
passed both arms with four warmup cases and two measured successes per arm,
actual native output delta 185 per arm, candidate exact usage reconciliation and
final idle/gauge recovery. It precedes formal runs and is not a sustained-load result.

Isolation review also found that `data_dir` does not control the model registry;
Power uses `A3S_POWER_HOME`. Earlier private-wrapper registration touched the
shared model registry. That entry is preserved with its content hash/stat record;
no shared registry file was deleted or copied. Both wrappers now have explicit,
separate benchmark homes and registered only the synthetic benchmark alias through
the API. The [preserved shared-entry record](global-registry-preservation.json)
contains its hash/stat identity; the isolation setup did not change it again.

The existing Prism provider does not forward the API's requested seed. Formal
service provenance records requested seed 42 and actual native seed 4294967295
(automatic), rather than claiming seed forwarding. Both arms use temperature 0
and the same greedy sampling. Direct-native P4/P5 trials actually set seed 42.

## Completed private sustained-load campaigns

The formal software campaign on GPU 7 and the NP1/NP2 profile campaign on GPU 6
each completed **24/24 passing cells** with their frozen instruments: three
repeats at concurrency 1/8/16/32, 60-second dispatch and 120-second absolute
request deadlines. All private native engines and wrappers were then stopped;
production process identities remained unchanged. These measurements used Power
v3 and do not qualify a later serving artifact without additional verification.

[The software summary](formal-software-v3-summary.json) compares the actually
deployed old artifact with candidate v3 on one shared single-slot native engine.
At concurrency 1, native output throughput stayed effectively unchanged
(83.969 versus 84.089 tokens/s). Pooled successful SSE p95 first meaningful output
fell from **494.827 to 370.369 ms**, and p95 first tool output from **529.060 to
220.380 ms**; completion p95 stayed **2113.562 / 2113.996 ms**. All three paired
ordinary-load repeats passed the 10% latency regression gate. Across all cells,
the baseline served 760 successes; the candidate served 606 successes and 28,099
bounded admission refusals. Neither arm had unexpected outcomes. Refusals are
not successes, and different admitted workload mixes prohibit a high-load decode
speedup claim. The old artifact had 186 wire-usage mismatches; the candidate had
zero. The companion sampler's initial baseline bucket-range failure and later
coverage gap remain recorded rather than being presented as complete sampling.

[The slot study](RIG6_SLOT_STUDY.md) used the same new Power/Gateway artifacts
in both arms. Only slots, total context (32768 versus 65536, retaining 32768 per
sequence) and matching active admission changed. An independent driver enforced
paired-manifest/flag-diff checks and strict usage reconciliation for both arms,
including warmups. All 1,406 successes passed expected-output checks; 54,146
bounded refusals and zero unexpected outcomes were recorded. Median native
throughput rose from 84.96 to 127.35 tokens/s at concurrency 8, from 88.12 to
127.35 at 16, and from 88.41 to 131.16 at 32, about **45–50%**. Ordinary
concurrency-1 throughput remained 84.08 / 84.01. High-load p95 completion
latency increased about **31–36%**, so this is a capacity/latency tradeoff.
Peak whole-card memory was 18,601 / 24,564 MiB (75.72%). Two slots were selected
for the canary. Actual v4 production deployment and the later canary/eight-card
gates are recorded separately below.

The [four-slot preflight](rig5/final-readiness.json) exceeded the predeclared
co-resident whole-card VRAM guard: **22977 / 24564 MiB (93.54%)**, above 90%.
Only the identified private engine was stopped, with no smaller context or KV
quantization retry. No NP4 formal result is claimed. After preserving the failed
attempts, the [private rig was removed](rig5/cleanup-proof.json) and production
GPU 5 returned to 8210 MiB with native/Power health 200. This is a capacity refusal
under coexistence, not proof that the runtime can never support four slots.

[Source synchronization](source-sync-verification.json) independently confirmed
all six changed Gateway source files match between Windows and the GPU server
after LF normalization. Linux candidate artifacts, not Windows executables, are
used on the server. An [external unauthenticated probe](external-unauthenticated-reachability.json)
returned a bounded HTTP 401 in 344 ms. That establishes reachability for one
request; it does not reproduce or uniquely explain the original 3.3-second reset.

Long-context/cache checks within the benchmark identity and private formal
campaigns passed at that checkpoint. Authenticated cross-tenant cache
qualification was not performed. The original production Power still had legacy
HTTP admission at that time; later sealed typed ACL preparation and actual
selected-worker rollout proofs establish the deployed capacity fields.
Private-wrapper settings alone never prove a production configuration change.

The full existing Gateway CI command and independently reproduced failures are
recorded in [the CI audit](GATEWAY_FULL_CI_AUDIT.md): **2041 passed, 5 failed,
5 ignored**. A separate one-line example conversion fixed the initial build
error; the five remaining failures concern preexisting dirty rerank contracts,
installed model fixtures and a privileged port-80 fixture. Full CI is not green.

## Public frontdoor and continuous-conversation investigation

[The pre-deployment public qualification](public-before-deployment-v1.json)
passed the model-list request and four authenticated text/tool SSE/JSON cases
through `http://117.162.0.179:8080/v1`. Authentication used the existing shared
token carried only in process memory over SSH, without storing its value in
source or evidence. The public endpoint already worked for these requests;
that behavior must not be attributed to the undeployed candidate.

The user's quoted `"A3S_GATEWAY_KEY"` was a literal credential, reproducing the
401 response; an actual ACL environment call is `env("A3S_GATEWAY_KEY")`.
The user subsequently confirmed that the real credential works but the second
ordinary message stalls. The live tests retain distinct observations: several
ordinary history turns succeeded; a legal null-content tool continuation got
HTTP 422; and separate public requests timed out during TCP connect before
sending HTTP. A later private request with the same synthetic body succeeded.
The null-content compatibility defect was repaired independently in Power v4: actual
Aster assistant messages use strings, so it does not establish the cause of
the reported second ordinary message. Old Power's tools-enabled path also waits
for full upstream generation before sending headers. A real persistent-client
second-turn acceptance for the final release was separately required and passed
in [the final public cohort](public-final-final-v4-attempt1.json). The earlier
[subsequent persistent-client evidence](public-conversation-diagnostics-statement.json)
records a successful real public second ordinary turn on the same TCP socket,
including tools on both requests, complete finish/DONE/body EOF and a correct
second response in about 1.5 seconds. This small synthetic history does not
reproduce or disprove the user's particular Aster history or SDK path.

## Actual production canary preparation and first cutover

[Failed preparation attempts](production-preparation-attempts.json) remain
preserved. Before any production mutation, actual host checks corrected the
operator helper's systemd scalar/interface assumptions and the ACL preparer's
incorrect root-owner assumption. Existing ACL files are service-user-owned
uid/gid 1000 and private mode 0600. The validator now accepts that exact reviewed
tuple and preserves ownership, mode and xattrs. No original ACL contents or
credentials are exported to this evidence tree.

The successful transaction is sealed host-locally at
`/var/lib/a3s-serving-optimization/transactions/rollout-v4/gpu7-attempt3`.
Root installed helper SHA256
`a3f0cebde47b46f70cbfcf94708b3ae32f0237bcea7d4e4d5c732015dfcb1212`
and AST validator `c21be9da6fb804954af9d9012b76456e4ecf9af26848dde5c1d85bf4eac6b579`.
The real ACL parser/Power validator accepted the prepared two-slot configuration,
and all noncapacity AST content was preserved. Apply actually stopped only
selected Power first and proved systemd inactive/MainPID 0 with an empty cgroup
subtree before changing its ACL or native configuration.

[First candidate readiness](production-gpu7-first-readiness.json), at
2026-10-21T03:23:22.968624Z, verified actual native PID 3453716, Power PID 3453907,
the pinned executable hashes, CUDA device 7, two 32768-context slots and both
health endpoints. Whole-card memory was 10376/24564 MiB. All other production
process generations stayed unchanged. The [drain proof](production-gpu7-first-drain.json)
records the enforced acceptance boundary. The old global Power artifact and
launcher remain intact for rollback. This readiness is not a passing canary
load campaign or public managed-frontdoor acceptance.

The first functional canary stopped at its queued-cancellation task-vector gate.
All own cleanup and recovery checks passed, but an additional native task
executed before recovery. [The failed raw archive](canary-v4-smoke-failed.tar.gz)
remains failed. [Independent production metadata](canary-v4-concurrent-traffic-proof.json)
confirmed a real Gateway POST to production Power18207 in that interval. The
extra task processed 432 prompt tokens; the benchmark's cancelled short request
used 17. This is demonstrated confounding, not evidence to relabel the run as a
pass or to assert a cancellation leak.

Root actually [rolled back GPU7](production-gpu7-first-rollback-proof.json) at
2026-10-21T03:30:35.825054Z: old Power/native artifacts, one 32768-context slot,
original ACL hash, health200 and unchanged other workers were verified. A
subsequent unauthenticated selected-Power models probe correctly returned401;
it sent no inference and tried no keys. A separate reviewed root-only Rust probe
then used the actual ACL parser and existing authentication contract, keeping
credentials only in host memory. [Authenticated selected-worker recovery](production-gpu7-authenticated-rollback-recovery.json)
passed: models200 with the exact alias, one synthetic completion200 with expected
output in 0.417405s, and unchanged old native/Power process identities. No
credential was printed, persisted, guessed or used to bypass authentication.

Root restored candidate v4/two-slot GPU7, then actually stopped its production
Power listener for a new isolated run. [The isolation proof](production-gpu7-isolation-proof.json)
at 2026-10-21T03:47:58.361475Z proves inactive/MainPID0 and an empty complete
cgroup subtree. Native PID3507977/start9905413 retained two idle 32768-context
slots. The other seven production workers and shared Gateway generations were
unchanged. [Restored candidate readiness](production-gpu7-restored-readiness.json)
records the candidate before its deliberate listener stop. Private wrappers used
fresh homes/registration and a fresh result namespace; original failed records
remain intact.

## Completed isolated production GPU7 qualification

The first isolated attempt sent **zero inference requests** and refused fresh
native slots whose `/slots` JSON had no `id_task` yet. The pinned runtime adds
task fields only when a current or previous task exists. This unsupported result
remains preserved. An explicitly authorized, separately recorded preparation
then sent exactly two concurrent golden decode requests: both returned correct
output with authoritative usage of 37 prompt and 183 completion tokens each.
Both slots were observed busy; native completion delta was exactly 366. Native
slots and all private Power gauges returned to idle/zero. This established the
frozen canary's warm-slot precondition without changing its parser or treating
preparation as qualification.

The new `canary-v4-isolated-warm` namespace passed all **four strict functional
scenarios**: queued cancellation, cancellation before first meaningful output,
midstream cancellation and overload. Both queue-task-vector checks, explicit
typed overload refusal, native-work observation, permit recovery and correct
recovery requests passed. Its separate one-second smoke passed before the full
matrix was authorized. The four original instruments remained unchanged;
driver SHA256 was
`6bc7ad205d4c27d654553404442fb6d74d4c99577e75ff238d854bea84eb8627`.

[The candidate-only full summary](canary-v4-isolated-warm-summary.json) records
**12/12 passing cells** in 800.000 seconds: three repeats at each concurrency,
60-second dispatch, 120-second absolute request deadlines and finite cleanup.
All **808 successes** passed exact-output, authoritative upstream usage,
matching wire usage and complete finish/terminal checks. Every cell's native
completion delta exactly reconciled. There were **26,086 HTTP429 refusals** and
zero timeouts, unexpected HTTP errors, invalid streams or invalid outputs.
The frozen client exports HTTP429 status without each error envelope; these
counts are not individually asserted to have a typed admission code. The strict
functional overload test independently proved the typed queue-full response.

| Concurrency | Native actual tokens/s, median [min, max] | Successful p95 TTFT / completion / first tool output, ms |
| --- | ---: | ---: |
| 1 | 84.121 [84.108, 84.428] | 370.65 / 2115.10 / 202.24 |
| 8 | 125.285 [124.683, 127.895] | 1334.57 / 3940.06 / 1304.77 |
| 16 | 128.268 [124.238, 129.596] | 1421.02 / 4048.69 / 1536.28 |
| 32 | 131.003 [123.977, 131.687] | 1410.93 / 3968.23 / 1490.81 |

Latency values pool successful samples and remain descriptive; admitted workload
mixes differ. Whole-card VRAM peaked at **10408/24564 MiB (42.37%)**. This is
one candidate on the actual production native GPU7 through private wrappers,
with production Power7 deliberately inactive during measurement. It does not
establish eight-card/public8080 capacity or a matched before/after speedup.
Final observed native processing/deferred counts and all private Power gauges
were zero before the qualification load was handed back.

[The complete raw/source archive](canary-v4-isolated-warm-evidence.tar.gz),
SHA256 `7176f7fe0b8e9110ee4bfd0ff07a5a2e0d327b267e5d9635c2ae718cccefa592`,
contains 45 members with all 44 artifact hashes independently verified after
download. It retains both earlier failed/unsupported attempts and the separate
preparation. No credentials, private ACLs, real user histories or model weights
were exported.

After qualification, root restored actual production Power7 to candidate v4.
Current verified generations are native PID3507977/start9905413 and production
Power PID3598611/start10082142. The reviewed generic authenticated worker probe
first passed exact-alias model listing, one correct synthetic completion and
`loaded_models >= 1` in **0.737158497 seconds total**. This supersedes the earlier
deliberate listener-stop state. The later fleet proof below repeats this check.

## Eight-worker deployment and completed Gateway rehearsal

[The safe fleet rollout proof](production-fleet-v4-rollout.json), observed at
2026-10-21T04:27:25.828671Z, records all eight actual production workers on the
pinned candidate Power/native artifacts. Workers 0–6 were applied individually;
each selected worker's readiness preserved the other process generations,
verified CUDA binding, two slots with 32768 context each and health200. Every
worker then passed authenticated exact-alias models200, one correct completion200
and an actual `loaded_models >= 1` health check. The repeated GPU7 probe took
0.559776167 seconds total and retained native3507977/start9905413 and
Power3598611/start10082142. These are real serving-worker probes, not private
wrapper registration or source-only readiness claims.

The later idle `loaded_models=0` snapshots do not imply an unservable route.
Source review of the deployed generic-provider path found aggregated Power
readiness independent of loaded count (`worker_observation.rs:104–109`), Gateway
selection through healthy generic load balancing when model scheduling is absent
(`inference_dispatch.rs:319,372–380,429–436`), and health checks accepting HTTP2xx
(`health_check.rs:330–336`). Power's chat path acquires finite admission and then
calls `ensure_loaded_with_keep_alive` (`chat.rs:315–327`). This is the reviewed
generic cold-autoload path, not a claim about every managed scheduling mode.
No product source change or extra inference request was made for this review.

[The first candidate Gateway public check](public-gateway-first-candidate-v4.json)
passed models200 and all four synthetic functional cases from Windows: text SSE,
longer SSE, buffered JSON and tool SSE, including authoritative/wire usage and
expected outputs. That small cohort is not the eight-card matrix.
[The Gateway rollout proof](production-gateway-v4-rollout.json) records actual
candidate deployment, rollback to the original artifact and restoration in a
fresh transaction. The other sixteen worker generations were unchanged; the
restored candidate Gateway is PID3626474/start10150392 with the pinned eaf9f4ca
artifact. [Final Windows public acceptance](public-final-final-v4-attempt1.json)
passed all 16 requests in 26.593 seconds: negative-auth401, models200, thirteen
successful inference requests and one intentional cancellation. Five ordinary
turns and three tool-history requests reused one observed TCP connection;
empty/null assistant tool-history compatibility and cancellation/recovery were
included. This proves the bounded synthetic public cohort, not a Work UI run.
The original [actual ACP attempt](aster-acp-final-v4.json) initialized and opened
a fresh session, then exceeded the first prompt's 30-second deadline. Its
`turns=[]` proves no completed turn; partial assistant output was not retained
by that frozen driver and remains unknown. The separate ACP result below passed
its narrower SDK scope. The shared eight-card qualification below passed;
specified-interface public pressure and the final evidence audit subsequently
passed as recorded below.

## Completed eight-card shared-production qualification

[The v2 offline summary](live-eight-v2-summary.md) records the unique
`live-v4-v2-full1` run: all twelve cells passed, with three repetitions of
60-second dispatch at global concurrency1/8/16/32 and no automatic retry.
Measured results were 4747 successes, 1631 closed admission refusals and zero
unexpected outcomes. The 384 successful warmups are counted separately.
Successful measured requests reported 468683 authoritative completion tokens.

| Global concurrency | Own verified output tokens/s, median [min,max] | Successful completion p95 median | First meaningful output p95 median |
| --- | ---: | ---: | ---: |
| 1 | 72.509 [71.659,72.773] | 2.402s | 0.644s |
| 8 | 642.028 [640.072,643.276] | 2.329s | 0.547s |
| 16 | 915.550 [914.000,916.301] | 3.031s | 0.670s |
| 32 | 902.840 [900.956,910.368] | 3.927s | 1.315s |

Every cell covered all four warmup cases on every GPU and required strict
quality, authoritative usage/wire equality and complete finish/terminal checks.
The independent offline audit repeated per-GPU warmup and measured accounting.
Native completion deltas were at least own verified output counts; all
unattributed completion deltas were zero. The classification remains unknown
and does not establish exclusive request ownership. All private request gauges
and admission permits drained; both monitors ended without errors; peak
whole-card VRAM was42.3954%. All seventeen actual production native/Power/Gateway
unit identities matched preflight at final observation.

This is own verified API goodput through a second private Gateway/Power
admission pool sharing actual production natives. It is not native-exclusive
throughput, a public8080 capacity measurement, a before/after causal ratio or
shared-cancellation proof. The isolated GPU7 run separately establishes the
strict cancellation gates. The v2 lifecycle rule accepts legitimate idle
production bookkeeping unloading only with pinned authenticated same-generation
evidence, and all warmups must pass before strict loaded readiness applies
through measurement/cleanup; this is not a missing-model fallback.

The owner audited remote proof `live-v4-v2-full1-proof.json` SHA
`3c4dbdcc14cf2dc7ea2f05b5114b9ebd81de5490f7f5e5cd30ae4301667ab01f`.
The frozen v2 source SHA is
`a5e84e3e69abf3b3dc05fe4ff959c34aadce33b67b9d94bdc31ec34962d94a8b`;
Windows/Linux each passed sixteen v2 fixtures, with independent review.
After public measurement ended, [the raw archive](live-v4-v2-full1.tar.gz)
SHA`a9dfe1aa92c84763a9097607d459fc55e1daa9017ed1a030ab453ccfbcbc39a0`
was downloaded. Both owner verification and an independent local audit checked
all34 safe members, all33 manifest file hashes and per-GPU raw accounting.
[The archive manifest](live-v4-v2-full1-archive-manifest.json) and
[final operational audit](final-operational-audit.json) preserve those checks.

## Actual Windows ACP/SDK two-turn diagnostic

[The independent diagnostic case](aster-acp-final-v4-diagnostic1.json) passed
once in 26.359 seconds, without changing the existing ACP executable or its
configuration/proxy code. It used the same fresh no-tools source-review session
for both prompts. Turn1 completed in 12.282 seconds with first meaningful text
at 12.235 seconds; turn2 completed in 13.843 seconds with first meaningful text
at 13.640 seconds. Both exact synthetic outputs and ACP `end_turn` were verified,
and both completion timestamps explicitly fall within 30 seconds. This later
case does not turn the original 30-second failure into a pass or establish its
cause.

These 12–14 second SDK turns still entail noticeably more waiting than the
separate public HTTP cohort's approximately 1.406 second second ordinary turn.
The prompts and harness paths differ, and the SDK can make internal model calls;
this is an observation, not a causal overhead estimate or evidence that the
original user's root cause has disappeared. No Rust client or proxy settings
were changed to obtain the later pass.

[A bounded Gateway journal observation](aster-acp-diagnostic1-gateway-window.json)
contains eight typed POST200 completion entries in 04:50:59–04:51:35Z, with
1962–2732ms durations. That query used uncalibrated Windows and server UTC
clocks. A later persistent-SSH calibration found server time 6.197–6.545 seconds
ahead of Windows; it does not prove the historical offset. The earlier raw
comparison of six entries inside the ACP interval and two afterward is withdrawn.
The ACP did not expose corresponding HTTP request IDs, so attribution to this
client is unknown; these durations cannot be summed into an SDK breakdown.
Only whitelisted access metadata was exported, with no journal
MESSAGE, caller address, prompt, header or credential.

The diagnostic observed child PID171712 with a fixed creation identity through
131 TCP samples. The target endpoint appeared as Established in 129 samples,
using local port58254 from 0.578 through 26.406 seconds after observation began.
Turn1 produced one meaningful text delta/five characters and turn2 ten deltas/
21 characters; only counts and digests are exported. The observer had no errors,
the exact child was reaped, and bounded fresh-state inspection found no resolved
credential. The key arrived only through the approved protected SSH pipe into
process memory/child environment; the temporary ACL retained `env(...)`, logging
was disabled, and real user state was never imported.

The [new observer](aster-acp-diagnostic.py) wraps the frozen 0226 driver and
records partial text independently of completed turns. Its
[eight hermetic checks](aster-acp-diagnostic-fixtures.json) include the unchanged
real ACP against a loopback OpenAI fixture, owner/PID filtering, process-exit
race, 30-second incomplete checkpoint, safe partial-output accounting and
cleanup after observer setup failure. The fixture observed nine internal/model
calls: all had `max_tokens=128`, two had `stream=true`, none contained tools,
and thinking/reasoning/stop options were absent. Those synthetic fixture calls
do not prove the live internal HTTP count. The live executable SHA remains
`e0f810af8796ca1a0934c503ddbb56034ee10ee2c3b0011e8e5f27fbbb03ae59`;
the observer SHA is
`d0a9d59a78069dcd42528a5c67d212b78f7c551ff689fb2ed28e7bfbef9941df`.
This is actual ACP/core SDK acceptance; it does not exercise Work UI, ordinary
tool-enabled ACP mode, real user history or the user's Darwin network path.

## Public pressure preflight failure and observation limits

[The first public pressure attempt](public-wan-v4-c1-attempt1.json) is failed
and retained. Its models GET succeeded in approximately 1.063 seconds; the next
short-stream request timed out after 21.062 seconds with no HTTP status, first
meaningful text or finish. The runner stopped on that failure. None of the
planned 60-second concurrency1/8/16/32 pressure windows ran, and the successful
earlier public/ACP cohorts do not establish that this intermittent path is fixed.
No missing access log is treated as proof that the request never arrived.

[The read-only observer summary](public-pressure-v4-observer1/summary.json)
explicitly marks the failure window NOT_COVERED: all 51 samples, from
05:01:14.340051 to 05:02:04.322438Z, occurred after the public failure ended.
Its measured maximum sampling gap was 1.000377 seconds. During that later
interval all sixteen native/production-Power process identities and executable
hashes stayed fixed, peak whole-card VRAM was 42.3954%, native prompt/completion
counter deltas were zero, and native processing/deferred plus Power request
gauges were zero. These observations make no claim about GPU load or request
arrival during the earlier failure. Power `loaded_models=0` is recorded as an
idle lifecycle observation, separate from the earlier authenticated load probes.

[Read-only TCP inventory](public-tcp-capability-inventory.json), observed at
05:04:07Z, found tcpdump4.99.4 available without file capabilities; no packet
capture was started by this observer. Port8080 listened on a wildcard address,
RecvQ0/backlog128 and SynRecv0. ListenOverflows/ListenDrops were zero;
TCPTimeouts941 and TCPSynRetrans853 are whole-machine cumulative counts and
cannot identify this timeout. The public address was not assigned to a local
interface and its route used bond0 with private source/gateway. This motivates
a separate bounded TCP handshake comparison, not a proven network root cause.

[The finite no-auth/no-inference TCP diagnostic](public-private-tcp-diagnostic1.json)
made sixteen public and sixteen private attempts: thirty returned the expected
401, public attempt14 timed out during connect, and private attempt7 connected
but timed out waiting for headers. [The root flags-only capture](public-tcp-diagnostic1-flags-safe.json)
exported no application payload. [Independent analysis](tcp-clock-diagnostic1-analysis.json)
keeps only bond0's 120 rows, removing 120 duplicate physical-interface rows.
Thirty peer-hash/translated-port groups each show incoming SYN, outgoing SYNACK
and two FIN flags; observed SYNACK response time is 0.020–0.082ms. Neither client
failure can be uniquely assigned to a captured group because ports are rewritten
and peer hashes lack an end-to-end mapping. The capture reports zero kernel
drops; that does not establish delivery before the capture point.

[Ten clock echoes over one persistent SSH connection](ssh-clock-persistent-diagnostic1.json)
finished in 7.765 seconds under a 25-second watchdog without adjusting either
clock. Their offset intersection is server minus Windows
`[6.197358402, 6.545237925]` seconds, width347.880ms. Applying this later interval
to the earlier flags capture conditionally leaves no incoming SYN within either
client timeout interval, but historical offset stability is unproven and no
connection identity links the captures to those attempts. No forwarding device,
loss location or repair is established. Earlier ACP journal comparisons used
uncalibrated wall clocks and cannot precisely associate server requests with
Windows ACP events; the ACP's own monotonic response timings remain valid.

[Selected network-boundary facts](network-boundary-readonly-facts.json) later
observed the Windows public target routed through TAP-Windows/LetsTAP and the
private target through aTrust Tunnel, both virtual interfaces. Server bond/link
error and drop counters were zero at the recorded observation. The two client
paths therefore have distinct observed boundaries; none of these snapshots
identifies a failing device or changes the retained timeout results. No client
adapter, proxy, route, firewall or system clock was modified.

[A later finite per-socket interface experiment](network-per-socket-interface-ab1.json)
kept the fixed public destination and sent no authentication or model request.
All sixteen owned IPv4 sockets selecting the proved physical interface4 received
401, with header times31–63ms/median47ms, interface readback4 and actual source
hash matched to that interface. Of sixteen default-route attempts, eight
received401 and eight timed out during connect. These are new network
conditions, not a fix or a software-only speedup.
[The separate qualification wrapper](public-selected-interface.py) and its
[eleven hermetic cases](public-selected-interface-fixtures.json) preserve the
original public helper/corpus/runner hashes, require exact target/socket/source
and option checks, stop without fallback and retain old namespaces. Independent
review passed; authenticated selected-interface qualification was executed only
after the shared campaign ended and its private wrappers were stopped. Its phase
order and changed network factor were declared in the plan before execution.

## Completed specified-interface public qualification

[The unique public run](public-selected-interface-v4-summary.json) passed all
four60-second dispatch cells at concurrency1/8/16/32, with120-second request
deadlines and no automatic retry. It reached actual production Gateway8080;
the original public helper, corpus and four frozen instruments remained unchanged.
Only this process's fixed-target IPv4 sockets selected proved interface4.

| Concurrency | Success / HTTP429 | Verified requests/s | Authoritative output tok/s | Successful p95 TTFT / completion / first-tool ms |
| --- | ---: | ---: | ---: | ---: |
| 1 | 54 / 0 | 0.873 | 88.522 | 313 / 1943 / 344 |
| 8 | 374 / 0 | 6.029 | 613.177 | 250 / 2312 / 256 |
| 16 | 536 / 131 | 8.621 | 827.267 | 1047 / 3270 / 1075 |
| 32 | 500 / 3994 | 8.079 | 851.061 | 1046 / 3328 / 1095 |

Measured totals are1464 successes,4125 HTTP429 refusals,147617 authoritative
completion tokens and zero other outcomes. Four authenticated models checks
and sixteen successful functional requests precede the measured cells and are
counted separately. Rates include completion/drain; p95 values describe one
controlled cell per concurrency, with buffered requests excluded from TTFT and
tool timing based only on actual tool output. Refusals are not successful work.
The frozen public runner does not retain429 error codes, so these are HTTP429
counts rather than proven closed admission-code counts.

[Independent per-record audit](public-selected-interface-v4-audit.json) verified
every success's expected predicate, finish/terminal, authoritative usage and
wire equality, recomputed global/case summaries, and matched all5609 socket
checks exactly to models+functional+measured requests. Per-cell socket counts
were59/379/672/4499, all interface set/readback/source-verified, failures0 and
fallbackfalse. The safe [public evidence archive](public-selected-interface-v4-evidence.tar.gz)
SHA`9c21a66b1f1f3f211c4a125bc4ffc59dd7dc04321656a1b4483d02868bd92f9f`
has24 independently checked members, with an explicit
[manifest](public-selected-interface-v4-archive-manifest.json); no ACL, key,
session state, raw journal, packet payload or live output log is included.

This qualifies the declared fixed corpus through public8080 under the specified
outgoing interface. It does not repair the retained default-route timeout,
establish software-only WAN acceleration, identify all intermediaries or test
Work/Darwin. The45–50% slot benefit comes from the separate matched same-GPU
study, not from comparing these changed network conditions.

## Final production state and audit

[Final actual readiness](production-final-v4-readiness.json), recorded
05:37:07–05:37:13Z after load ended, passed an authenticated exact-model/correct
completion/loaded-state probe on each of eight workers, followed by root-owned
geometry/admission/idle/VRAM checks. Every native/Power PID and start identity
remained fixed, each worker retained two32768-context slots and finite active2,
and the Gateway retained the pinned eaf9f4ca artifact/listener8080. Protected
configuration/credential metadata and all sixteen worker generations matched
the actual Gateway cutover receipt. No service change occurred during these
final checks. [The offline operational audit](final-operational-audit.json)
independently checked the shared archive, public result and final receipt.

Before these runs, the plan recorded a fresh isolated single-GPU namespace and
a separate live-production eight-card attribution contract. The isolated canary
stopped only production Power7 while the other seven continued serving. The
later eight-card instrument kept public service active, requiring strict actual
usage/quality/identity/own-cleanup and per-GPU native counter lower bounds, and
recording unexplained native surplus. It reports verified own goodput; it must
not claim exclusive native throughput or a production-wide admission limit.
The original four instruments, their historical results and the failed canary
remain unchanged. No new run is accepted from planning or fixtures alone.

Power waiting observations need a precise interpretation: the limiter increments
its waiting metric before the bounded controller acquire and removes it after a
refusal returns. A returning rejected attempt can temporarily make that gauge
exceed eight, although the controller queue stays bounded. Running observations
still follow acquired permits. The new shared instrument records waiting as an
admission-attempt gauge and requires it to reach zero for own cleanup; it does
not treat its peak as queue-permit proof. Actual queue8/1000ms evidence comes from
the sealed typed configuration, pinned controller tests and isolated overload
case. Follow-up, outside this rollout: expose exact controller queue occupancy
from `src/server/limiter.rs` through `src/server/worker_observation.rs` if a queue
occupancy metric is required, retaining the current attempt observation separately.

## Explicitly not claimed

- Intrinsic single-request decode acceleration, native-exclusive eight-card
  capacity, production-wide admission from the private wrapper pool, or a
  software-only public-network speedup.
- Repair of the default VPN route, unknown NAT/forwarding devices, Work UI or
  the original Darwin client; authenticated cross-tenant KV isolation; or all
  repository checks passing despite the recorded baseline CI/format failures.
- Direct DeepInfer/SM100 compatibility, target-file MTP heads, compatible draft
  weights, distributed KV transfer, or GPU-stop acknowledgement from HTTP close.
- Source updates alone do not identify the code in a running binary.
