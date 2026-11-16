# Core / ACP 9.2.7 and Aster CLI 0.3.9

## User-visible changes

- Codex→Aster mechanism absorption (P0–P2) lands in Core/ACP for daily use
  inside the existing CLI · Core/ACP · Studio product boundary: permissions
  self-test, effect rollout bounds, sandbox permission-profile codes, ACP wire
  surface golden, compaction ledger, forced-layer provenance, verified
  edit/patch codes, feature-stage registry, managed-only hooks, elicitation
  channels, skills partial load, and shared byte budgets. Evidence under
  `docs/evidence/*-2026-11-16/` and `.kstudio/wiki/Codex-Aster-Absorption.md`.
- Production wiring: HookEngine managed-only admission; workspace trust applies
  forced layers; ask_user / form / ACP `session/request_permission` share the
  elicitation ledger across host HITL; first-run placeholder ACL can open a
  session (`openModelConfig`) without inventing credentials while generation
  still fails closed.
- ACP hosts observe stable tool failure codes on bash/edit/patch `rawOutput`
  (`sandbox.violation.*`, `edit.*`, `patch.*`) and `initialize` projects
  `featureSwitchRegistryDigest`.
- Visual LH retrieval harness accepts kimi welcome chrome; long-horizon
  complex agent-desktop E2E re-verified on this tip
  (`docs/evidence/code/2026-11-16-long-horizon-complex-e2e/OUTCOME.md`).

## Qualification and delivery

Core remains a private/local Rust SDK. Core and ACP share version `9.2.7` and
source tag `aster-acp-v9.2.7`; ACP platform archives are produced by
`release-code.yml`. Aster CLI uses the independent version `0.3.9` and tag
`aster-cli-v0.3.9`, with `aster` and `aster-acp` built from one clean source
commit and distributed as a pair with shared BUILD_ID, SHA256SUMS and offline
embedding assets.

Required qualification follows `docs/release-governance.md` and the exact-source
branch runs of `qualify-code.yml` and `qualify-aster-cli.yml`. Platform archives,
member allowlists, versions and hashes must be checked before publication.
Both product releases use `--latest=false`; the desktop release retains GitHub
Latest. CLI stable and the current desktop Latest compatibility manifest must
point to the immutable CLI versioned release.

Prior published window: CLI `0.3.7` / ACP `9.2.5` (and ACP source tag
`aster-acp-v9.2.6` without a published `aster-cli-v0.3.8` Release) do **not**
include this absorption and production-wiring tip.

## Known limits

- Studio desktop release / gitlink land is out of scope for this CLI/ACP pair.
- Windows native gate (`win-gates`) was not re-run for this tip.
- ACP `__aster/execution/observe` double-underscore seam remains documented;
  changing it needs a coordinated Studio host change.
- Full `shipped_tui_e2e` suite residual flakes (BUILD_ID/env) are not claimed
  cleared by this revision.
- HG3-style “daily stable use” for end users still requires this versioned
  release to reach `aster-cli-stable` and client update/reinstall.
