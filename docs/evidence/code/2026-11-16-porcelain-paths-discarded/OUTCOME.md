# Porcelain changed_paths_discarded

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

When porcelain `attach` truncates `changed_paths` to `MODEL_CHANGED_PATH_CAP`
(32), metadata now includes `changed_paths_discarded` (omitted path count).

## Commands / counts

```text
cargo test --locked -p aster-core --lib porcelain::receipt_tests -- --test-threads=1
# → 39 ok (incl. non_git_delta…forty_paths discarded==8)
```

Hermetic pack: **19 suites / 250 / 0** (reconfirmed after prior knives).

## Explicitly not claimed

- Named YOLO Done / Meta Harness Pass / E4 Done.
- Headed Studio / live LLM.
