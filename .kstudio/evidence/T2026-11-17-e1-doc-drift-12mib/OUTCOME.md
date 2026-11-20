# T2026-11-17-e1-doc-drift-12mib

Updated: 2026-11-17 · E1 doc honesty · ≠ E1 Pass · ≠ Meta Done

## Change

Defect-audit OUTCOME no longer claims absorption wiki still says 4 MiB. Code and wiki agree: `MAX_RECORD_BYTES = 12 MiB`.

## Verification

```text
rg "MAX_RECORD_BYTES" crates/effect/src/log.rs
→ 12 * 1024 * 1024

rg "12 MiB" .kstudio/wiki/Codex-Aster-Absorption.md
→ present
```

## Explicitly not claimed

- New effect-log behavior change
- Meta Harness Done
