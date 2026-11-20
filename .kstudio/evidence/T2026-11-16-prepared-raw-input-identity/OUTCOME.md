# prepared_raw_input identity skip + transcript replay remap

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

1. `prepared_raw_input`: non-remap tools return `args.clone()` without
   `as_object_mut` mutate path.
2. Transcript replay (`extensions.rs`) uses `prepared_raw_input` instead of
   bare `call.args.clone()` so pager card remaps apply on replay.

## Commands / counts

```text
cargo test --locked -p aster-acp --lib tui_mappings_cover_cards_catalog_and_questions
# → 1 ok
cargo test --locked -p aster-acp --lib -- extensions::
# (recorded below)
```

## Explicitly not claimed

- Named YOLO Done / Meta Harness Pass.
