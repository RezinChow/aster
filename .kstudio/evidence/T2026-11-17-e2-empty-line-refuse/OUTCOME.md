# T2026-11-17-e2-empty-line-refuse

Updated: 2026-11-17 · defect catalog **E2** knife · ≠产品 Pass · ≠ Meta Harness Done

## Change

`FileLog` read no longer silently skips blank lines. A mid-file empty line
fails closed with `fact log contains an empty line`, matching the “never skip
a mid-file record” contract.

## Verification

```text
cargo test --locked -p aster-effect --lib empty_mid_file_line_refuses_the_whole_read
→ ok (1 passed)
```

## Explicitly not claimed

- Meta Harness Done / product Pass
- Repair of already-damaged production logs
- Change to append path (still writes newline-terminated JSONL)
