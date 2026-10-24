# 009 implementation preflight analysis

Date: 2026-10-22. Read-only comparison of `spec.md`, `plan.md`, `tasks.md`,
the constitution, and current manifests before feature implementation.

| Finding | Severity | Source / task | Resolution |
|---|---|---|---|
| Power is an initialized submodule with a nested standalone workspace/lock, absent from root members. | blocker for model feature integration | `crates/power/Cargo.toml`, root `Cargo.toml`; T001 | Reconcile the touched Power package into the root workspace and lock before adding model behavior. Preserve submodule source ownership. |
| Optional ACL resolves to registry and Runtime resolves to a pinned git source, contrary to required local A3S dependency closure. | blocker for model feature integration | `crates/power/Cargo.toml`; T001 | Select existing local ACL/Runtime and adapt the existing Runtime contract without changing its policy. Run metadata, dependency guard and focused compilation/tests. |
| The root lockfile, BGE manifest and three Power proxy files already contain in-flight edits. | warning | T001 | Record exact bytes and hashes before edits; preserve them. Never reset, clean or restore the shared lockfile from HEAD. |
| Full-model P1 originally needed an eight-card capacity path before optimized P2 collectives. | note, addressed in current plan | plan P1, T009/T012 | Current T009 explicitly implements safe layer placement and peer transfer first; efficient TP/EP remains T012. No dependency cycle. |
| Full-model numerical tolerances and H200 profile remain calibration outputs. | warning | T002/T003/T023 | Freeze before candidate measurements; absence does not certify implementation or performance. |
| All five stories, twelve requirements and final gates have producing tasks. | note | T001–T025 | Retain per-task evidence and gate later phases on actual results. |

Verdict: resolve T001's existing build-boundary blockers first. Other model
feature implementation remains gated until that reconciliation is verified.
No permission or constitution exception is inferred from the existing nested
workspace. Baseline root `cargo metadata --locked --offline --no-deps` passed.

Baseline source/lock snapshots are retained under the ignored task directory
`target/h200-native/t001-before`; only public source/build inputs were copied.

## T001 reconciliation verification

The build-boundary blockers above are resolved for model implementation:

- Root locked/offline metadata now lists Power, the model owner and both
  private compatibility packages as unpublished root members.
- `cargo check --locked --offline -p a3s-deepseek` passed after final member
  and lock resolution (`native-minimal-check.log/json`).
- The vendored parser/serializer library tests passed: 5 + 26 tests
  (`dependency-compatibility-offline-tests.log/json`). Public archives were
  verified against root-lock checksums; failed network attempts are retained.
- Power's local Runtime 0.8 integration passed all three existing
  `runtime_service` tests with `--no-default-features --features server`.
- The full dependency guard ran six tests: five passed; the desktop build
  script fixture failed, and its isolated rerun reproduces the failure. Its
  stub lacks the current Tauri/embed-resource API. This task did not edit the
  desktop owner or the guard. Local A3S/publish and workspace checks passed.
- The full format command hit Windows command-line length error 206. The
  drift guard reports 61 existing shared-copy findings; Power and the two
  new vendor packages do not have matching names in the other lineages.
  These broad failures remain final-gate limitations, not successful checks.

Follow-up verdict: ready for P0 mathematical reference and model-owned
implementation. GPU deployment/promotion remains gated on the remaining
tasks and final checks. No native model or performance result is inferred
from these build and compatibility tests.

T002's source/model audit is retained in `native-gap-matrix.md`, with all 48
official shard header hashes and exact dtype totals in
`remote-official-headers.json`. Payload hashes and native CUDA execution
remain unverified. Requirement coverage now includes FR-013 / T026 for the
user endpoint and temporary credential delivery.

## Resume analysis, 2026-10-23

Read-only recheck of the current spec, plan, tasks, constitution and worktree:

| Finding | Severity | File / task | Resolution |
|---|---|---|---|
| T001's root/local dependency reconciliation is still in place; the interrupted decoder and 53-participant state code pass all 281 tests on re-run. | note | T001/T007; `resumed-281-tests.*` | Continue T007's official parameter binding. |
| FR-001–013 and all five stories retain producing tasks, including the real native endpoint/temporary credential contract. | note | `spec.md`, `plan.md`, T001–026 | Keep full goal and original official/XQ acceptance boundaries. |
| CUDA/full-model execution and final gates remain incomplete; fixture success cannot certify deployment. | warning | T007–026 | Keep these tasks open until their actual execution evidence exists. |
| Workspace formatting hits Windows error 206; the desktop build-script fixture fails independently; the drift report retains 61 findings. | warning | final gate | Preserve separate failures; no allowlist/desktop changes in this slice. |

Verdict: ready to continue T007. No new constitution, coverage, ambiguity or
scope blocker was found. This verdict does not certify GPU deployment.

## XQ-priority implementation recheck, 2026-10-23

Read-only review of the updated spec, plan and tasks preceded the bounded
XQ format slice; task dependency edits were a separate implementation step.

| Finding | Severity | File / task | Resolution |
|---|---|---|---|
| XQ CPU format validation does not require the queued official SM90 qualification. | note | T008/T022 | Explicit dependencies permit the format slice first; all CUDA/model gates remain open. |
| New server-optimization and pressure requirements have producing tasks and final gates. | note | FR-014/015, SC-007/008, T012–027 | Basic deployment stays intermediate; optimization and sustained/fault testing remain required. |
| The shared root was changed by a concurrent stash/pull workflow. | warning | worktree inputs | User-authorized selective recovery and an isolated in-repository Git worktree preserve both tasks; do not overwrite the main worktree. |
| Package/CPU evidence does not cover payload integrity, CUDA projections, complete generation, service, performance or pressure. | warning | T008–027 | Keep each task open until its own authoritative evidence exists. |

Verdict: ready to continue bounded native XQ storage/device implementation
in `.wt-h200-native-deploy`; not ready for deployment promotion or goal
completion. No new configuration language, nonlocal A3S dependency, copied
desktop source in the parent, or waived ratchet is introduced by this slice.
