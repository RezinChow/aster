# T2026-11-17 A4 — enumerable skill same-name overrides

## Change
`SkillLoadReport` gains `overrides: Vec<SkillLoadOverride { name, path }>` so
later-wins shadowing is observable (warn alone was silent to hosts/tests).
Precedence unchanged.

## Command
```bash
cargo test --locked -p aster-core --lib test_load_from_dir_duplicate_name_overrides_previous_definition
# ok · 1 passed
```

## Explicitly not claimed
- Trust-ordered skill dir precedence change (P4 already closed separately)
- Meta Harness Done / product Pass
