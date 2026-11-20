# A2 — `update_plan` content + single in_progress

Date: 2026-11-16.  
Branch: `main`.  
Named YOLO scope: aster-core 高效（重复扇出 / token 浪费）.

## Change

`parse_plan_args` now refuses:

1. Duplicate truncated step **content** in one plan (plan execution keys by
   content; duplicate prose fans out duplicate work).
2. More than one `in_progress` step (matches the tool description contract).

Id uniqueness was already enforced.

## Verification

```text
cargo test --locked -p aster-core --lib update_plan_rejects_duplicate_step_content_and_multi_in_progress
→ ok. 1 passed
```

## Explicitly not claimed

- Product Pass / overall GOALS Done.
- Cross-turn plan merge / historical plan fingerprint store.
