# T2026-11-17-kburn-p0-factory-bundle

Updated: 2026-11-17 · /k-yolo · ≠产品 Pass · ≠ HG6 关闭

## Slice

Vendored kburn `k-init` factory subset into Core (`contracts` + `kstudio-project-skeleton` + `kstudio-agent-rules`); `bundled_kstudio_*` paths + `materialize_kstudio_factory_seeds`（不覆盖已有文件）。

## Commands

```bash
cargo test --locked -p aster-core --lib bundled_factory_skeleton -- --nocapture
cargo test --locked -p aster-core --lib materialize_factory_seeds -- --nocapture
```

## Counts

| Check | Result |
| --- | --- |
| `bundled_factory_skeleton_contains_manifest_and_seed_paths` | **1 passed** |
| `materialize_factory_seeds_creates_missing_only` | **1 passed** |

## Explicitly not claimed

- Full kstudio-skills body tree vendored into Core
- Runtime JSON Schema validation
- HG6 / Meta Harness Done
