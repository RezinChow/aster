# T2026-11-17-kburn-p0-readme-skip

Updated: 2026-11-17 · /k-yolo · ≠产品 Pass · ≠ HG6 关闭

## Slice

Skill 根目录旁路文档（`README.md` / `LICENSE` / …）不再作为 skill 候选，避免 `.kstudio/skills/README.md` 污染 `SkillLoadReport.errors`（kburn 工程包布局）。

## Commands

```bash
cargo test --locked -p aster-core --lib test_load_from_dir -- --nocapture
python3 scripts/verify-hermetic-perf-e2e.py --suite hg2_kburn_readme_skip
```

## Counts

| Check | Result |
| --- | --- |
| `test_load_from_dir` (+ errors empty) | **passed** |
| hermetic `hg2_kburn_readme_skip` | **exit 0**（filter 命中 8 相关 load_from_dir 测，0 failed） |

## Explicitly not claimed

- HG6 / Meta Harness Done
- All non-SKILL.md naming policies beyond listed stems
