# TUI cancel banner_line static arm

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

`CancelledBy::banner_line()` returns a static `"{phrase}."` so
`estimate_line_widths` / no-elapsed `message()` skip allocating a temporary
String for the period suffix.

## Commands / counts

```text
cargo test --locked -p aster-pager --lib -- banner_line_is_phrase
# (plus hg2_estimate filter when run)
just hermetic-perf-e2e
# → 23 suites / 254 passed; 0 failed
```

## Explicitly not claimed

- Named YOLO Done / Meta Harness Pass / BlockContext Arc Done.
