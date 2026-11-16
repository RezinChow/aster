# first-run-session-open-2026-11-16

## Task

YOLO residual toward overall 「日常稳定使用」: first-run `~/.aster/config.acl` uses placeholder keys that must not become credentials, but `session/new` was failing closed before the host could open Models (`openModelConfig`). Restore openable first session without inventing keys.

## Changes

- `crates/code/acp/src/unconfigured_model.rs` (new): `UnconfiguredModelClient` refuses every generation with a configure-path message; `first_run_placeholder_client` attaches only when the model is declared and has no usable key.
- `crates/code/acp/src/agent/session_open.rs`: on `first_run_config`, inject that client into `SessionOptions` so Core skips provider-key resolution at open.
- Does not change placeholder stripping (`替换为你的密钥` → None) or allow placeholder keys on the wire.

## Commands

```bash
cargo test --locked -p aster-acp --lib unconfigured_model
# exit 0 · 2 passed

cargo test --locked -p aster-acp --test startup_error
# exit 0 · 3 passed (incl. first_run_template_is_loaded_before_opening_a_session)
```

## Explicitly not claimed

- 产品 Pass / HG3 commit·推送·发布
- Prompt 在无 key 时成功（generation 仍 fail closed）
- 非 first-run 缺 key 场景同样注入（仅 `first_run_config`）
- 其余 ACP 套件失败（BUILD_ID / boundary_e2e / shipped_tui 等）已修
