# Shared production native qualification, v2

The unique `live-v4-v2-full1` run passed all 12 cells: three repetitions of
60-second dispatch windows at global concurrency 1, 8, 16 and 32. Every cell
first ran four controlled workloads on each of eight GPUs. No automatic retry
occurred. The helper process exited and returned all planned model load.

This measures owned requests through eight private Gateway/Power wrappers that
share the production native engines. The private Power wrappers form a second
admission pool. These results do not establish native-exclusive capacity,
production-wide admission, public port 8080 capacity, a causal before/after
ratio, or cancellation correctness under shared traffic.

| Global concurrency | Own verified requests/s, median [min, max] | Own authoritative output tokens/s, median [min, max] | Successful request p95 duration median | First meaningful token p95 median |
| --- | --- | --- | --- | --- |
| 1 | 0.7633 [0.7543, 0.7660] | 72.509 [71.659, 72.773] | 2.402 s | 0.644 s |
| 8 | 6.2589 [6.2297, 6.2711] | 642.028 [640.072, 643.276] | 2.329 s | 0.547 s |
| 16 | 9.0215 [9.0062, 9.0289] | 915.550 [914.000, 916.301] | 3.031 s | 0.670 s |
| 32 | 9.6417 [9.5575, 9.6856] | 902.840 [900.956, 910.368] | 3.927 s | 1.315 s |

The rate denominator includes all dispatched owned requests through their
completion and drain. Latency percentiles describe the controlled workload
mixture; tool calls have a separate first-tool distribution in the raw cells.
The repetitions are separate samples, not a pooled percentile estimate.

Measured outcomes were 4747 successes and 1631 closed admission refusals
(`admission_queue_full` or `admission_queue_timeout`), with zero transport,
HTTP, timeout, cancellation, malformed stream or output-quality failures.
All refusals occurred at concurrency 32. Successful measured requests reported
468683 authoritative completion tokens. The 384 successful warmups are counted
separately from measured throughput.

Every successful request passed exact expected text or tool quality, authoritative
upstream usage, wire-usage equality, and complete finish/terminal checks. An
offline audit repeated these checks and recomputed both warmup and measurement
accounting independently for every GPU. Each GPU's native completion delta was
at least its own verified completion count. Unattributed completion deltas were
zero for every GPU in all warmup and measurement intervals. Their classification
remains unknown; global counter observations do not establish exclusive ownership.

All twelve cells ended with all three private Power request gauges zero,
admission active/waiting zero and loaded-model readiness intact. Both resource
monitors terminated without errors. The highest whole-GPU VRAM fraction observed
was 0.4239537535 (GPU 6); the guard remained 0.90. Final identities for all 17
production native, Power and Gateway units matched preflight.

The v2 lifecycle rule accepts production bookkeeping unloading only with the
pinned authenticated same-generation receipt and current strict health/profile
checks. Private wrappers may be cold before warmup only with authenticated alias,
GGUF path/hash and fresh-home registration proof. All four warmups on every GPU
must succeed before strict loaded readiness applies throughout measurement and
cleanup. The real GPU 7 receipt's earlier Power apply generation is explicitly
historical; its current authenticated Power generation and unchanged native
geometry generation are checked separately.

Frozen source SHA256:
`a5e84e3e69abf3b3dc05fe4ff959c34aadce33b67b9d94bdc31ec34962d94a8b`.
Fixture SHA256:
`60872d7d638be942223c33d9ed8ca2e5ae70212e67809f69b667dbd3cf87d9b5`.
Windows and Linux each passed 16 fixtures, including the actual root receipt,
absolute detached-response deadline, and full warmup/measurement/cleanup wiring.
The independent Power reviewer reran the fixtures and reported PASS.

Remote evidence is rooted at `/code/Power/.git/optimization-20261021`:

- `eight-replica/live-v4-v2-full1/`: manifest, twelve raw cells and completion proof.
- `live-v4-v2-full1.log` and `live-v4-v2-full1-launch.json`: unique process record.
- `live-v4-v2-full1-proof.json`: offline audit and three-repetition statistics;
  SHA256 `3c4dbdcc14cf2dc7ea2f05b5114b9ebd81de5490f7f5e5cd30ae4301667ab01f`.
- Completion proof SHA256
  `94172884407670d5ddd95e9d5a7348c54c16d38bebbe80772c32c66d906f3b8c`.
- `live-eight-v2-fixtures.json`, `live-eight-v2-fixtures.log` and
  `live-eight-v2.diff`: Linux fixture result and v1-to-v2 review delta.

The earlier shared-v1 source and fixtures remain unchanged and unexecuted.
Prior failed bootstrap, canary and public attempts remain separate evidence.

The complete archive was downloaded after the public measurement window:
`live-v4-v2-full1.tar.gz` (5523914 bytes), SHA256
`a9dfe1aa92c84763a9097607d459fc55e1daa9017ed1a030ab453ccfbcbc39a0`.
Its explicit 34-member inventory is `live-v4-v2-full1-archive-manifest.json`,
SHA256 `2f3de519a547e5908a74e37e88cdaad82b3c70fa77bcf8a5fa9c9e0f97f020da`.
Local verification checked every member's size/hash, unique safe relative
paths, regular-file type, and source/fixture byte equality with this checkout,
without extracting the archive. The result is
`live-v4-v2-full1-local-verification.json`.
