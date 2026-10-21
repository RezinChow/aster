# Implementation plan

Extend Gateway's opt-in prefix-affinity owner rather than add another routing
authority. Observe the upstream response before translation using a bounded,
pass-through body. Train only at valid terminal EOF. Keep raw prompts and
fingerprints out of logs and evidence. Use RAII for outstanding work.

Constitution check: fail closed and closed protocol sets; owner-local hermetic
tests; root workspace and local dependencies; ACL opt-in unchanged; no Cloud
contract, schema, authority, product UI, or new repository. Evidence retained.
All applicable principles pass by design and require implementation evidence.

Native tuning follows a single drained replica, measured baseline/candidate,
restoration rehearsal, then guarded rolling promotion only after a gain.
Reuse 005's rejected NUMA/graph/MMQ/speculation evidence; changing context or
quantization is outside the promotion gate. Retain any failed experiment.

Required gates: finite synthetic workload; identical model and effective
context; no unexpected errors; meaningful-output TTFT and authoritative token
usage; tool/text correctness; cancellation and admission recovery; no greater
than 10% repeated ordinary-load latency regression; record variability and
never promote on one favorable sample. No full CI green claim on baseline
failures.
