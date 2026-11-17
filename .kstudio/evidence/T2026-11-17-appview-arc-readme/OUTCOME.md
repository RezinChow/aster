# T2026-11-17-appview-arc-readme

Updated: 2026-11-17 · `/go` · D · Appearance Arc diagrams in pager README · ≠ HG2 Pass

## Change

`crates/terminal/crates/codegen/aster-pager/README.md`:

- Key Concepts bullet for Appearance Arc
- Section **Appearance sharing (HG2)** with ASCII ownership / write-path / read-path diagrams (same box style as this README + shell README, not mermaid)
- Layer table for AppView → Scrollback → EntryRenderer → BlockContext

## Verification

```text
git diff --check -- crates/terminal/crates/codegen/aster-pager/README.md
→ clean
```

## Explicitly not claimed

- HG2 / Meta Harness Pass
- Cordis / DeepSeek plugin design docs
