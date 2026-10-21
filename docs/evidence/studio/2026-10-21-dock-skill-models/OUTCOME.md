# Dock reopen, skill confirmation, and Anthropic model-list URLs

Date: 2026-10-21. Local source evidence. Not a published release. Not committed.

Three AsterDream behaviors changed together.

A macOS Dock click sends `RunEvent::Reopen`. The run loop now calls `desktop_settings::show_main` whenever `show_main_on_reopen` is true. That function is true whether or not another window is already visible, so a hidden main window comes back. Hide-on-close and exit-on-close are unchanged. No new window is created.

`policy_for_posture("default")` and `"auto"` allow `ask_user` and `ask_user_form`. `Skill` stays Ask on those two postures, so the existing confirmation card can park the call. `"yolo"` allows `Skill` through the execute lane and allows the two question tools by name. `"plan"` still denies both. Retired posture names stay on the asking default, so `ask_user_form` stays Ask there. A research turn starts from that posture policy, keeps caller denies, allows the read set plus `open_local_asset` and `search_wiki`, and denies writes, `bash`, `task`, and `parallel_task`. A deny still beats a yolo execute allow. Default `read` stays Ask outside a research turn.

An Anthropic catalog base whose path ends in `/apps/anthropic` lists models at the same origin `/compatible-mode/v1/models` with a Bearer header. That match is the path, not a host name. Other Anthropic bases use `/v1/models` with `x-api-key` and `anthropic-version: 2023-06-01`. OpenAI bases that already end in `v` plus digits append `/models`; other OpenAI bases append `/v1/models`. A base that already ends in `/models` is used as given.

## Verification

Rust toolchain: workspace pin `1.97.1` (`rustc 1.97.1 (8bab26f4f 2026-07-14)`).
Commands from the repository root on the final source, one `cargo test` per package, filters after `-- --exact`. Combined log: `dock-skill-models.log` in the goal scratch directory. Pipeline exit 0.

The model-list test feeds each `models_url` result into `curl_config`. Both `/apps/anthropic` hosts assert `Authorization: Bearer test-key` and the absence of `x-api-key`. `https://api.anthropic.com` asserts `https://api.anthropic.com/v1/models` with `x-api-key: test-key` and `anthropic-version: 2023-06-01`. The OpenAI `/v1`, `/v3`, and `/models` bases stay on those list URLs.

| Check | Result |
| --- | --- |
| `cargo test -p a3s-studio --lib -- --exact desktop_settings::tests::dock_reopen_shows_the_main_window desktop_settings::tests::hides_on_close_only_when_the_tray_is_on providers::tests::model_list_urls_follow_the_catalog_base` | 3 passed, 0 failed, 910 filtered out, 0.00s. Exit 0 |
| `cargo test -p a3s-code-core --lib -- --exact permissions::tests::seam_admission_permission_posture_denies_under_yolo fact_control::tests::parked_skill_ask_is_not_rewritten_as_unapproved` | 2 passed, 0 failed, 5288 filtered out, 0.11s. Exit 0 |
| `cargo test -p a3s-code-acp --lib -- --exact host_context::tests::research_denies_writes_and_keeps_caller_denies agent::permission_state_tests::research_cleanup_restores_current_mode_on_return_and_drop agent::permission_state_tests::mode_changes_cannot_relax_research_admission_and_new_denies_survive_cleanup` | 3 passed, 0 failed, 352 filtered out, 0.08s. Exit 0 |

`rustfmt --edition 2024 --check` is clean on `apps/studio/src-tauri/src/lib.rs`, `desktop_settings.rs`, and `providers.rs`. `rustfmt --edition 2021 --check` is clean on `policy.rs`, `permissions/tests.rs`, `fact_control_tests.rs`, `host_context.rs`, and `permission_state.rs`. Package-wide `cargo fmt` was not run.

`python3.13 tests/crate_drift_report.py --baseline tests/crate_drift_baseline.json` exited 1. `a3s-code-core` was already `CONTENT-DRIFT`. The ratchet named four new crates this change does not edit: `a3s-box-runtime`, `a3s-okf`, `a3s-runtime`, `a3s-use`. The baseline was not rewritten. The cloud copy of `policy_for_posture` was not edited.

## Explicitly not claimed

No Dock click on a running AsterDream. The process that is already open still has the old run loop. No live model HTTP request and no user API key. The three issue files stay 新建. This change is not committed. `apps/cloud` receipts and `policy_for_posture` were left as they were. 「始终允许」 is still bash-only. Default `read` outside a research turn stays Ask. The four filed sessions were not replayed. The research ceiling is the policy that matches the reported symptom. It is not evidence that those four sessions were research turns.

## Re-verification 2026-10-22

`cargo test --locked -p a3s-studio --lib` with the combined filter above:
11 passed, 0 failed, including
`desktop_settings::tests::dock_reopen_shows_the_main_window`,
`desktop_settings::tests::hides_on_close_only_when_the_tray_is_on`, and
`providers::tests::model_list_urls_follow_the_catalog_base`. The parent-side
posture and research-policy tests were re-run in the same pass (see the
crates/code commit for the exact filter).
