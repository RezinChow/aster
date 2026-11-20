# T2026-11-17-kburn-p0-layout-contract

Updated: 2026-11-17 · /k-yolo · ≠产品 Pass · ≠ HG6 关闭

## Slice

kburn P0-2 加深：Core vendoring `kstudio-project-layout.v1.json`（`KSTUDIO_PROJECT_LAYOUT_V1_JSON`）+ `kburn_skill_coverage`；ACP 宿主可组合 coverage API。

## Commands

```bash
cargo test --locked -p aster-core --lib kstudio:: -- --nocapture
cargo test --locked -p aster-acp --lib acp_host_can_compose_kburn -- --nocapture
```

## Counts

| Check | Result |
| --- | --- |
| Core `kstudio::` (7 tests at contract land) | **7 passed** |
| hermetic `hg2_kburn_skill_root` | **1 passed** |
| hermetic `hg2_kburn_layout_contract` | **1 passed** |
| hermetic `hg2_kburn_acp_coverage` | **1 passed** |
| pack slice | **3/3** failed_suites [] |

Hermetic pack suite count: prior 37 + 3 kburn graders → **40** declared（本 OUTCOME 未跑满 40 全量墙钟）.

## Explicitly not claimed

- Full factory skeleton vendoring
- Schema runtime validation of arbitrary manifests
- HG6 / Meta Harness Done
- Full hermetic-40 wall-clock green in this file
