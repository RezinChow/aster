# ACP streaming emit alloc gates

Date: 2026-11-16.  
Branch: `main`.  
Named YOLO scope: aster-acp 性能 / 效率.

## Change

1. `emit_text` builds the `perf_probe` preview string only when the
   `perf_probe` target is enabled (eager alloc removed from the hot chunk path).
2. `emit_tool_call_output_delta` moves one 4k preview into content after
   `streaming_bash_delta` borrows it (no second `preview.clone()`).
3. Bash `tool_raw_output` owns stdout once, then clones the `Value` for
   `output` / `output_for_prompt` instead of allocating the string twice via
   `serde_json::json!`.
4. `emit_tool_call_output_delta` omits per-chunk `title`/`kind` (already set on
   start/started) to cut streaming JSON + String work.

TUI: layout/test call sites prefer `EntryRenderer::with_appearance_ref`
(hot path already used it; remaining test clones switched).

## Verification

```text
cargo test --locked -p aster-acp --lib tool_cards_use_pager_kind_and_raw_input
→ ok. 1 passed
```

## Explicitly not claimed

- Product Pass / overall GOALS Done.
- `BlockContext.appearance: AppearanceConfig` owned clone on scrollback cache
  miss (larger lifetime/Arc refactor — parked).
- Measurable wall-clock FPS / alloc flamegraph under headed Studio.
