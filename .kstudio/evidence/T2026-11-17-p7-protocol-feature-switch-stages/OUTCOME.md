# T2026-11-17-p7-protocol-feature-switch-stages

Updated: 2026-11-17 · HG1 composability docs · P7 wire honesty · ≠ Meta Done

## Change

`crates/code/acp/PROTOCOL.md` documents `initialize` `_meta`:

- `featureSwitchRegistryDigest`
- `featureSwitches`
- `featureSwitchStages` (Stable ≠ enabled=true)

## Verification

```text
rg -n 'featureSwitchStages|Initialize feature-switch admission' crates/code/acp/PROTOCOL.md
→ section present
```

## Explicitly not claimed

- Hosts already consume `featureSwitchStages`
- Experimental call-site hard refuse
- Meta Harness Done
