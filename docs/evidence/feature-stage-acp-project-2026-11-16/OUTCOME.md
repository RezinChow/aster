# feature-stage-acp-project-2026-11-16

## Task

YOLO residual: project P1-8 `feature_switch_registry_digest` on ACP `initialize` `_meta` so hosts can observe the mechanism stage table without a second bool bus.

## Changes

- `crates/code/acp/src/agent/protocol.rs`: `_meta.featureSwitchRegistryDigest` = Core digest string.
- Assertion in `tui_turn_renders_every_pager_event`.

## Commands

```bash
cargo test --locked -p aster-acp --lib tui_turn_renders_every_pager_event
# exit 0 · 1 passed
```

## Explicitly not claimed

- 产品 Pass / HG3
- 远程百分比放量
- Studio 消费该 digest
