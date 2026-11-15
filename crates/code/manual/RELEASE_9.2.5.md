# Core / ACP 9.2.5 and Aster CLI 0.3.7

## User-visible changes

- ACP disconnect recovery is hardened. The agent process keeps stdin
  line-buffered under cancel-safe I/O so fragmented UTF-8 frames no longer
  tear down the session when outbound traffic interleaves. Bridge exit and
  stderr diagnostics are retained so the TUI can bail with a locatable
  `Agent connection closed` path instead of a silent drop.
- Valid Cursor catalog misses are routed through `__parse_error` rather than
  fail-closed identity errors, so a missing tool in the live catalog no longer
  presents as a broken agent identity.
- Campaign evidence for the recovery and long-horizon closeout lives under
  `docs/evidence/code/2026-11-15-agent-connection-recovery/OUTCOME.md` and
  `docs/evidence/code/2026-11-15-phase7-campaign-final-closeout/OUTCOME.md`.
  Core and ACP versions move with the CLI so the paired build identity,
  versioned tag and platform archives stay consistent under
  `docs/release-governance.md`.

## Qualification and delivery

Core remains a private/local Rust SDK. Core and ACP share version `9.2.5` and
source tag `aster-acp-v9.2.5`; ACP platform archives are produced by
`release-code.yml`. Aster CLI uses the independent version `0.3.7` and tag
`aster-cli-v0.3.7`, with `aster` and `aster-acp` built from one clean source
commit and distributed as a pair with shared BUILD_ID, SHA256SUMS and offline
embedding assets.

Required qualification follows `docs/release-governance.md` and the exact-source
branch runs of `qualify-code.yml` and `qualify-aster-cli.yml`. Platform archives,
member allowlists, versions and hashes must be checked before publication.
Both product releases use `--latest=false`; the desktop release retains GitHub
Latest. CLI stable and the current desktop Latest compatibility manifest must
point to the immutable CLI versioned release.

Prior published window: CLI `0.3.6` / ACP `9.2.4` (tag commit `e74ecd8d9`) does
**not** include the disconnect-recovery tip `6c2916864`.

## Known limits

- The native sandbox still owns its internal command deadline. Progress-based
  cancellation is applied through the cancellation token so owned process
  cleanup is preserved, but the sandbox's own hard ceiling remains in effect.
- The 508-case shipped-TUI campaign is not complete: 7 PASS, 203 PARTIAL,
  298 NOT_RUN. PTY, static and Rust suite results are suite-level evidence and
  do not by themselves flip a campaign case to PASS.
- Studio host E2E / gitlink land is out of scope for this CLI/ACP pair release.
- `PTY-INPUT-005` remains an intermittent failure under full-suite runs. The
  harness records screen, composer and relay state on recurrence; no assertion
  was weakened and no retry was added.
- The 12-column composer rendering has no product layout test below 40 columns
  and is an undefined contract, not a proven defect or a harness false negative.
- The `delayed_catalog` flake is not claimed fixed in this revision.
- The source tree's existing visual and live-model evidence describes its
  recorded candidate and environment. It does not establish a complete
  execution of the TUI catalogue, every provider reasoning mode, or native
  terminal behavior on an untested platform. Native process execution remains
  subject to its real host qualification and sandbox capabilities.
