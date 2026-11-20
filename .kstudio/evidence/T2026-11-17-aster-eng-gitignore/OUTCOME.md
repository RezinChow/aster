# T2026-11-17-aster-eng-gitignore

Updated: 2026-11-17 · Meta Harness / HG6 follow-through · ≠产品 Pass · ≠ migrate Done

## Change

Root `.gitignore` keeps product runtime under `.aster/*` ignored, but un-ignores
engineering markers (`MANIFEST.json`, `project.acl*`, `skills/`, `workflow/`,
`wiki/`, `evidence/`, …). `config.acl` stays ignored (often secrets).

## Verification

```text
git check-ignore -q .aster/config.acl     → ignored
git check-ignore -q .aster/sessions/foo   → ignored
git check-ignore -q .aster/MANIFEST.json  → trackable
git check-ignore -q .aster/skills/…       → trackable
git check-ignore -q .aster/workflow/…     → trackable
```

## Explicitly not claimed

- This-repo eng migrated from `.kstudio/` to `.aster/`
- Meta Harness Done / product Pass
- Secrets safe if someone force-adds `.aster/config.acl`
