# Rig6 slot study

All six phases and 24 cells passed: three paired repetitions, c1/8/16/32 for
60 seconds each, NP1→NP2 / NP2→NP1 / NP1→NP2 on the same physical GPU6. Both
arms used new Power `038e96fb…` and new Gateway `eaf9f4ca…`. Only total context,
slots, and matching Power active admission changed. Each slot retained context
32768; NP1 total context32768 and NP2 total65536. Runtime speculation was off.

The driver required both provenance documents to load and compare before any
phase, then strictly reconciled every successful warmup and measured request's
wire/upstream usage with native completion counters in both arms. There were
1,406 measured successes, 54,146 bounded admission refusals and zero unexpected
outcomes. No phase was retried. Warmup output is separately included in the
whole-phase native reconciliation. Elapsed campaign time: 1,613.68 seconds.

Medians across the three repetitions (ranges retained in the JSON):

| Concurrency | NP1 native tok/s | NP2 native tok/s | NP2/NP1 | NP1 p95 completion ms | NP2 p95 completion ms |
|---|---:|---:|---:|---:|---:|
| 1 | 84.08 | 84.01 | 1.00 | 2116 | 2117 |
| 8 | 84.96 | 127.35 | 1.50 | 3032 | 3975 |
| 16 | 88.12 | 127.35 | 1.45 | 3068 | 4163 |
| 32 | 88.41 | 131.16 | 1.48 | 3101 | 4142 |

These are descriptive medians of per-cell p95 values, not a pooled tail
estimate. At load, NP2 increased aggregate output throughput but increased p95
completion latency about31–36%. Streaming p95 TTFT medians increased from
1332/1354/1331ms to1386/1411/1408ms at c8/16/32. Buffered requests have no observed
first-token time. Refusals are not successful served requests or goodput.

The archived raw evidence contains 67 files, including driver/source,
preflight comparison, per-phase full usage audits, Power metrics snapshots,
all24 raw cell results, provenance and independent review. Archive
`rig6-formal-evidence.tar.gz` SHA256:
`65b6f6fa9475ab20fdc9508f2b9e10f189fc4f14da4ab8bf429aa38744d79c43`.
Every archived file hash is in its `formal-evidence-sha256.json`.

Cleanup used exact owned argv/start-time receipts. Private ports19110,
19300/19310 and19882/19883 have no listener, and their dedicated guard exited.
GPU6 returned to8210MiB. Production native18106 PID1335658 and Power18206
PID420496 retained identical process/listener identities and HTTP200 health.
See `rig6-cleanup.json` and `rig6-formal-summary.json`.

Explicitly not claimed: production NP2 deployment, intrinsic NP4 impossibility,
managed Gateway frontdoor coverage, or statistical significance beyond this
fixed corpus and three repeated load cells.
