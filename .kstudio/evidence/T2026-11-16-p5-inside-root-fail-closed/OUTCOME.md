# P5 — `inside_root` fail-closed on canonicalize Err

Date: 2026-11-16.  
Branch: `main`.  
Goal knife: Meta Harness **可信** (defect catalog P5).

## Change

Untrusted `skill_dirs` / `agent_dirs` admission no longer falls back to lexical
`starts_with(root)` when `canonicalize` fails. Missing paths and dangling
symlinks are dropped (fail closed) so a later swap cannot escape the root.

## Verification

```text
cargo test --locked -p aster-core --lib untrusted_directories_fail_closed_when_canonicalize
→ ok

cargo test --locked -p aster-core --lib untrusted_directories_must_stay_inside
→ ok
```

## Explicitly not claimed

- Product Pass / Meta Harness Done.
- Studio H2 / gitlink land, A9 BG settle, daily-use E2E.
