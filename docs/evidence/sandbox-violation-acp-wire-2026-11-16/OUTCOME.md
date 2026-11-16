# sandbox-violation-acp-wire-2026-11-16

## Task

YOLO residual toward overall 「日常稳定使用」: propagate Core stable tool failure codes onto ACP `rawOutput` so hosts observe them without parsing message text (P0-3 sandbox + P1-7 edit/patch residuals).

## Changes

- `crates/code/acp/src/agent/tool_render.rs`: `tool_raw_output` takes optional metadata; bash includes `sandbox_violation.code`; edit/patch failures include `edit.code` / `patch.code` as structured rawOutput.
- `crates/code/acp/src/agent/emit.rs`: passes tool metadata into `tool_raw_output`.
- Hermetic assertions in `tool_cards_use_pager_kind_and_raw_input`.

## Commands

```bash
cargo test --locked -p aster-acp --lib tool_cards_use_pager_kind_and_raw_input
# exit 0 · 1 passed

cargo test --locked -p aster-acp --lib -- tool_publication
# exit 0 · 4 passed

rustfmt --check --edition 2021 crates/code/acp/src/agent/tool_render.rs \
  crates/code/acp/src/agent/emit.rs \
  crates/code/acp/src/agent_tests.rs \
  crates/code/acp/src/agent/tool_publication_tests.rs
# exit 0
```

## Explicitly not claimed

- 产品 Pass / HG3 commit·推送·发布
- ksandbox 原生 typed 违规适配
- effect 事实日志单独传播这些码
- Studio UI 展示这些码
