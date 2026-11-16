# acp-protocol-entities-2026-11-16 (P0-4)

## Task

Pin ACP / Core protocol entities and queue semantics with Aster names, and add a golden fixture gate against silent wire breakage. ACP v1 stays the protocol; no Codex `Op` enums, no new bus, no new crate. Wiki DoD: `.kstudio/wiki/Codex-Aster-Absorption.md` §P0-4.

## Changes

- `crates/code/acp/PROTOCOL.md` (new): Session / Prompt / Turn / Run / Model turn / Subagent task vocabulary; the session turn queue vs Core `SessionLane` (Core-internal, not on the wire); wire naming rule and the known `__aster/execution/observe` double-underscore seam; gate list.
- `crates/code/acp/tests/fixtures/acp_wire_surface_v1.json` (new): golden surface (28 host method names, 2 prefix families, `_aster/queue/changed` key set, execution-observe const, turn-queue rules).
- `crates/code/acp/src/agent/host_methods_tests.rs`: `host_method_wire_names_match_the_golden_surface` (every golden name parses; every `HostMethod::ALL` member is listed) and `execution_observe_const_matches_the_golden_surface`.
- `crates/code/acp/tests/acp_conformance_stdio.rs`: two new cases against the shipped binary: `queue-running-identity` (golden `_aster/queue/changed` keys/values, precedes first model output, response echoes `_meta.promptId`) and `turn-queue-order` (second prompt waits; cancelling the running turn leaves the queued prompt to start and end normally). Helper `prompt_with_id`, `wire_golden`, `is_queue_changed`.
- `crates/code/acp/src/lib.rs`: crate doc points to `PROTOCOL.md`.

## DoD checklist

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Short doc pins entities and queue semantics, Aster names | `crates/code/acp/PROTOCOL.md` |
| 2 | Schema/golden fixture that fails on silent breakage | `acp_wire_surface_v1.json`; negative checks below |
| 3 | `acp_conformance_stdio` green and recorded | 15 of 15 cases pass (13 existing + 2 new), exit 0 |
| 4 | No new parallel bus | none added; fixture is data, tests drive existing wire |
| 5 | Evidence, Tasks.md, wiki §P0-4 现状 | this file, `.kstudio/evidence/T2026-11-16-p0-4-acp-protocol/OUTCOME.md`, updated |

## Commands and results

Branch `main` · mac-dev `/Users/roylin/code/aster` · darwin aarch64, toolchain from `rust-toolchain.toml`

```bash
ASTER_ACP_CONFORMANCE_REPORT=/tmp/acp-conf-report.md cargo test --locked -p aster-acp --test acp_conformance_stdio -- --nocapture
# exit 0 · "15 of 15 cases pass" · test result: ok. 15 passed; 0 failed
# first run of queue-running-identity failed ("precede the turn's first update"): mode/command session/update
# frames legitimately precede the announcement. The oracle and docs were narrowed to "first model output update".

cargo test --locked -p aster-acp --lib -- host_method execution_observe
# exit 0 · 16 passed; 0 failed (includes the 2 new tests)

# negative check 1: golden paramsKeys "runningText" -> "runningTxt"
ASTER_ACP_CONFORMANCE_CASE=queue-running-identity cargo test --locked -p aster-acp --test acp_conformance_stdio acp_v1_conformance
# exit 101 · FAIL: queue/changed keys [...runningText...] differ from golden [...runningTxt...]

# negative check 2: golden "aster/session/info" -> "aster/session/infoo"
cargo test --locked -p aster-acp --lib host_method_wire_names_match_the_golden_surface
# exit 101 · "golden host method aster/session/infoo no longer parses"
# both mutations were reverted; the fixture is byte-identical to the verified copy.

cargo test --locked -p aster-acp --no-fail-fast -- --nocapture
# exit 101 · see "Existing failures" below; acp_conformance_stdio, protocol_commands_stdio, client_fs_stdio,
# unattended_e2e, long_horizon_*, retrieval_qualification_stdio and the rest pass

cargo clippy --locked -p aster-acp --all-targets --no-deps
# exit 0 · no diagnostic in host_methods_tests.rs or acp_conformance_stdio.rs (existing dead-code warnings in tests/long_horizon/*)
rustfmt --check --edition 2021 crates/code/acp/tests/acp_conformance_stdio.rs crates/code/acp/src/agent/host_methods_tests.rs
# exit 0
git diff --check -- crates/code/acp
# exit 0
```

## Existing failures in the full run (not caused by this change; not verified on a clean baseline)

The change touches tests, one fixture, docs and a crate doc comment. No product source under `crates/code/acp/src` changed behavior.

- lib `plugin_tools::tests::tool_context_cancellation_stops_the_actual_descendant`: failed under full-suite load, passes alone (`1 passed`).
- `startup_error::first_run_template_is_loaded_before_opening_a_session`: local config names provider `deepseek` without an API key.
- `tui_913_hermetic`: `shipped_binaries_report_current_version` (stale pair BUILD_ID `4a93e62…` vs expected `cca9f5d…`), `core_catalog_history_reaches_the_backend_instead_of_prompt_search`, `model_command_selects_the_catalog_model`.
- `boundary_e2e::e_bash`, `v912_seam::v912_readonly_git_parallel_commit_opens_the_gate`, and `shipped_tui_e2e` (`reasoning::delayed_catalog_keeps_draft_and_explicit_effort`, `shipped_tui_launch_resume_and_visible_commands`): not diagnosed.

## Explicitly not claimed

- Product Pass or daily-stable use
- Full `aster-acp` suite green (9 failures above, undiagnosed or environmental)
- A full JSON Schema of ACP params/results: the golden pins host method names, one notification's key set, and queue behavior only
- Other notifications (`_aster/turn/outcome`, `_aster/session_notification`, `_aster/models/update`, tooling/transcript updates) are not in the golden; `_aster/execution/observe` is pinned only as the code const
- That `__aster/execution/observe` was observed on a live stdio wire here; it is derived from the SDK's `_` prefix rule and Studio's existing alignment tests
- Fixing the double-underscore seam, a `…/v2` migration, or an independent protocol-types crate
- Core `agent_protocol_v1` / `event_protocol_v1` were not re-run
- Linux / Windows runs; Studio changes
