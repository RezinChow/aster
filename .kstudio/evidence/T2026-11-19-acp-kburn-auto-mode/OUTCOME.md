# T2026-11-19-acp-kburn-auto-mode

Updated: 2026-11-19T14:46:25+08:00 · scope: ACP / Core KBurn automatic skill use and host mode selection · **named slice passed with explicit ACP full-lib limits** · **≠ Meta Harness Done**

## Result

ACP now has a three-state KBurn mode:

- **Unset / Auto**: automatic arming requires engineering markers under `workspace/.aster/` (`MANIFEST.json`, `workflow`, `wiki`, `evidence`, or `skills`). A bare `.aster/config.acl` does not arm. Legacy `.kstudio/` alone no longer triggers auto-arm or ACP automatic skill-directory injection.
- **Enabled**: trusted ACL `kburn = true` or `aster-acp --kburn` explicitly arms KBurn and may materialize missing factory seeds without an existing engineering root. Existing files are not overwritten.
- **Disabled**: trusted ACL `kburn = false` or `aster-acp --no-kburn` disables factory materialization, Core KBurn skill loading, and ACP automatic `.aster/skills` scanning/watching. Other explicitly configured `skill_dirs`, including an explicitly named legacy `.kstudio/skills`, remain under the user's control.

The CLI flag overrides the loaded ACL value. Interactive and unattended ACP session construction both carry the mode. The public Core `SessionOptions` exposes `KburnMode` and `with_kburn_enabled` for other hosts.

Automatic use remains model- and permission-driven: the KBurn skill catalog reaches the model, the model can invoke `Skill` without a slash command, returned instructions enter the next turn, and ordinary `Allow Skill?` confirmation still applies. This does not auto-start `/yolo`, authorize writes, or bypass host permissions.

## Verification

- Core KBurn suite: **19/19**; ACL loader: **1/1**; session-mode counterexample: **1/1**.
- ACP CLI parser: **11/11**; automatic-directory filtering: **1/1**.
- Four focused shipped Aster + ACP PTY cases: **4/4**:
  - `.aster` auto-arm and natural-language `Skill(status)` use, with the permission card confirmed.
  - `kburn = false`: no catalog injection and no factory materialization.
  - legacy `.kstudio` alone: no auto-arm and no catalog injection.
  - `kburn = true`: factory seeds materialize without engineering markers.
- Full deterministic ACP/TUI suites: **74 passed / 0 failed / 1 ignored / 219.25s** (`deterministic-summary-rerun.json`); `tui_913_hermetic` is **15/15**.
- Final serial Core: **5984 passed / 0 failed / 33 ignored / 616.24s** (`core-lib-serial.log`).
- Core and ACP Clippy all targets: **exit 0** each. Existing warnings are not claimed as cleaned.
- Final paired build: **exit 0**; both binaries report `aster-cli-pair-v1:8583651a27dfb31167d58abfcd370fba308d8dcf:aarch64-apple-darwin`.
- Built `aster-acp --help` lists both flags and the ACL setting (`acp-help.log`).
- `git diff --check`: **exit 0** for Core/ACP sources, ACP tests, and verification artifacts.

The first focused PTY attempt stopped at an unanswered `Allow Skill?` card; the fixture now answers through the normal permission flow and all four cases pass. Two earlier deterministic attempts also retained BUILD_ID mismatches caused by rebuilding only one side of the Aster/ACP pair. The failed logs are preserved; paired rebuilds preceded the accepted 74/0/1 run.

`cargo fmt --all` was run and the existing `terminal_bench_runner.rs` edits were restored byte-for-byte. Final `cargo fmt --all -- --check` remains **exit 1 only for that pre-existing file** (`fmt-check.log`); no Core/ACP source or ACP test formatting difference was reported.

## ACP full-lib limitation

`cargo test --locked -p aster-acp --lib -- --test-threads=1` is **not green**: **542 passed / 4 failed / 10 ignored** (`acp-lib.log`). The failures are:

- `engineering_shared_host_options_preserve_policy_and_contracts_after_file_reopen` — model-input count 8 vs expected 2.
- `switching_preserves_history_and_anthropic_parameters` — request count 4 vs expected 5, followed by a channel send failure.
- `invalid_final_answer_uses_core_structured_repair_and_returns_the_object` — `spawn_local` outside `LocalSet`.
- `valid_final_answer_returns_structured_output_without_another_model_call` — the same `LocalSet` failure.

These tests and their business paths were not changed by the KBurn slice. No clean-baseline claim is made, and the failures are not represented as fixed or as KBurn acceptance evidence.

## Explicitly not claimed

- No real provider/model was called; all automatic-skill E2E used the local deterministic OpenAI-compatible mock.
- Explicit enable materializes factory seeds, but Core still does not embed the 12 skill Markdown bodies. A workspace with no skill packages gets seeds, not invented conductor skills.
- No Windows native check, commit, push, branch, worktree, install, release, or external workspace edit was performed. USD/token cost is unavailable.
- ACP full-lib green, overall Meta Harness completion, Studio synchronization, daily-use release evidence, and product Pass are not claimed.
