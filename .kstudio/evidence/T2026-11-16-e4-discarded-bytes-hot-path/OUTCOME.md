# E4 partial — `discarded_bytes` on bash capture hot path

Date: 2026-11-16.  
Branch: `main`.  
Named YOLO scope: aster-core / aster-acp 效率（byte-budget vocabulary）.

## Change

1. Core `bash` capture metadata is built via `capture_output_metadata`, which
   always records `discarded_bytes` from `byte_budget::discarded_bytes`.
2. ACP `tool_raw_output` forwards `discarded_bytes` into Bash `rawOutput`
   (falls back to `total_bytes - output.len()` when Core omits it).

## Verification

```text
cargo test --locked -p aster-core --lib test_bash_bounds_long_single_line_and_reports_exact_capture_metadata
→ ok
cargo test --locked -p aster-core --lib sandbox_outer_timeout_includes_capture_summary_metadata
→ ok
cargo test --locked -p aster-acp --lib tool_cards_use_pager_kind_and_raw_input
→ ok
```

## Explicitly not claimed

- Full catalog E4 Done (`FileLog::freeze` still unwired; other tools may still
  omit shared budget helpers).
- Product Pass / overall GOALS Done.
