# Off-viewport dirty heights use estimate_height

Date: 2026-11-16.
Branch: `main` @ dirty.

## Change

`update_dirty_entry_heights`: when a dirty entry does not overlap the viewport,
use `estimate_height` and leave `measured=false` so settle exacts on reveal.
Visible / overlapping entries still call `desired_height` + mark measured.

From hunt [off-viewport layout](2a01fc28-714a-4f52-bc81-339f98819839).

≠ named YOLO Done.

## Commands / counts

```text
cargo test --locked -p aster-pager --lib lazy_dirty_case2_settle_measures_revealed_region  # 1
cargo test --locked -p aster-pager --lib lazy_live_append_is_measured_immediately  # 1
cargo test --locked -p aster-pager --lib lazy_width_change_re_estimates_then_measures_viewport  # 1
```

## Explicitly not claimed

- Named YOLO Done; HG2 product Pass; headed-live.
