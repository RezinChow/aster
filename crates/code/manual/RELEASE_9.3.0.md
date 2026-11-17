# Core / ACP 9.3.0 and Aster CLI 0.4.0

## User-visible changes

- Meta Harness knives since 9.2.7 / 0.3.9: P7 Experimental call-site hard refuse
  (`feature_switch_call_site_allowed`); dynamic registration refuses Experimental
  and Removed feature-switch tools; ACP `PROTOCOL.md` documents Stable vs
  Experimental honesty.
- Appearance Arc (HG2): shared `Arc<AppearanceConfig>` through AppView →
  scrollback → `BlockContext` / entry render path; pager README architecture
  diagrams.
- Aster slash-gate: `/init` on `ASTER_EFFECTIVE_COMMANDS`; word-select tip
  prompt-divergence asserts; `app_view` suite green (280).
- Defect-catalog honesty closes: A7 FG lease inherits parent; B1/B2 parallel
  write contract; D1/D2/F2 known/intentional seams.
- Prior 9.2.7 absorption (permissions, elicitation, feature-stage registry,
  compaction ledger, byte budgets, sandbox profile codes) remains in the pair.

## Qualification and delivery

Core remains a private/local Rust SDK. Core and ACP share version `9.3.0` and
source tag `aster-acp-v9.3.0`; ACP platform archives are produced by
`release-code.yml`. Aster CLI uses the independent version `0.4.0` and tag
`aster-cli-v0.4.0`, with `aster` and `aster-acp` built from one clean source
commit and distributed as a pair with shared BUILD_ID, SHA256SUMS and offline
embedding assets.

Required qualification follows `docs/release-governance.md` and the exact-source
branch runs of `qualify-code.yml` and `qualify-aster-cli.yml`. Platform archives,
member allowlists, versions and hashes must be checked before publication.
Both product releases use `--latest=false`; the desktop release retains GitHub
Latest. CLI stable and the current desktop Latest compatibility manifest must
point to the immutable CLI versioned release.

Prior published window: CLI `0.3.9` / ACP `9.2.7`.

## Known limits

- Studio desktop release / gitlink land is out of scope for this CLI/ACP pair.
- Windows native gate (`win-gates`) was not re-run for this tip.
- ACP `__aster/execution/observe` double-underscore seam remains documented;
  changing it needs a coordinated Studio host change.
- Headed daily-use GUI Pass is not claimed by this revision.
- Overall GOALS「日常稳定使用」product Pass is not claimed from this channel bump
  alone (%≠Pass).
