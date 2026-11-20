# T2026-11-18-similarity-audit

Updated: 2026-11-18 · scope: same-class defects after the five fact_log repairs · **two additional defects fixed; full-suite blocker isolated** · **≠ product Pass**

## Answer

Yes. Two additional same-class permission-visibility defects were demonstrated with
failing executable counterexamples and then fixed:

1. **Upper argument-scoped Allow could be hidden** — the runtime wrapper probed an upper
   checker with empty arguments and treated its Ask as no capability. Visibility now
   follows the upper checker's `expose_to_model` contract; execution-time checks remain
   authoritative. `runtime_upper_argument_allow_stays_visible_without_a_confirmation_route`
   failed before and passes after.
2. **Instruction-skill special handling could bypass its own Deny** — visibility and
   execution now require the wrapper's own policy to remain visible / non-Denied. Upper
   Deny is still honored; unknown and tool-kind skills do not use the instruction-content
   lane. `runtime_instruction_skill_never_bypasses_its_own_explicit_deny` failed before
   and passes after.

A related stale expectation was also corrected: `host-disabled` in
`unchanged_ask_obeys_the_frozen_host_confirmation_authority` had expected an unconfirmed
Ask to execute. It now expects Denied, matching the existing fail-closed safety contract;
actor-confirmed execution remains Succeeded. No production execution was enabled by this
test correction.

Image repair received a two-sided regression test: same-turn activity may stub pixels;
a later user message must reload them.

## Verification

- fact_log: **87/87**.
- nested_governance: **8/8**.
- direct governed tests: **9/9**, including both new red→green cases.
- tool history: **29/29**, including the new two-sided image case.
- safety gate: **12/12**.
- permissions: **128/128**.
- frozen host confirmation matrix: **1/1** after correcting the stale unsafe expectation.
- Core Clippy all targets: **exit 0** (`similarity-clippy-final.log`).
- Aster + ACP paired build: **exit 0** (`similarity-build-final.log`).
- `git diff --check -- crates/code/core/src`: **exit 0**.

## Full-suite limitation

The first parallel full-Core attempt (`core-lib-similarity-audit.log`) produced many
failures under shared-state concurrency and was superseded. A serial attempt
(`core-lib-serial-after-similarity.log`) then stalled at
`agent_api::capability_runtime_tests::agent_projection::active_run_keeps_n_agent_registry_task_binding_and_use_lease_across_cutover`.
The same test was independently stopped after more than 120 seconds without completing.
That blocker is outside the five repaired classes and was not hidden behind a skipped-test
"Pass". No full-Core success is claimed.

## Source review

No remaining material bypass was found in the reviewed wrapper: own Deny and upper Deny
are preserved, upper conditional visibility is not probed with empty arguments, and
instruction-only content does not authorize tool-skill or nested-tool execution. This is
a scoped source review, not whole-product certification.

No commit, push, branch, worktree, release, live-provider rerun, or Windows native check
was performed. USD/token cost for these deterministic checks is unavailable.
