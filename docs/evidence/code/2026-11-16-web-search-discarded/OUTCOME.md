# web_search E4: discarded_chars + discarded_items

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

- Per-result JSON adds `discarded_chars` (title/content/full_text truncation).
- Success metadata adds `discarded_items` = available − returned.

≠ E4 Done / named YOLO Done.

## Commands / counts

```text
cargo test --locked -p aster-core --lib \
  tools::builtin::web_search::tests::json_search_result_bounds
# → 1 passed; 0 failed
```

## Explicitly not claimed

- E4 complete / HG2 Pass / named YOLO Done.
- Live search engine e2e.
