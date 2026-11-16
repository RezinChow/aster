# daily-use-production-wiring-2026-11-16

## Task

YOLO residual toward overall 「日常稳定使用」without self-granting commit/push: wire already-landed P1-6 / P2-9 / P2-10 mechanisms into live production paths; fix lib-link of `forced_layer`.

## Changes

- `hooks/engine.rs`: `HookAdmissionPolicy` on engine; `register_with_source`; managed-only ignores user hooks.
- `config/workspace_trust.rs`: `admit_untrusted_layers` uses `apply_forced_layers`; exposes `forced_layer_digest`.
- `config/mod.rs`: **fix** — `forced_layer` had been under `#[cfg(test)]` (lib build E0432); now a normal module.
- `ask_user.rs` + `ask_user_form` + `tool_completion_runtime`: elicitation ledger synced; Form vs AskUser channels.
- `agent/hook_runtime.rs`: Permission channel recorded on `fire_permission_request`.
- `elicitation.rs` tests: unique ids (no global `clear`) so parallel lib tests do not race.

## ACP residual note (not fixed)

`plugin_tools::tests::tool_context_cancellation_stops_the_actual_descendant` passes alone (exit 0); prior full-suite flake under load remains environmental. Other ACP suite failures (startup deepseek key, stale BUILD_ID, undiagnosed e2e) unchanged.

## Commands

```bash
cargo build --locked -p aster-core
# exit 0 (after cfg(test) fix)

cargo test --locked -p aster-core --lib -- managed_only_engine_ignores host_owned_paths elicitation:: ask_user_form -- --nocapture --test-threads=8
# exit 0 · 10 passed

cargo test --locked -p aster-acp --lib -- plugin_tools::tests::tool_context_cancellation_stops_the_actual_descendant -- --nocapture
# exit 0 · 1 passed (alone)
```

## Explicitly not claimed

- 产品 Pass / commit·推送·发布（HG3）
- ACP 全量套件 9 项失败已修
- ACP `session/request_permission` wire 端到端 conformance
- 「日常稳定使用」已达成（仍需 HG3 入库）
