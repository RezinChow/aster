# T2026-11-17-kburn-auto-arm

Updated: 2026-11-17 · ≠产品 Pass · ≠ HG6 全关

## Slice

GOALS Q13：Core **内化自动触发**；不要求 TUI/Studio。

- `arm_kburn_runtime`：仅当工作区已有 `.kstudio/` 时 materialize 缺失 seeds + 加载规范 `k-*`
- 会话装配 `build_effective_skill_registry` 自动调用
- 无 `.kstudio` 的仓跳过（不偷建工程树）

## Commands

```bash
cargo test --locked -p aster-core --lib arm_kburn_runtime -- --nocapture
```

## Counts

| Check | Result |
| --- | --- |
| `arm_kburn_runtime_skips_workspaces_without_kstudio` | **1 passed** |
| `arm_kburn_runtime_materializes_and_loads_when_kstudio_present` | **1 passed** |
| `test_session_skill_dirs_*` (2) | **2 passed** |

## Explicitly not claimed

- HG6 Done / Meta Harness Done
- TUI/Studio kburn UI
- Auto-creating `.kstudio` on every workspace
