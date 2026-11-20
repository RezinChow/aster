# Search bounded_results discarded_items

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

Shared `bounded_results` (semantic / hybrid) now returns how many ranked
results were omitted when the output byte budget is hit, and both tools expose
`discarded_items` on metadata.

## Commands / counts

```text
cargo test --locked -p aster-core --lib search_snippet -- --test-threads=1
# → 5 ok (budget case asserts discarded == 21)

python3 scripts/verify-hermetic-perf-e2e.py --suite tui_913_hermetic --suite acp_conformance_stdio
# → 26/0
```

## Explicitly not claimed

- E4 Done / named YOLO Done / Meta Harness Pass.
- Headed Studio / live LLM.
