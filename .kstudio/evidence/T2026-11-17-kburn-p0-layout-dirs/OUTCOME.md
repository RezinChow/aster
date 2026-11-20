# T2026-11-17-kburn-p0-layout-dirs

Updated: 2026-11-17 · /k-yolo · ≠产品 Pass · ≠ HG6 关闭

## Slice

kburn 吸收 **P0-2（窄刀）**：Core `kstudio` 模块暴露 layout-v1 默认绝对路径（workflow/evidence/wiki/skills…），并与 `agent_skill_roots` 的 `.kstudio/skills` 对齐可断言。

## Commands

```bash
cargo test --locked -p aster-core --lib kstudio:: -- --nocapture
```

## Counts

| Check | Result |
| --- | --- |
| `layout_v1_defaults_match_kburn_contract_core_names` | **1 passed** |
| `kstudio_skills_dir_aligns_with_agent_skill_roots` | **1 passed** |

## Explicitly not claimed

- Full factory vendoring / k-init assets in-tree
- Manifest JSON schema validation runtime
- HG6 close / Meta Harness Done
