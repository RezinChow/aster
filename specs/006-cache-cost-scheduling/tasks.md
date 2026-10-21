# Tasks

- [x] T1 Preserve current source/binary/config provenance and baseline.
- [x] T2 Implement bounded terminal response feedback, refusal/cancellation tests.
- [x] T3 Implement measured cost scheduling and RAII work reservations; test
  stale/missing/invalid telemetry, weighted cold fallback and scope/health rules.
- [x] T4 Evaluate native microbatch/prefill alternatives, retain rejected trials.
- [x] T5 Run owner checks and matched canary text/tool/cache/load/cancel tests.
- [x] T6 Guarded deployment, restore rehearsal, public-client verification.
- [x] T7 Reconcile capability matrix, exact results and explicit limitations.

Acceptance: `docs/evidence/gateway/2026-10-21-cost-scheduling/OUTCOME.md`.
All source changes and safe runtime dispositions are complete. Unsupported
capabilities and rejected profiles remain explicit; global baseline failures
are retained and are not relabeled as passing.
