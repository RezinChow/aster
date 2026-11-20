# Cutover diagnosis

Updated: 2026-11-19 · deterministic Core settlement · **full Core lib passed: 5975 / 0 failed / 33 ignored**

## Cutover blocker

- The old fixture expected `generation-one` / `generation-two` inside the generic `task` Tool description. Current registry versions are carried by the response and child Agent system prompt instead.
- `observe_task_definition` returned Err before signaling `old_surface_observed`; the main test then waited indefinitely. The parent made a second call, proving an evidence-location/test-synchronization failure rather than a production deadlock.
- The fixture retains the task-definition existence check and keeps version assertions in the actual response and child prompt. No production source was changed for this blocker.
- Result: the formerly blocked test completes in 0.82s; agent_projection 2/2, access_projection 4/4, fact_log 87/87, and governed 9/9 passed in the preceding focused runs.

## Independent failures closed in this settlement

1. **Package binding fixtures** — `context_projection` and the shared `test_package_binding` used a stale hard-coded capability snapshot digest. Both now use the existing `package_binding_for_generation` constructor. The context binding and detached-binding tests each pass 1/1.
2. **Plan snapshot fixture** — `update_plan` was hidden by the default no-confirmation permission policy, so no TaskUpdated event existed. The fixture explicitly allows only `update_plan`; the original single six-item update, persistence, and resume assertions remain. The test passes 1/1.
3. **Live worker catalog fixture** — registry details are asserted in the task agent schema rather than the generic tool description. After unregister, both the schema description and examples must remove the worker. The test passes 1/1.
4. **Long-horizon receipts** — the compatibility top-level `output` is empty; canonical content is in `receipt.output`. Six affected assertions now read the canonical receipt. No production output was duplicated or backfilled.
5. **Unstreamed-final-text fixture** — text/settle assertions were already correct, but the deterministic Bash sandbox was never called under the default permission policy. The fixture explicitly allows only `bash`; its execution/release assertions remain.

The complete `agent_api::tests::long_horizon_capabilities` module then passed **18/18** serially, including real workspace edit/suite choreography, crash/resume, failed-read budgets, canonical receipts, and unstreamed final text settlement.

## Additional failures exposed by the first serial sweep

The first serial sweep was stopped after exposing five independent failures because its sources would be stale after the following confirmed fixes. Its red evidence is preserved in `core-lib-serial-prefinal-failures-2026-11-19.log`.

1. Path-instruction fixtures lacked `read` admission. Both positive cases and the negative control now execute the read, avoiding a false negative control. Path instructions pass **3/3**.
2. Worktree settlement lacked `git` admission and read the retired top-level output. It now admits only `git` and reads `receipt.output`; creation and settlement cleanup pass **1/1**.
3. Three more copies of the stale package digest in capability projection, Run tests, and `deep-live` operation coverage now use the same binding constructor. Projection passes **1/1**; Run tests pass **56 passed / 2 ignored**; `opcov_package_current` passes **1/1** with `deep-live`.
4. UI golden identities still used the pre-migration `a3s-code-ui` domain even though commit `0935a85a6` changed the public domain to `aster-ui`. The document and surface goldens now match the current domain and pass **1/1**; asset bytes and digest algorithm were not changed.
5. `deep-live` compilation also contained an orphan `RecordingExecutor` impl whose type and trait no longer existed and which had no callers. Removing that dead impl allowed the real feature-gated test to compile and run; no test was removed.

The earlier `op_coverage` and `op_coverage::opcov_package_current` default-feature filters each matched **0 tests** and are explicitly not counted as verification. The passing command used `--features deep-live --lib opcov_package_current` and reported one test.

## Second serial sweep: 5970 passed / 5 failed / 33 ignored

The complete second sweep finished in 624.81s and is preserved in `core-lib-serial-second-five-failures-2026-11-19.log`.

1. Three FactControl assertions still read the retired top-level output; all four affected lookups now use `receipt.output`.
2. The question-cap case passed alone but failed in the serial suite. A deterministic two-Run reproducer proved that the unnamespaced `q-N` cap-check elicitation ID collided with another Run's pending ID, causing `begin` to roll back the question count. The production cap-check ID is now namespaced by Run. The new counterexample failed before and passes after; FactControl **59/59**, agent fact_log **87/87**, and ask_user **8/8** pass.
3. WorkPolicy's golden digest was also left behind by the `a3s` → `aster` schema migration. It now matches the current domain; WorkPolicy **8/8** passes.

## Final serial settlement

The third attempt ran beside final Clippy/build jobs and exposed timing-sensitive failures in hook projection and MCP cancellation. It was stopped early and preserved in `core-lib-serial-third-parallel-timing-2026-11-19.log`. Both tests passed independently without a source change.

The fourth exclusive attempt still exposed the MCP timing failure and was stopped for module diagnosis (`core-lib-serial-fourth-mcp-timing-2026-11-19.log`). The MCP module passed 6/6, while the complete capability-runtime suite reproduced a hook cutover admission race: blocking error return preceded guardian retirement, and the fixture immediately started another send. The fixture now waits for actual original-Run retirement; production error-return semantics were not changed. Capability-runtime then passed **74/74**.

The final exclusive full-Core run against the frozen sources completed in **608.96s: 5975 passed, 0 failed, 33 ignored, 0 filtered out**. See `core-lib-serial-final-2026-11-19.log`. Final Core Clippy and paired Aster/ACP build both exited 0. The earlier stopped runs remain diagnostic evidence only.
