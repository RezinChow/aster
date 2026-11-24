# Outcome: Main Repo Issues (#311, #316–#322) Root-Cause Fixes, E2E & Local CI (`nektos/act`)

- **Date**: 2026-11-24
- **Host / Toolchain**: macOS arm64 (`darwin-aarch64`), pinned Rust `1.97.1`, `protoc 36.2`, `python 3.12`, `nektos/act 0.2.98`, OrbStack Docker Engine `29.8.2` (`linux/arm64` + Rosetta `linux/amd64`, 12 CPU / 16 GiB RAM)
- **Repository**: `/Users/roylin/code/aster` (plus `apps/studio` submodule working-tree audit/fix for `#311`, uncommitted)

## 1. Per-Issue Root Cause & Fix Summary

| Issue | Root Cause (First Principles) | Fix | Regression Test |
| --- | --- | --- | --- |
| **#322** `/config` saves `0.0001`s as `0` ms then refuses resave | `parse_timeout_ms` checked `seconds > 0.0` before rounding `(seconds * 1000.0).round() as u64`, allowing `< 0.0005`s to round to `0` ms and unbounded inputs to overflow `f64`/`i64` round-trip. | Validate post-scale bounds (`1..=MAX_TIMEOUT_MS`, `MAX_TIMEOUT_MS = (1u64 << 53) - 1`) in `crates/terminal/crates/codegen/aster-pager/src/views/model_config/document.rs` so sub-millisecond values rounding to `0` fail fast with `0.001`s guidance and every accepted value round-trips losslessly. | `views::model_config::document::tests::timeout_rejects_submillisecond_zero_rounding_and_roundtrips_valid_values` |
| **#321** Single-file `search grep` with matching `include` returns 0 hits | When `request.base` points to a single file (`file.path == base`), `relative_to_base` returns `Some("")`; `glob_matches` evaluated `Path::new("").file_name() == None`. Also `LocalWorkspaceBackend::grep_walk` relied on `ignore::types::TypesBuilder`, which skips depth-0 single files. | Added `glob_match_target` in `crates/code/core/src/workspace/manifest.rs` (for both `grep` and `glob`) and shared `BraceGlob` matching in `crates/code/core/src/workspace/local.rs` so single-file bases match against the file's full workspace path and filename identically across manifest and local backends. | `workspace::manifest::tests::manifest_grep_single_file_base_matches_filename_and_path_include_globs`, `workspace::local::tests::local_grep_single_file_base_matches_filename_and_path_include_globs`, plus real `aster-acp` E2E |
| **#320** Minimal welcome shows `Aster v9.1.4` instead of CLI `0.4.0` | `crates/terminal/crates/codegen/aster-pager-minimal/src/welcome.rs` read fallback `aster_version::VERSION` (`9.1.4`) instead of the runtime-injected `aster_version::full_version()` used by `--version` and fullscreen welcome. | Switched minimal welcome card to `aster_version::full_version()` via `welcome_version_label()`, aligning `--version`, fullscreen welcome, and minimal welcome to one source of truth. | `aster-pager-minimal::welcome::tests::welcome_version_label_uses_injected_full_version` + `./target/debug/aster --version` E2E (`aster 0.4.0 (4e0f9bd4be0c)`) |
| **#319** `/dashboard` refusal on Code backend omits how to open another cwd | Generic backend-unavailable message did not state the sanctioned CLI flag for launching Aster in another directory. | Updated `/dashboard` refusal in `crates/terminal/crates/codegen/aster-pager/src/app/dispatch/prompt.rs` to preserve the existing prefix and guide users to `aster --cwd <path>`. | `app::dispatch::tests::prompt::code_command_refusal::code_backend_unavailable_commands_never_become_model_prompts` |
| **#318** Pager queued RPC error test failed on scrollback length check | `start_turn` pre-creates an empty `Thinking…` placeholder (`+1`); when the running turn fails, `finish_turn` removes the empty placeholder (`-1`) and pushes `SessionEvent::TurnFailed` (`+1`), leaving `scrollback.len() == scrollback_before`. | Updated `crates/terminal/crates/codegen/aster-pager/src/app/dispatch/tests/turn.rs` to assert semantic invariants directly: queued error emits no `TurnFailed`; running turn error renders `SessionEvent::TurnFailed` containing `"upstream boom"` and removes the empty `Thinking` placeholder. | `app::dispatch::tests::turn::queued_prompt_rpc_error_does_not_kill_running_turn` |
| **#317** Pager cancel-before-first-activity test failed precondition before `CancelTurn` | Precondition asserted `scrollback.len() == 1`, ignoring the pre-created empty `Thinking…` block (`2` when `show_thinking_blocks` is enabled). Verified `rewind_in_flight_prompt` + `finish_turn` cleanly removes both blocks (`scrollback.len() == 0`). | Updated precondition in `crates/terminal/crates/codegen/aster-pager/src/app/dispatch/tests/settings.rs` to reflect `load_show_thinking_blocks()` so the full `Action::CancelTurn` rewind + orphan response discard assertions execute. | `app::dispatch::tests::settings::cancel_before_first_activity_resets_state_and_discards_orphan_response` |
| **#316** TUI duplicates already-streamed fragment after premature SSE EOF retry | Three broken links in Aster's transactional turn-retry boundary: (1) `fact_control.rs` incremented `model_turns` before success and emitted `TurnEnd` on retryable errors, breaking `AgentEvent::TurnStart`'s same-turn rollback contract; (2) `aster-acp` `TurnState` ignored repeated `TurnStart` and never rolled back `delta_text` or emitted ordered `retry_state`; (3) `aster-pager` `apply_retry_state(Retrying)` kept the uncommitted streaming assistant/thinking blocks open. | (1) `crates/code/core/src/fact_control.rs`: increment `model_turns` and emit `TurnEnd` only on `Ok(response)` (or non-retryable `Defect`), so retries re-emit the same `TurnStart { turn }`; (2) `crates/code/acp/src/agent.rs`, `emit.rs`, `turn.rs`: detect repeated `TurnStart { turn }`, truncate `delta_text` / restore `saw_text`, and emit existing wire `retry_state` (`type: "retrying"`) in stream order (zero wire surface change); (3) `crates/terminal/crates/codegen/aster-pager/src/acp/tracker.rs`, `app/agent.rs`, `session_notification.rs`: discard uncommitted streaming assistant/thinking blocks on `RetryState::Retrying` while preserving pre-created empty `Thinking…` placeholders and completed prior turns. | `fact_control::tests::premature_stream_eof_retry_reemits_same_turn_start_without_intermediate_turn_end`, `aster-acp::agent::turn_terminal_tests::repeated_turn_start_rolls_back_provisional_delta_and_emits_ordered_retry_state`, `aster-pager::app::acp_handler::tests::session_events::apply_retry_state_retrying_discards_provisional_stream_so_retry_does_not_duplicate`, plus real-binary loopback HTTP/1.1 chunked SSE fault-server E2E (`#316-A` & `#316-B`) |
| **#311** Windows Studio 0.2.4 exits with `tenant directory for aster was not found` | Prior commit `a970022311` in `apps/studio` added `tenant/aster/` to Tauri `bundle.resources`, but `apps/studio/src-tauri/src/tenant.rs::tenant_dir` only searched `exe.parent().join("../Resources/tenant/<slug>")` (macOS layout). On Windows NSIS/WiX, Tauri installs `bundle.resources` directly beside `Studio.exe` (`<exe_dir>/tenant/<slug>`), and on Linux under `../lib/<product>/tenant/<slug>` / `$APPDIR/usr/lib/<product>/tenant/<slug>`. | Refactored `tenant_dir` -> `tenant_dir_from` and extended `packaged_tenant_from` in `apps/studio/src-tauri/src/tenant.rs` (matching `agent_plane/launcher.rs` and `office_tool.rs` cross-platform resource layouts) with a hermetic unit test covering Windows, macOS, Linux, and missing-`INFO.md` fail-closed behavior. | `apps/studio/src-tauri/src/tenant.rs::tests::packaged_tenant_dir_resolves_windows_macos_and_linux_bundle_layouts` + 36/36 Studio Python packaging/delivery contract tests (`studio_product_test.py` 11/11, `studio_delivery_test.py` 25/25) |
| **Linux CI Catch** `execute_owned_process` `BrokenPipe` race on fast Linux child exit | Caught during OrbStack Linux `qualify-code.yml` (`session_new_plugin_tool_runs_the_unpacked_executable`): `crates/code/core/src/tools/process.rs::execute_owned_process` returned `Err(BrokenPipe)` from `stdin.write_all` / `stdin.shutdown` when a subprocess exited cleanly without reading stdin, aborting `tokio::try_join!` and discarding stdout + exit status. | Ignore `io::ErrorKind::BrokenPipe` on child stdin write/shutdown in `crates/code/core/src/tools/process.rs` so `read_captured_output` always captures the child's actual stdout, stderr, and exit status. | `tools::process::tests::execute_owned_process_tolerates_child_closing_stdin_early` (deterministic 256 KiB payload `EPIPE`) + full Linux `qualify-code.yml` `556/556` ACP lib pass |

## 1b. GitHub Issue Replies Posted (All Kept Open Pending Commit/Merge)
- `#322`: https://github.com/aster-ai-lab/aster/issues/322#issuecomment-7121571537
- `#321`: https://github.com/aster-ai-lab/aster/issues/321#issuecomment-7121572699
- `#320`: https://github.com/aster-ai-lab/aster/issues/320#issuecomment-7121573714
- `#319`: https://github.com/aster-ai-lab/aster/issues/319#issuecomment-7121574624
- `#318`: https://github.com/aster-ai-lab/aster/issues/318#issuecomment-7121583806
- `#317`: https://github.com/aster-ai-lab/aster/issues/317#issuecomment-7121584766
- `#316`: https://github.com/aster-ai-lab/aster/issues/316#issuecomment-7121585619
- `#311`: https://github.com/aster-ai-lab/aster/issues/311#issuecomment-7121586614

## 2. Verification Commands & Observed Results

### Focused Regression Suites
- `cargo test --locked -p aster-core --lib -- manifest_grep_single_file_base_matches_filename_and_path_include_globs local_grep_single_file_base_matches_filename_and_path_include_globs premature_stream_eof_retry_reemits_same_turn_start_without_intermediate_turn_end security::event_sanitizer::tests` -> **9 passed; 0 failed**
- `cargo test --locked -p aster-acp --lib -- repeated_turn_start_rolls_back_provisional_delta_and_emits_ordered_retry_state provider_retry_update_uses_existing_pager_retry_state_contract agent::host_methods::tests` -> **18 passed; 0 failed**
- `cargo test --locked -p aster-pager --lib -- views::model_config::document::tests app::dispatch::tests::prompt::code_command_refusal app::dispatch::tests::turn::queued_prompt_rpc_error_does_not_kill_running_turn app::dispatch::tests::settings::cancel_before_first_activity_resets_state_and_discards_orphan_response app::acp_handler::tests::session_events` -> **74 passed; 0 failed**
- `cargo test --locked -p aster-pager-minimal --lib` -> **99 passed; 0 failed**
- `/opt/homebrew/bin/python3.12 -m unittest discover -s apps/studio/scripts/tests -p "*_test.py" -v` -> **39 passed; 1 error** (`studio_product_test` 11/11 ok, `studio_delivery_test` 25/25 ok, `runtime_registry_test` 1/1 ok; unrelated `sandbox_assets_test.test_rootfs_input_extracts_regular_files` failed due to macOS BSD `tar` lacking GNU `--warning=no-unknown-keyword`).

### Fresh Binary Build, Real-Binary E2E & Live `kimi-01/k3.1-pro` E2E
- `cargo build --locked -p aster -p aster-acp` -> **succeeded** (`./target/debug/aster --version` -> `aster 0.4.0 (4e0f9bd4be0c)`)
- `/opt/homebrew/bin/python3.12 .../scratch/e2e_issues_verify.py` (driving fresh `./target/debug/aster` and `./target/debug/aster-acp` over stdio against live loopback HTTP/1.1 chunked SSE servers):
  - `[E2E #320]` CLI version `0.4.0` -> **PASS**
  - `[E2E #316-A]` Premature SSE EOF attempt 1 -> succeed attempt 2: wire sequence `[('chunk', '本地长流已开始。'), ('retry', 'retrying', 1), ('chunk', '本地长流已开始。'), ('chunk', '完整回复')]` -> **PASS**
  - `[E2E #316-B]` Both attempts premature SSE EOF: wire sequence `[('chunk', '本地长流已开始。'), ('retry', 'retrying', 1), ('chunk', '本地长流已开始。')]`, RPC error -> **PASS**
  - `[E2E #321]` Real `aster-acp` `search` tool on `lexical/a.txt`: `*.txt` (2 matches), `a.txt` (2 matches), `*.md` (0 matches), `None` (2 matches) -> **PASS**
- `ASTER_CONFIG_FILE=.../kimi_e2e.acl ASTER_LIVE_MODEL=kimi-01/k3.1-pro cargo test --locked -p aster-acp --test live_interactive_dialogue_real_llm -- real_agent_holds_an_interactive_dialogue_over_the_wire real_agent_tool_dialogue_gates_then_remembers_workspace_state --ignored --nocapture --test-threads=1` -> **2 passed; 0 failed** (`6-turns+correction+cancel+continuity`, `file+gate+cross-turn-recall allowed=2`).

### Formatting, Clippy Matrix & Repository Python Gates
- `rustfmt --edition 2021 --check` (11 modified `aster-core`/`aster-acp` files) & `rustfmt --edition 2024 --check` (11 modified `aster-pager`/`aster-pager-minimal`/`aster-studio` files) -> **0 diffs**
- `cargo clippy --locked -p aster-core --all-targets --no-deps` -> **succeeded (0 errors)**
- `cargo clippy --locked -p aster-acp --all-targets --no-deps` -> **succeeded (0 errors)**
- `cargo clippy --locked -p aster-acp --no-default-features --features svg-png,account-import --all-targets --no-deps` -> **succeeded (0 errors)**
- `cargo clippy --locked -p aster-pager-minimal --all-targets --no-deps` -> **succeeded (0 errors)**
- `/opt/homebrew/bin/python3.12 -m unittest tests.workspace_dependencies tests.cli_musl tests.release_governance tests.cli_release_workflow -v` -> **48 passed; 0 failed**
- `cargo test --locked -p aster-acp --test acp_conformance_stdio` -> **15 passed; 0 failed**

### Local CI via `nektos/act` (`act 0.2.98`, macOS host + OrbStack Linux containers)
- **macOS (`-P macos-latest=-self-hosted`)**:
  - `act push -W .github/workflows/line-endings.yml -P macos-latest=-self-hosted --matrix os:macos-latest` -> **Job succeeded (6/6 passed)**
  - `act push -W .github/workflows/qualify-code.yml -j test -P macos-latest=-self-hosted --matrix os:macos-latest -s STUDIO_READ_TOKEN=... --env CARGO_TARGET_DIR=/Users/roylin/code/aster/target`:
    - `Test Core goal feedback` -> **2 passed; 0 failed**
    - `Test loop convergence and replay` -> **448 passed; 0 failed**
    - `Test native host execution` -> **3 passed; 0 failed**
    - `Test ACP unit and wire contracts` -> **677 passed; 0 failed**
    - `Deterministic PTY E2E suites (macOS)`: `shell_bypass_learning` (2/2), `memory_management` (1/1), `memory_canonical_stdio` (1/1), `protocol_commands_stdio` (12/12), `workspace_layer_trust_stdio` (2/2), `unattended_e2e` (33/33) -> **all PASS**; `shipped_tui_e2e` re-run directly from repo root against fresh `target/debug/aster` -> **26 passed; 0 failed; 1 ignored**.
- **Linux in OrbStack (`DOCKER_HOST=unix://$HOME/.orbstack/run/docker.sock`)**:
  - `act push -W .github/workflows/line-endings.yml -P ubuntu-latest=catthehacker/ubuntu:act-latest --matrix os:ubuntu-latest --container-architecture linux/arm64 --bind` -> **Job succeeded (6/6 passed)**
  - `act push -W .github/workflows/qualify-aster-cli.yml -j test -P ubuntu-latest=ghcr.io/catthehacker/ubuntu:rust-latest --container-architecture linux/arm64 ...` -> **Job succeeded**:
    - `Check CLI formatting and delivery contracts` (`cargo fmt -p aster -p aster-core -p aster-acp -- --check` + 8 Python delivery/musl/governance suites, **98/98 passed**)
    - `Build the CLI and ACP companion pair` (Linux `aster` + `aster-acp` build) -> **PASS**
    - `Test Aster CLI` -> **57 passed; 0 failed**
  - `act push -W .github/workflows/qualify-code.yml -j test -P ubuntu-latest=ghcr.io/catthehacker/ubuntu:rust-latest --matrix os:ubuntu-latest --container-architecture linux/arm64 ...` -> **Job succeeded (1,146/1,146 passed, 0 failed)**:
    - `Check Core/ACP formatting and dependency boundary` (`cargo fmt -p aster-effect -p aster-core -p aster-acp -- --check` + `workspace_dependencies.py` 7/7 + `code_release_workflow.py` 7/7) -> **PASS**
    - `Test Core goal feedback` -> **2 passed; 0 failed**
    - `Test loop convergence and replay` -> **448 passed; 0 failed**
    - `Test native host execution` -> **3 passed; 0 failed**
    - `Test ACP unit and wire contracts` -> **679 passed; 0 failed** (`aster-acp --lib` **556/556**, `acp_conformance_stdio` **15/15**, `unattended_e2e` **6/6**, `deloop_real_llm` **51/51**, `deloop_generalization_real_llm` **51/51**)
  - `act push -W .github/workflows/ci.yml -j acp-musl -P ubuntu-latest=ghcr.io/catthehacker/ubuntu:rust-22.04 --container-architecture linux/amd64 ...`:
    - `cargo build --locked --release --target x86_64-unknown-linux-musl -p aster-acp --bin aster-acp` with pinned Zig `0.16.0` -> **succeeded (`Finished release profile [optimized] in 14m 18s`)**; post-build `python3 tests/acp_musl.py` exited on `ModuleNotFoundError: No module named 'tomllib'` because `catthehacker/ubuntu:rust-22.04` ships Python 3.10 (GitHub `ubuntu-latest` Ubuntu 24.04 ships Python 3.12).

## 3. Remote Qualification & Published Releases (2026-11-24)
- **Release source commit**: `75abf7aa1872f823b29a907663e8bee0da9e0264` (`main`, including the user-approved `host_owned_tools` follow-up and leaving `apps/studio` out of scope per `RELEASE_9.3.0.md`).
- **Remote branch qualification on `75abf7aa1872f823b29a907663e8bee0da9e0264`**:
  - `Cross-platform text`: run `45326190404` -> **success**
  - `Qualify aster-cli`: run `45326190483` (`ubuntu-latest`) -> **success**
  - `Qualify aster`: run `45326190383` (`ubuntu-latest`, `windows-latest`, `macos-latest` after rerunning transient `shipped_retrieval_stdio_executes_embedded_semantic_search` semantic-index timing flake) -> **success**
  - `Rust` (`ci.yml`): run `45326190337` -> `Static ACP (x86_64 musl)` **success**, `desktop-frontend (aster)` **success**; `check (ubuntu-latest)` failed on transient `onnxruntime-node` postinstall network error; `check (macos-latest)` passed 493/494 in `Core long-task ownership and consent contracts` and caught a `StepLimit` outer `Display` regression in `crates/code/core/src/fact_control/fact_reads.rs` (`exit_to_error`), fixed on `main` immediately post-release and verified locally (`fact_log_default_resume_retains_admitted_unbounded_and_explicit_step_limits` **1 passed; 0 failed**).
- **Published `aster-acp-v9.3.0`** (`--latest=false`, workflow run `45336862286` **success**):
  - URL: `https://github.com/aster-ai-lab/aster/releases/tag/aster-acp-v9.3.0`
  - Assets (6): `aster-acp-v9.3.0-macos.tar.gz`, `aster-acp-v9.3.0-linux.tar.gz`, `aster-acp-v9.3.0-linux-musl.tar.gz` (x86_64 static glibc-free, verified by `tests/acp_musl.py`), `aster-acp-v9.3.0-linux-musl-arm64.tar.gz` (aarch64 static glibc-free, verified by `tests/acp_musl.py`), `aster-acp-v9.3.0-windows.zip`, `SHA256SUMS`.
- **Published `aster-cli-v0.4.0`** (`--latest=false`, workflow run `45326236601` **success** after `--failed` rerun of hosted-runner-disconnected `linux` job; assembled and verified via `scripts/publish-aster-cli.sh` from clean `75abf7aa1872f823b29a907663e8bee0da9e0264`):
  - URL: `https://github.com/aster-ai-lab/aster/releases/tag/aster-cli-v0.4.0`
  - Assets (8): `aster-cli-v0.4.0-macos.tar.gz`, `aster-cli-v0.4.0-linux.tar.gz`, `aster-cli-v0.4.0-kylin-x86_64.tar.gz` (byte-identical to `linux`), `aster-cli-v0.4.0-linux-arm64.tar.gz`, `aster-cli-v0.4.0-linux-musl.tar.gz` (x86_64 static glibc-free, verified by `tests/cli_musl.py`), `aster-cli-v0.4.0-linux-musl-arm64.tar.gz` (aarch64 static glibc-free, verified by `tests/cli_musl.py`), `aster-cli-v0.4.0-windows.zip`, `latest.json`.
- **Updated `aster-cli-stable` channel**: `Publish aster-cli channel` run `45356409967` -> **success**; verified `aster-cli-stable/latest.json` points to `aster-cli-v0.4.0` with all 7 platforms (including `linux-musl` and `linux-musl-arm64`), and verified repository `Latest` remains Aster Desktop `v0.2.4`.
- **GitHub Issues**: Closed `#316`–`#322` with commit SHA and release links; kept `#311` open pending Windows Studio NSIS verification.

## 4. Post-Release `main` Hygiene & Wrap-up
- **`fe8466bf5bdc2a1caa971ef6c556c056ead6db89` (`exit_to_error` Display fix)**:
  - `Cross-platform text` (`45356785480`): **success**
  - `Qualify aster-cli` (`45356785475`): **success**
  - `Qualify aster` (`45356785545`, `windows-latest`, `ubuntu-latest`, `macos-latest`): **success**
  - `Rust` (`45356785421`): `Static ACP (x86_64 musl)` **success**, `desktop-frontend (aster)` **success**, `check (ubuntu-latest)` **success**; `check (macos-latest)` passed steps 1–38 and failed on step 39 (`sandbox::native::lifetime_tests::resolves_policy_timeout`) because `aster_bash_policy` compared canonicalized `.aster` (`/private/var/...`) against an uncanonicalized macOS `/var/...` workspace path.
- **Follow-up fix in `crates/code/core/src/sandbox/native.rs`**: Canonicalizes `workspace` via `canonicalize_workspace(workspace)?` at entry to `aster_bash_policy`. Verified natively on macOS arm64: `cargo test --locked -p aster-core --lib sandbox::native` -> **9 passed; 0 failed** (including `lifetime_tests::resolves_policy_timeout` and `refuses_symlink_aster_control_plane_directories`), `cargo fmt --all -- --check` -> **0 diffs**.
- **Public release & local cleanup verification**:
  - HTTP `HEAD` verified `200` on `aster-cli-stable/latest.json`, `aster-cli-v0.4.0` (`linux-musl` + `linux-musl-arm64`), and `aster-acp-v9.3.0` (`linux-musl` + `linux-musl-arm64`); verified `v0.2.4` compatibility `latest.json` points to `aster-cli-v0.4.0`.
  - Removed 2 leftover local `act` OrbStack containers and their 4 ephemeral container volumes (`docker ps -a` empty).

## 5. Explicitly Not Claimed
- **`aster-studio` native macOS Rust compilation & Windows NSIS boot (`#311`)**: `apps/studio/src-tauri/src/tenant.rs` was kept out of this CLI/ACP release (consistent with `RELEASE_9.3.0.md`). Running `cargo test --locked -p aster-studio` on this host failed in `crates/capture/build.rs:217` because only Xcode CommandLineTools is installed (missing full Xcode's `SwiftUIMacros` plugin), and Windows NSIS/WiX runtime boot cannot be verified on macOS arm64.
- **Post-release `main` fixes vs. immutable `75abf7aa1` release tags**: `aster-cli-v0.4.0` and `aster-acp-v9.3.0` are immutable releases built from `75abf7aa1872f823b29a907663e8bee0da9e0264`. Both follow-up fixes on `main` (`exit_to_error` outer `Display` format in `fe8466bf5` and `aster_bash_policy` canonicalization for direct uncanonicalized-path callers — note `NativeBashSandbox::new` already canonicalized `workspace` in `75abf7aa1`) will ship in the next patch release; the newly triggered remote CI run for the `sandbox::native` commit is in progress at wrap-up time.
