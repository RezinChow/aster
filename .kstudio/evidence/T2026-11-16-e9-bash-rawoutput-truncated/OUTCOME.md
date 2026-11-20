# E9 — Bash ACP `rawOutput` carries truncation

Date: 2026-11-16.  
Branch: `main`.  
Goal knife: Meta Harness **可组合/可信** observability (defect catalog E9).

## Change

`tool_raw_output` for bash/shell/execute reads `metadata.output.truncated`,
`timed_out`, and `total_bytes` into ACP `rawOutput` instead of hard-coding
`truncated: false`.

## Verification

```text
cargo test --locked -p aster-acp --lib tool_cards_use_pager_kind_and_raw_input
→ ok
```

## Explicitly not claimed

- Product Pass / Meta Harness Done.
- Streaming delta path (`streaming_bash_delta` still uses truncated:false for
  incremental slices — not a final capture).
- Studio H2 land.
