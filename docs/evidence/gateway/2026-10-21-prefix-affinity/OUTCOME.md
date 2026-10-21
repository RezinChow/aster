# Prefix affinity across inference targets

Implemented, qualified, and deployed to the production Gateway. The public
55K-token continuation completes in 0.719 seconds, with its first meaningful
SSE frame at 0.672 seconds and only 32 newly evaluated prompt tokens. These
are bounded synthetic measurements, not fleet latency percentiles.

## Problem and intended behavior

Contemporaneous WorkBuddy v5.8.3 requests were routed across independent GPU
targets. Native logs showed 38K–60K input tokens taking 15–30 seconds to prefill,
while decoding proceeded at roughly 65–77 tokens/second. Existing worker
affinity runs after target selection, so it cannot preserve locality across
these separately configured targets.

The bounded change adds opt-in prefix affinity before target selection, inside
the already authorized protocol and priority group. It retains only salted,
credential/model/endpoint-scoped fingerprints, caps their lifetime and count,
and yields locality to local outstanding-request pressure. It does not truncate
history, move KV tensors, or trust client usage metadata. Catalog projection
must preserve identities for unchanged exact source descriptors so its polling
does not reset locality on refresh. The default catalog interval is 30 seconds;
the existing production interval is 3600 seconds and was preserved.

## Result and performance

`prefix_affinity = true` is an explicit ACL model/catalog option. Production
enables it on the existing console catalog. Absence retains weighted target
selection. Recent longest-prefix hints may prefer a target within one
outstanding operation per healthy backend of the least loaded pool. Cold
traffic uses existing weights among least loaded pools. Current authorization,
protocol, task-routing candidates, priority, health, and backend admission remain
authoritative. No inference body is truncated or rewritten by this feature.

The private five-minute LRU contains at most 4096 fingerprint/target entries.
Each request hashes at most 256 KiB and 128 checkpoints. Fingerprints are scoped
to route, environment, authenticated identity/generation, model, endpoint, and
explicit caller cache namespace. Only canonical inference fields affect them;
the twelve WorkBuddy annotations cannot change tool arguments or real usage.
Exact catalog descriptors now preserve model/target identities across refresh.
See [the implementation guide](../../../../apps/gateway/docs/prefix-affinity.md).

All measurements use synthetic text and tool messages, without private client
state. Gateway cases carry all twelve observed WorkBuddy annotation fields.

| Evidence | Case | First meaningful SSE | Complete | Native reuse on continuation |
| --- | --- | --- | --- | --- |
| [Native pair](native-cache-pair.json) | Cold / continuation | 26.686 s / 0.377 s | 26.706 s / 0.397 s | 55128 cached, 20 newly evaluated |
| [Same-build canaries](canary-benchmark.json) | Affinity off, tool result | 29.105 s | 29.154 s | 0 cached, 55531 newly evaluated |
| Same canaries | Affinity on, tool result | 0.413 s | 0.461 s | 55496 cached, 32 newly evaluated |
| [Production public pair](public-cache-benchmark.json) | Cold tool call | 27.532 s | 27.953 s | See actual upstream timing metadata |
| Same production pair | Tool result, same tools | 0.672 s | 0.719 s | 55495 cached, 32 newly evaluated |

The same-build continuation comparison is about 70.5 times faster to its first
meaningful frame. The production cold/warm pair differs by about 41 times; it
is not a second production A/B experiment. Tests reconstruct the actual call ID
and `bench_sum(19,23)`, replay `42`, require complete SSE and finish reasons,
and verify reported prompt usage above 55K. No history was truncated.

[public-long-tools.json](public-long-tools.json) retains a colder counterexample
from the existing compatibility harness: its continuation removes the entire
`tools` definition, changing the rendered prefix. Both protocol checks pass,
but take 28.047 s and 27.578 s. This result was not replaced by the faster
same-tools case. Changed tools or early system prompts may require recompute.

## Validation and baseline failures

The existing GPU-host root workspace uses Rust 1.97.1:

```sh
cargo test --locked -p a3s-gateway --lib prefix_affinity
cargo test --locked -p a3s-gateway --lib
cargo build --locked --release -p a3s-gateway --bin a3s-gateway
cargo fmt --all -- --check
```

- [Focused suite](final-focused-v3.log): 14 pass, covering real HTTP/SSE tool
  replay, disabled-option rotation, busy-owner avoidance, priority/health,
  credential/model/endpoint/cache namespaces, TTL/LRU bounds, and catalog reload.
- [Full library run](final-library-tests.log): 2055 pass, 5 fail, 5 ignored.
  [Baseline isolation](baseline-isolation.json) reruns every failure alone,
  then reverses this feature and reruns them again against the exact preserved
  pre-existing source. All five reproduce without this feature.
- [Release build](release-build-v3.log): succeeds.
- [Local type check](local-typecheck.log): `cargo check --offline -p
  a3s-gateway --tests` succeeds. The pre-existing lockfile needed a resolution
  change; it was restored byte-for-byte. Local Windows tests also encounter
  pre-existing ONNX Runtime CRT link conflicts, so executable tests ran on Linux.
- [Changed-file formatting](changed-format.log): 21 Rust files pass. The full
  Windows command encounters OS error 206 ([record](full-format.log)); Linux
  reports existing layout differences ([record](full-format-linux.log)).
- `python tests/workspace_dependencies.py`: five of six checks pass; the
  existing desktop-fixture check cannot find
  `apps/work/data/product-aliases.json` in this worktree. That separate desktop
  migration was not modified.

The exact unrelated follow-ups, with paired `current-isolated-N.log` and
`baseline-isolated-N.log` records, are:

1. `embedding_and_rerank_suppliers_replace_the_platform_model` and
   `platform_aliases_fail_closed_without_weights_but_proxy_aliases_still_route`
   (platform_model_tests, records 0/1): reconcile installed-weight and supplier
   fixtures with their existing runtime behavior.
2. `test_gateway_keeps_serving_when_the_management_plane_cannot_start`
   (gateway::tests, record 2): reconcile the existing management-startup
   expectation.
3. `matches_only_the_closed_endpoint_and_method_set` (openai_request::tests)
   and `admission_keeps_only_the_openai_core_and_platform_models`
   (standards_tests, records 3/4): reconcile closed endpoint expectations with
   the pre-existing rerank admission change.

After deployment, [public compatibility](public-compatibility.json) passes
15/15 and [private compatibility](private-compatibility.json) passes 20/20,
including embedding, rerank, System One, and OCR. Unknown fields still return
400; missing credentials return 401; forged client usage is discarded.

## Source, deployment, and rollback

The uncommitted local feature patch is based on
`42be4322066801bda111d4ca02c6b795b84a34f8`. It applied with `git apply --check`
to the existing GPU-host checkout at
`557ae55622b9fba26b10559ab3bac710e1cde09c`, preserving its four pre-existing
edits. The exact deployed source is reconstructible from that GPU-host base,
[pre-existing-source.patch](pre-existing-source.patch), and
[source.patch](source.patch):

- Pre-existing patch SHA-256:
  `596b5652f96b2fdcdee05acff2372224ac4e7d714c71c8893693519448c142d9`.
- Feature patch SHA-256:
  `c116c8d41c7964712dfb94bd8b441f98f51c0159e431abafe0a196365f1e6837`.
- Qualified/deployed binary SHA-256:
  `1fc30e114c47bd23a52053ccc51bc92c64789854b4dce4db4f0ddff4f84241a4`.

[deploy.py](deploy.py) verifies the qualified binary/source, validates the
candidate with the native ACL parser, waits for an idle window using
authenticated management metrics, and installs
`95-prefix-affinity-20261021.conf`. The [deployment record](deployment.json)
shows zero active requests before restart and 0.515 seconds to catalog
readiness. A production probe with all twelve annotations returns actual usage
of 17 prompt and 2 completion tokens. All eight Power hashes and process IDs,
and all native process IDs, are unchanged.

Rollback retains the preceding binary and the original server ACL at
`/etc/a3s/backups/20261021-prefix-affinity/gateway-prism.acl`. Restore that ACL,
remove only this feature's 95-series override, reload systemd and restart to
restore the preceding generation. The helper does this automatically if its
post-switch checks fail. An initial helper preflight hit a Python name collision
before changing live configuration or systemd; it was corrected and the next
run succeeded after verifying matching staged files.

[audit.py](audit.py) and [final-audit.json](final-audit.json) verify the running
hash, active/enabled service, persistent ACL opt-in, exact source members,
source layers, and absence of process credentials in evidence. Both owned
loopback canaries were retired. [retained-artifacts.json](retained-artifacts.json)
binds the downloaded build/test/source records. No commit or push was performed;
the user's unrelated root-worktree changes remain untouched.

## Reference boundary

DeepInfer revision `9bd9cf243fc53ef9afbf8f04d391d989117d6ab9` was inspected:

- [README](https://github.com/deepseek-ai/DeepInfer/blob/9bd9cf243fc53ef9afbf8f04d391d989117d6ab9/README.md)
  explicitly excludes a complete KV cache system and cross-replica balancing.
- [scheduler.hpp](https://github.com/deepseek-ai/DeepInfer/blob/9bd9cf243fc53ef9afbf8f04d391d989117d6ab9/csrc/engine/scheduler.hpp)
  provides the reference for keeping scheduling bounded by execution pressure
  and prefill/cache budgets. Gateway implements HTTP target locality; it does
  not import DeepInfer code, kernels, or model-specific SWA truncation.

## Explicitly not claimed

- A fingerprint match is a routing hint, not proof of resident backend KV.
- Local Gateway outstanding requests are not fleet-wide queue telemetry.
- Cold 55K-token requests still require approximately 27–30 seconds. Changed
  tools, early prompt changes, eviction, pressure-based rerouting, or process
  restarts can prevent reuse.
- This is not a concurrent fleet stress test, p95/p99 claim, KV transfer system,
  or new backend cache-capability attestation.
- The user confirmed normal WorkBuddy replies before this optimization. A new
  client-side speed report was requested asynchronously; no speed confirmation
  is attributed to the user without their reply.
- Whole-workspace tests and formatting are not reported as passing.
