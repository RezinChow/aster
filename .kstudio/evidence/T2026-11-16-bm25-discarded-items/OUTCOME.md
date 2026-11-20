# E4 BM25 discarded_items

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

BM25 `search_metadata` / incremental catalog metadata expose
`discarded_items` = matching_files − selected_files (candidate cap).

Also: `incremental_search_metadata` takes ownership of rendered results
(avoids cloning metadata + anchors).

## Commands / counts

```text
cargo test --locked -p aster-core --lib -- bm25::
# → 17 passed; 0 failed (twice: discard + ownership move)
```

## Explicitly not claimed

- E4 Done / named YOLO Done.
