# T2026-11-17-kburn-p0-kstudio-skill-root

Updated: 2026-11-17 · /k-yolo · ≠产品 Pass · ≠ HG6 关闭

## Slice

kburn 吸收 **P0-1**：Core `agent_skill_roots` 将 `.kstudio/skills` 列为一等 root（末位）；ACP watch/load 同根；hermetic 证明可加载 `k-*`。

## Commands

```bash
cargo test --locked -p aster-core --lib kstudio_skills -- --nocapture
# → 2 passed (agent_skill_roots_include_kstudio_skills_last · kstudio_skills_load_as_first_class_registry_entries)

cargo test --locked -p aster-acp --lib skill_dirs -- --nocapture
# → (see verification below)
```

## Counts

| Check | Result |
| --- | --- |
| Core `kstudio_skills` filter | **2 passed** |
| ACP `project_kstudio_skills_load_after_other_project_roots` | **1 passed** |
| ACP `workspace_and_home_skill_roots_are_loaded_when_they_exist` | **1 passed** |
| ACP `watched_skill_dirs_include_home_agent_roots_before_they_exist` | **1 passed** |

## Explicitly not claimed

- HG6 full close / Meta Harness Done
- kburn factory vendoring / full layout API (see P0-2 evidence if present)
- 12×`k-*` body embedded in Core binary
- push / commit / headed E2E
