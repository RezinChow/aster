# acp-permission-elicitation-2026-11-16

## Task

YOLO residual toward overall 「日常稳定使用」without self-granting commit/push: own the P2-10 `Permission` elicitation ledger on the ACP `session/request_permission` HITL path (not the Core hook gate).

## Changes

- `crates/code/core/src/elicitation.rs`: `permission_id`; `begin` may replace a terminal record (pending duplicate still fails closed); reopen unit test.
- `crates/code/core/src/agent/hook_runtime.rs`: remove premature Permission ledger open/close from `fire_permission_request` (hooks are not the host ask).
- `crates/code/acp/src/agent/permission_ask.rs`: `request_tool_permission` begins Permission on ask, resolves with option id on approve, cancels on deny/timeout/client error.
- `crates/code/acp/src/agent_tests.rs`: `permission_ask_records_elicitation_across_the_host_hitl` asserts Pending during the ask and Resolved(`allow-once`) after.

## Commands

```bash
cargo test --locked -p aster-core --lib elicitation::
# exit 0 · 4 passed

cargo test --locked -p aster-acp --lib permission_ask_records_elicitation_across_the_host_hitl
# exit 0 · 1 passed

cargo test --locked -p aster-acp --lib unanswered_asks_fail_closed_at_the_deadline
# exit 0 · 1 passed

cargo clippy --locked -p aster-acp --all-targets --no-deps
# exit 0 (existing test warnings only)

rustfmt --check --edition 2021 crates/code/core/src/elicitation.rs \
  crates/code/core/src/agent/hook_runtime.rs \
  crates/code/acp/src/agent/permission_ask.rs \
  crates/code/acp/src/agent_tests.rs
# exit 0
```

## Explicitly not claimed

- 产品 Pass / commit·推送·发布（HG3）
- ACP 全量套件 9 项环境/未诊断失败已修
- Question asks on `session/request_permission` also tagged Permission (still AskUser/form paths elsewhere)
- Studio / Windows 日常使用 oracle
