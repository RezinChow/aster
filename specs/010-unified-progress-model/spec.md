# Feature Specification: Unified progress model for harness gates

**Status**: Draft (slice 1 in flight)

**Input**: User feedback 2026-10-22: rules accrete per observed failure with
no unified progress model; the composition deadlocks (read-only ceiling ×
external-observation obligations × acceptance gate requiring workspace
change) and froze a home server on terminal-bench-4 read-only tasks.

## Verified deadlock (file:line)

1. `harness_loop.rs` `unresolved_tool_effects` is a session-lifetime latch:
   one unobserved external effect (schema-unsupported, identity mismatch,
   cache evidence missing) permanently denies EVERY mutating call
   (`receipts.rs` `tool_effect_unresolved`).
2. `verification.rs:1476` + `goal_evidence.rs:141`: completion requires
   ACCEPTANCE verification, which for change-requiring tasks needs the
   mutation that (1) denies.
3. Unattended continuation admits read-only turns until the deadline.

No exit exists. Slice 1 breaks the latch at the weakest edge.

## Slice 1: turn-scoped obligations

An obligation gates mutating calls **within the turn it arose**. At turn
settlement, unresolved non-child obligations are NOT erased (no waiver —
the PR#8 invariant stands): they are **recorded as goal-visible
uncertainty** and stop gating future turns. The completion gate sees the
recorded uncertainty, so tasks whose acceptance depends on the uncertain
effect still fail honestly; read-only tasks complete; the model can act
again.

- FR-1: Mutating calls are denied while a live same-turn obligation
  exists (unchanged).
- FR-2: At turn settle, unresolved non-child obligations move to a
  recorded set that no longer denies mutating calls.
- FR-3: The recorded set is surfaced to goal evidence
  (`verified_turn_text`), never silently dropped.
- FR-4: `workspace-child:*` keys keep their existing settlement path.

## Later slices (not claimed now)

- Policy objects with provenance for every hard threshold.
- Cross-rule satisfiability fixtures in CI (posture × gate × settle).
- Terminal-bench read-only regression subset.

## Evidence target

`docs/evidence/execution/2026-10-22-progress-model-slice1/OUTCOME.md`
