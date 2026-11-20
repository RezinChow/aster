# P4 — skill dir load order by trust (not alphabetical)

Date: 2026-11-16.  
Branch: `main`.  
Goal knife: Meta Harness **可信** (defect catalog P4).

## Change

`interactive_skill_dirs_under` no longer `sort()`s paths. Load order is
**home → configured → workspace/project** so the registry’s later-wins
override favors the project. Path dedup preserves first occurrence.

## Verification

```text
cargo test --locked -p aster-acp --lib interactive_skill_dirs_load_an_explicit_profile
→ ok
```

## Explicitly not claimed

- Product Pass / Meta Harness Done.
- Changing SkillRegistry override semantics (still later-wins).
- Studio H2 land/push.
