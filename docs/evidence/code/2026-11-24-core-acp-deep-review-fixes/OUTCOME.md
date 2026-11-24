# Outcome: `aster-core` & `aster-acp` Deep Rust Review and Controlled P0/P1 Optimization

- **Date**: 2026-11-24
- **Scope**: `crates/code/core` (`aster-core` 9.3.0) and `crates/code/acp` (`aster-acp` 9.3.0)
- **Host / Toolchain**: macOS (`arm64`), `rustc 1.97.1 (8bab26f4f 2026-07-14)`, `apps/studio` submodule initialized, Python 3.12 (`/opt/homebrew/bin/python3.12`) for `tomllib`-based repository gates. `protoc` is not installed on this host (not required by `aster-core` or `aster-acp`).
- **Pre-existing dirty files preserved untouched**:
  - `crates/code/core/src/fact_control/tool_results.rs`
  - `crates/code/core/src/tools/mod.rs`
- **Red lines preserved**: `publish = false`, local Aster workspace dependency resolution, zero public Rust signature/API changes, zero feature-topology changes, zero ACP wire name changes (`PROTOCOL.md` / `tests/fixtures/acp_wire_surface_v1.json` intact), ACL-only config (`aster-acl`), locked `ksandbox` git dependency, and zero commits made.

---

## Finding-to-Change Mapping

| ID | Severity | Files Modified | Root Cause Fixed | Design Philosophy Preserved |
| --- | --- | --- | --- | --- |
| P0-1 | P0 | `crates/code/core/src/sandbox/native.rs` | `aster_bash_policy` created `.aster/loops` without rejecting symlinked `.aster` / `.aster/loops` pointing outside the workspace. Added `validate_control_plane_dir` (checking `symlink_metadata` + canonical containment inside `workspace`) before and after `create_dir_all`. | Preserved `state_root_override()` non-materialization behavior. |
| P0-2 | P0 | `crates/code/acp/src/approval_learning.rs`, `crates/code/acp/src/approval_learning/tests.rs`, `crates/code/acp/src/agent/permission_ask.rs` | Learned `AllowAlways` bash rules could auto-approve `sandbox_permissions = "require_escalated"` or `"request_network_grant"`. Gated `is_previously_approved` / `is_previously_approved_in` with fail-closed `uses_default_sandbox(args)` (`None`/`Null`/`"use_default"` only) and gated `record_always_allowed_bash` on `ExecutionBoundary::SandboxedDefault`. | Sandboxed default bash learning and workspace rule matching unchanged. |
| P0-3 | P0 | `crates/code/core/src/tools/builtin/read.rs` | `read_image_file` bypassed canonical workspace containment and `DirectFileGuard::refuse_direct_read`, allowing symlink escapes and credential hardlink aliases (`*.png`). Resolved canonical path inside root, verified `is_file()` and size cap, opened once, and enforced `refuse_direct_read` before and after bounded read. | Preserved extension-based `image_media_type` contract (`test_read_image_media_types_follow_extension_and_text_stays_text`). |
| P0-4 | P0 | `crates/code/core/src/workspace/{mod.rs,local.rs,manifest.rs,read_overlay.rs,services.rs}`, `crates/code/core/src/workspace/read_overlay/tests.rs`, `crates/code/acp/src/document_read.rs`, `crates/code/acp/src/document_read_tests.rs` | `OverlayFileSystem`/`OverlayTextReader` and `studio_document_read` invoked host overlay / ACP RPC before checking `CredentialBoundary` and symlink containment. Added `pub(crate)` `DirectFileGuard::refuse_overlay_read` (enforced before overlay reads) and pre-RPC containment + `refuse_direct_read` checks in `studio_document_read`. | Preserved Studio unsaved buffers (`NotFound` on disk remains readable while verifying no ancestor symlink escapes workspace and credential filenames stay denied). |
| P0-5 | P0 | `crates/code/acp/src/agent/session_open.rs`, `crates/code/acp/src/agent/attempt_tests.rs` | `sync_session_mcp_servers` acquired `core_agent` before `sessions`, inverting `load_session -> replace_core_session` (`sessions` -> `core_agent`) and risking AB-BA deadlock. Snapshotted `sessions` before locking `core_agent` to enforce a single global lock order. | Union MCP server desired-state calculation unchanged. |
| P0-6 | P0 | `crates/code/acp/src/agent/{attempt.rs,turn.rs}`, `crates/code/core/src/{ask_user.rs,porcelain.rs,memory.rs,agent_api/run_admission.rs,tools/program_tool.rs}` | 8 `tokio::sync::Notify::notified()` call sites did not pin + `.as_mut().enable()` before checking state, allowing missed `notify_waiters()` wakeups. Aligned all 8 sites with the repo's `tokio::pin!(notified); notified.as_mut().enable();` idiom. | Pure wakeup-race elimination; control flow unchanged. |
| P1-1 | P1 | `crates/code/core/src/{commands.rs,tools/builtin/bash.rs,tools/builtin/bash/tests.rs,tools/registry.rs}` | Production panics: byte slicing `&ctx.session_id[..min(8)]` on multi-byte UTF-8; `.expect(...)` when `command_runner()` is absent; `.read().unwrap()` on `argument_validators`. Replaced with `crate::text::truncate_utf8`, `ToolOutput::error`, and `read_or_recover`. | Output format and tool capabilities unchanged. |
| P1-2 | P1 | `crates/code/acp/src/host_context.rs` | `research_policy` omitted `"patch"`, `"background"`, `"program"`, and `"git"` from `deny_all`, letting `auto`/`yolo` research turns mutate the workspace. Added all 4 to `deny_all`. | Preserved `default_decision` (`Ask` in `default`) and `Skill` in `yolo`. |
| P1-3 | P1 | `crates/code/acp/src/{agent.rs,agent/protocol.rs,agent/turn.rs,agent/goal_ext.rs,agent/turn_input_tests.rs}` | `outputSchema` incompatibility ran after `sendNow` cancel & queue/generation updates; `sendNow` cancelled the running turn before verifying queue capacity (`MAX_QUEUED_PROMPTS = 32`); `turn_permit` dropped before `generate_session_title`, `model_info`, and `finish_prompt`; early errors after `turn_generation` bump skipped `finish_prompt`. Added `TurnQueue::lock_reserved`, validated `outputSchema` and reserved slot before `sendNow`, held `turn_permit` through `finish_prompt`, and routed post-bump errors through `finish_prompt`. | Preserved `PROTOCOL.md` queue semantics, FIFO ordering, `MAX_QUEUED_PROMPTS=32`, `sendNow` cancel-before-wait when slot is available, and detached cancel settlement. |
| P1-4 | P1 | `crates/code/core/src/store/{file_store.rs,tests.rs}`, `crates/code/core/src/tools/builtin/bash.rs` | `FileSessionStore::acquire_writer_lease` and `delete` lacked `acquire_wal_file_lock()` (and `delete` lacked `write_lock`), risking duplicate cross-process lease epochs and torn deletes. Added both locks. In `bash.rs`, idle-watchdog self-cancellation was misclassified as `Cancelled`; tracked `idle_timed_out: Arc<AtomicBool>` so watchdog stalls report `ToolErrorKind::Timeout`. | Preserved `delete` authorization semantics (no lease required) and real user cancellation semantics. |
| P1-5 | P1 | `crates/code/core/src/config/{mod.rs,provider.rs,search.rs,tests.rs}`, `crates/code/core/src/mcp/{protocol.rs,oauth.rs,transport/streamable_http.rs}`, `crates/code/core/src/llm/{anthropic.rs,http.rs}`, `crates/code/acp/src/{grok_account.rs,config.rs}` | Secret-bearing config/token types derived `Debug` in plaintext; `anthropic.rs:404` logged full `{:?}` response; `llm/http.rs` interpolated raw proxy URLs; `StreamableHttpTransport` omitted `set_sensitive(true)`, reused the 60s RPC timeout for GET SSE, logged raw URLs, and buffered SSE/JSON/error bodies without bounds. Implemented redacted `Debug` with synthetic-secret leaf + container canary tests, structured metadata-only Anthropic debug log, URL userinfo/query redaction (`redact_url_for_debug`), `set_sensitive(true)`, separate timeout-free GET SSE client, `Utf8StreamDecoder`, and bounded reads. | Zero field/serde/public API changes; diagnostics keep host/path/header-key visibility without leaking secret values. |
| P1-6 | P1 | `crates/code/core/src/{surface_decision.rs,tools/program_tool.rs,tools/program_tool/tests.rs,fact_control.rs,fact_control/fact_reads.rs,elicitation.rs,shell_session.rs}`, `crates/code/acp/src/{config.rs,grok_account.rs,agent/permission_ask.rs}` | (a) Streaming 64 KiB cap in `surface_decision::post_system_one` and bounded open-once file reads in `grok_account.rs`; (b) Eliminated error-string matching via typed `ProgramScriptTimedOut`, `MissingAclConfig`, and preserved `ActorError::StepLimit`; (c) Added RAII `ElicitationCancelGuard` on `request_tool_permission`, poison recovery + bounded terminal FIFO eviction (`MAX_TERMINAL_RECORDS = 1024`) in `elicitation.rs`; (d) Fixed `shell_session.rs` `Stdio::piped()` deadlock (`Stdio::null()`), orphan reaping on `detach` race and `bind_session_with_root` overwrite, `pid` bounds check before `libc::kill(-pgid, SIGKILL)`, `SAFETY:` comments on all 3 `unsafe` blocks, and poison recovery. | Preserved all error messages and tool/session contracts while failing closed on leaks, deadlocks, and panics. |

---

## Verification Commands & Actual Results

### 1. Formatting & Diff Hygiene
- `git diff --check`: **PASS** (exit 0, no whitespace/conflict markers)
- `cargo fmt -p aster-acp -- --check`: **PASS** (exit 0)
- `cargo fmt -p aster-core -- --check`: **PASS** (exit 0 on `aster-core`; note `cargo fmt --all -- --check` reports a pre-existing formatting diff in untouched dirty file `crates/code/core/src/fact_control/tool_results.rs` lines 627 & 663).

### 2. Clippy Feature Matrix
- `cargo clippy --locked -p aster-core --all-targets --no-deps`: **PASS** (exit 0; 0 warnings in modified files)
- `cargo clippy --locked -p aster-core --no-default-features --features minimal --lib --no-deps`: **PASS** (exit 0)
- `cargo clippy --locked -p aster-core --no-default-features --features minimal --all-targets --no-deps`: **PRE-EXISTING FAIL** (exit 101; 5 pre-existing errors in untouched test files `deep_e2e_live.rs:1314,1324,1336`, `fact_control/receipts/tests/readonly_effect.rs:17`, and `tools/tests.rs:1153` referencing `program`-gated symbols when `minimal` omits `program`)
- `cargo clippy --locked -p aster-acp --all-targets --no-deps`: **PASS** (exit 0; 0 new warnings)
- `cargo clippy --locked -p aster-acp --no-default-features --features svg-png,account-import --all-targets --no-deps` (CLI feature combo): **PASS** (exit 0)
- `cargo clippy --locked -p aster-acp --no-default-features --lib --no-deps`: **PASS** (exit 0)

### 3. Focused & Regression Unit Tests (`aster-core` & `aster-acp`)
- `cargo test --locked -p aster-core --lib "sandbox::native::tests"`: **6 passed, 0 failed**
- `cargo test --locked -p aster-core --lib "tools::builtin::read::tests"`: **22 passed, 0 failed**
- `cargo test --locked -p aster-core --lib "workspace::read_overlay::tests"`: **8 passed, 0 failed**
- `cargo test --locked -p aster-core --lib "ask_user::tests"`: **9 passed, 0 failed**
- `cargo test --locked -p aster-core --lib "porcelain::"`: **PASS** (exit 0)
- `cargo test --locked -p aster-core --lib "memory::"`: **PASS** (exit 0)
- `cargo test --locked -p aster-core --lib "commands::tests"`: **17 passed, 0 failed**
- `cargo test --locked -p aster-core --lib "tools::builtin::bash::tests::bash_without_workspace_command_runner"`: **1 passed, 0 failed**
- `cargo test --locked -p aster-core --lib "store::tests::file_store_concurrent_writer_leases"` & `"store::tests::file_store_writer_lease"`: **PASS** (exit 0)
- `cargo test --locked -p aster-core --lib "config::tests::debug_formatting_redacts_secrets"`: **1 passed, 0 failed**
- `cargo test --locked -p aster-core --lib "mcp::oauth::tests"`: **3 passed, 0 failed**
- `cargo test --locked -p aster-core --lib "mcp::transport::streamable_http::tests"`: **PASS** (exit 0)
- `cargo test --locked -p aster-core --lib "tools::program_tool::tests::program_stack_overflow"` & `"tools::program_tool::tests::program_tool_cancellation"`: **PASS** (exit 0)
- `cargo test --locked -p aster-core --lib "fact_control::fact_reads"`: **PASS** (exit 0)
- `cargo test --locked -p aster-core --lib "elicitation::tests"`: **5 passed, 0 failed**
- `cargo test --locked -p aster-core --lib "shell_session::tests"`: **8 passed, 0 failed, 1 ignored** (`soak_rooted_shell_keeps_cwd_inside_one_hundred_commands`)
- `cargo test --locked -p aster-acp --lib "approval_learning::tests"`: **11 passed, 0 failed**
- `cargo test --locked -p aster-acp --lib "document_read::tests"`: **11 passed, 0 failed, 1 ignored** (Studio native document probe)
- `cargo test --locked -p aster-acp --lib "permission_ask"`: **6 passed, 0 failed**
- `cargo test --locked -p aster-acp --lib "agent::attempt_tests"`: **7 passed, 0 failed**
- `cargo test --locked -p aster-acp --lib "host_context::tests"`: **14 passed, 0 failed**
- `cargo test --locked -p aster-acp --lib "agent::turn_input_tests"`: **9 passed, 0 failed**
- `cargo test --locked -p aster-acp --lib "agent::turn_terminal_tests"`: **PASS** (exit 0)
- `cargo test --locked -p aster-acp --lib "agent::structured_output_tests"`: **5 passed, 0 failed**
- `cargo test --locked -p aster-acp --lib "grok_account::tests"`: **4 passed, 0 failed**
- `cargo test --locked -p aster-acp --lib "config::tests"`: **32 passed, 0 failed**
- `cargo test --locked -p aster-acp --lib "agent::host_methods::tests"` (golden `acp_wire_surface_v1.json`): **16 passed, 0 failed**

### 4. CLI Feature-Combo Tests (`--no-default-features --features svg-png,account-import`)
- `cargo test --locked -p aster-acp --no-default-features --features svg-png,account-import --lib "approval_learning::tests"`: **11 passed, 0 failed**
- `cargo test --locked -p aster-acp --no-default-features --features svg-png,account-import --lib "grok_account::tests"`: **4 passed, 0 failed**
- `cargo test --locked -p aster-acp --no-default-features --features svg-png,account-import --lib "host_context::tests"`: **14 passed, 0 failed**
- `cargo test --locked -p aster-acp --no-default-features --features svg-png,account-import --lib "agent::turn_input_tests"`: **9 passed, 0 failed**
- `cargo test --locked -p aster-acp --no-default-features --features svg-png,account-import --lib "agent::attempt_tests"`: **7 passed, 0 failed**

### 5. Integration & Contract Suites
- `cargo test --locked -p aster-acp --test acp_conformance_stdio`: **15 passed, 0 failed**
- `cargo test --locked -p aster-acp --test approval_rules_stdio`: **2 passed, 0 failed**
- `cargo test --locked -p aster-core --test test_prompt_boundaries_and_log_redaction`: **3 passed, 0 failed**
- `cargo test --locked -p aster-core --test test_workspace_backend`: **5 passed, 0 failed**
- `cargo test --locked -p aster-core --test test_program_script_quickjs_integration`: **5 passed, 0 failed, 1 ignored** (`soak_program_script_timeout_cycles_stay_bounded`)
- `cargo test --locked -p aster-core --test crate_root_surface`: **1 passed, 1 pre-existing baseline-drift failure** (`399 hidden crate-root aliases; lower HIDDEN_BASELINE to 399`, `77 public top-level modules; lower PUB_MOD_BASELINE to 77`; `crates/code/core/src/lib.rs` was not modified)
- `cargo test --locked -p aster-core --test production_unwrap_ratchet`: **1 passed, 1 pre-existing baseline-drift failure** (8 untouched files already drifted on HEAD; all 4 modified files with ratchet entries **strictly shrank**: `ask_user.rs` 3→2, `shell_session.rs` 11→0, `tools/builtin/bash.rs` 5→4, `tools/registry.rs` 1→0; total 86 vs baseline 89)

### 6. Python Repository Gates
- `/opt/homebrew/bin/python3.12 -m unittest -v tests.workspace_dependencies tests.cli_musl tests.release_governance tests.cli_release_workflow`: **48 passed, 0 failed** (20.511s)

### 7. Real-LLM Multi-Turn & Long-Horizon E2E (`../config.acl`, `kimi-01/k3.1-pro`)

#### Live Discovery & Harness Fix
- First live run of `test_long_horizon_real_llm` against `https://api.kimi.com/coding/v1/chat/completions` (`kimi-01/k3.1-pro` with `reasoning_effort = "max"` from `../config.acl`) returned HTTP 400: `{"error":{"message":"invalid temperature: only 1 is allowed for this model","type":"invalid_request_error"}}` because SDK tests pass `.with_temperature(0.0)` while `../config.acl` leaves `temperature` at default `true`.
- Added `is_kimi_fixed_temperature_model` (closed documented set in `crates/code/core/src/llm/effort.rs`: `k3.1-pro`, `k3.1-pro-highspeed`, `k3`, `k3-256k`, `kimi-for-coding`, `kimi-k2.5`) and gated `request["temperature"]` in `crates/code/core/src/llm/openai.rs`, with hermetic regression test `llm::openai::tests::kimi_fixed_temperature_models_omit_explicit_temperature` (**1 passed, 0 failed**).

#### Executed Real-LLM Scenarios (`ASTER_CONFIG_FILE=/Users/roylin/code/config.acl`)

| Crate / Suite | Scenario | Core Mechanisms Covered | Verdict / Actual Output |
| --- | --- | --- | --- |
| `aster-core` / `test_long_horizon_real_llm` | `real_model_completes_evidence_gated_multi_step_coding_task` | Planning mode, goal tracking, sandboxed `bash(node test.mjs)` failing baseline, multi-file read/edit, evidence-gated verification | **PASS** (84.22s) |
| `aster-core` / `test_multiturn_real_llm` | `sustained_multiturn_recall` | 7-turn conversation, planted-token recall (`6/6`), durable transcript | **PASS** (`6/6-tokens+transcript`) |
| `aster-core` / `test_multiturn_real_llm` | `interactive_correction_overrides_earlier_constraint` | Multi-turn mid-dialogue constraint override | **PASS** (`recency-wins`) |
| `aster-core` / `test_multiturn_real_llm` | `two_distinct_long_tasks_in_one_session_do_not_interfere` | Two independent multi-step coding tasks in one session, dual `VerificationContractV1` suites (`testA.mjs` + `testB.mjs`), zero nudges, cross-task recall | **PASS** (`A+B-verified+cross-recall A=endturn B=endturn nudges=0`) |
| `aster-core` / `test_multiturn_real_llm` | `long_task_survives_two_restarts` | Multi-stage coding repair surviving **2 full session restarts** + independent `node` verification | **PASS** (`crash2+continue2+node-verified`) |
| `aster-core` / `test_multiturn_real_llm` | `memory_extraction_then_recall_next_session` | Cross-session durable memory extraction (`drain_llm_extractions`) + next-session recall | **PASS** (`MT-WINDOW-4d17`) |
| `aster-acp` / `live_interactive_dialogue_real_llm` | `real_agent_holds_an_interactive_dialogue_over_the_wire` | Real `aster-acp` stdio wire, 6 turns, constraint correction, live wire cancel + post-cancel continuity | **PASS** (`6-turns+correction+cancel+continuity`, 143.15s) |
| `aster-acp` / `live_interactive_dialogue_real_llm` | `real_agent_dialogue_resumes_after_process_restart` | Full `aster-acp` process kill + restart + `session/load` resume + recall | **PASS** (`kill+load+recall`) |
| `aster-acp` / `live_interactive_dialogue_real_llm` | `real_agent_interject_mid_turn_lands_in_the_dialogue` | Live `_aster/interject` mid-turn steering over ACP stdio wire | **PASS** (`steer-fact+mark-visible same_turn=true`) |
| `aster-acp` / `live_interactive_dialogue_real_llm` | `real_agent_resumes_with_mcp_capability_attached` | Real MCP server attached across `aster-acp` process restart (`sync_session_mcp_servers` + echo tool execution) | **PASS** (`load+mcp+echo-executed`) |
| `aster-acp` / `live_interactive_dialogue_real_llm` | `real_agent_tool_dialogue_gates_then_remembers_workspace_state` | HITL tool permission gate + gated write + workspace recall | **FAIL (180s test timeout under `reasoning_effort="max"`)**: workspace inspection confirmed the permission gate approved and wrote `notes.txt` (`anchor HARBOUR-51e9`) and entered sandboxed verification (`.kbox`), then exceeded the test's 180s wall-clock timeout during multi-round `max`-effort reasoning. |
| `aster-core` / `test_multiturn_real_llm` | `cancelled_turn_marks_history_and_conversation_continues` | Stream cancel after fixed 3s sleep | **FAIL (test timing under `reasoning_effort="max"`)**: `session.cancel()` succeeded (`cancelled == true`), but `k3.1-pro` at `max` effort was still in `ReasoningDelta` at t=3s before emitting `TextDelta`, failing `assert!(saw_delta)`. (Wire cancel + continuity passed in `real_agent_holds_an_interactive_dialogue_over_the_wire`.) |
| `aster-core` / `test_multiturn_real_llm` | `checkpoint_restart_finishes_task` | `worker.abort()` + `resume_run` | **FAIL (run settled interrupted on teardown)**: `resumed_session.resume_run` returned `(Response interrupted by the user.)` without continuing the edit (`src/math.mjs` still returned `[1, 2, 3]`). Contrast with `long_task_survives_two_restarts` which passed across 2 full restarts. |
| `aster-core` / `test_multiturn_real_llm` | `mid_conversation_compaction_continuity` | Auto-compaction with `max_context_tokens(3_000)` | **FAIL (pre-existing test config vs prompt floor)**: rejected before any LLM call with `context_window_unhostable: declared context window (3000 tokens) < harness prompt floor (12288)`. |
| `aster-core` / `test_compaction_fidelity_real_llm` | `a_corrected_fact_survives_repeated_compaction_without_memory_recall` | Repeated fact-log compaction with `max_context_tokens(1_024)` | **FAIL (pre-existing test config vs prompt floor)**: rejected before any LLM call with `context_window_unhostable: declared context window (1024 tokens) < harness prompt floor (12288)`. |

---

## Explicitly Not Claimed

1. **Untested OS / architecture targets**: All Rust tests ran natively on macOS `arm64` only. Linux (`x86_64`/`aarch64`, including musl static compilation and ELF inspection of built `aster` + `aster-acp` release binaries) and Windows (`x86_64`, including PowerShell/Job-Object paths in `shell_session.rs` and Windows path semantics in `native.rs`/`read.rs`/`document_read.rs`) were not executed on this host.
2. **Full workspace & `protoc`-dependent crates**: `protoc` is not installed locally; workspace crates outside `aster-core` and `aster-acp` (including `apps/aster`, `apps/studio`, `crates/office`, and control-plane crates) were not built or tested in this pass.
3. **Full ~6,000-test `aster-core` sweep & `scientific`/`full`/`ci-all` feature builds**: Verification covered focused unit suites, integration/conformance suites, `aster-core` default + `minimal` (lib), and `aster-acp` default + CLI (`svg-png,account-import`) + `--no-default-features` (lib). The full 6,000+ `aster-core` test sweep and `scientific`/`full`/`ci-all` feature combinations were not executed locally.
4. **Live compaction, Studio GUI E2E, and flash-only pinned suites**: Live compaction E2E (`mid_conversation_compaction_continuity`, `test_compaction_fidelity_real_llm`) could not execute because those frozen test fixtures declare `limit.context` (3000 / 1024) below the current 12288 harness prompt floor; `test_long_horizon_capabilities_real_llm` and `real_agent_effort_switch_mid_dialogue_tracks_the_new_budget` explicitly pin `boyue/deepseek-v4-flash` and were not modified; soak tests (`S-WT-01`, `S-PG-01`) and Studio native document probe were not run.
5. **Pre-existing baseline failures not modified**: Pre-existing `crate_root_surface` and `production_unwrap_ratchet` baseline drifts on untouched files, pre-existing `minimal --all-targets` test-only `cfg` errors, and the pre-existing formatting diff in untouched `crates/code/core/src/fact_control/tool_results.rs` were left untouched per task scope.
6. **Deferred P2 review findings**: Lower-priority P2 items from the review (such as `workspace_browser.rs`, `read_to_end` on small local helper configs outside `grok_account.rs`, and minor lock/allocation cleanups) were intentionally deferred to avoid altering Studio preview behavior or expanding change scope.
