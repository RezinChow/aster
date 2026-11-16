# elicitation-state-2026-11-16 (P2-10)

## Task

B · P2-10 unified elicitation state surface for Permission / AskUser / Form. Decision: `D-2026-11-16-p2-10-wave-lock`.

## Changes

- `crates/code/core/src/elicitation.rs`: channels, phases, begin/resolve/cancel, concurrent isolation.
- `crates/code/core/src/lib.rs`: `pub mod elicitation`.

## DoD

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Types cover three channels | `ElicitationChannel::{Permission,AskUser,Form}` |
| 2 | Concurrent two requests hermetic | `concurrent_requests_do_not_cross_deliver` |
| 3 | Cancel path | `cancel_path_marks_pending_cancelled` (hermetic; ACP conformance not re-run) |

## Commands

```bash
cargo test --locked -p aster-core --lib -- elicitation:: -- --nocapture
# exit 0 · 3 passed
```

## Explicitly not claimed

- 产品 Pass / 日常稳定使用 / commit·发布
- 统一成单一 UI 皮肤
- ACP cancel conformance 套件绿（本刀未跑）
- 替换既有 ask_user 运行时
