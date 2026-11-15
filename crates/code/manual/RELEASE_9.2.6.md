# Core / ACP 9.2.6 and Aster CLI 0.3.8

## User-visible changes

- ACP stdio backpressure is no longer treated as a fatal internal error.
  Transient `WouldBlock` / `EAGAIN` (including macOS `os error 35`) on the
  NDJSON pipe is retried via `RetryTransientRead` / `RetryTransientWrite`
  instead of mapping through `into_internal_error` and tearing down
  `handle_io`. Real I/O failures such as Broken pipe remain fatal.
- The shipped pair wires the adapter on `aster-acp` stdio, the pager ACP
  child bridge, and the shell agent/leader connection paths so a full pipe
  or brief fd contention cannot end the session with `-32603`.
- Campaign evidence lives under
  `docs/evidence/code/2026-11-15-acp-stdio-egain/OUTCOME.md`,
  `docs/evidence/code/2026-11-15-acp-stdio-egain/E2E-OUTCOME.md`, and
  `docs/evidence/code/2026-11-15-acp-stdio-egain-residual/E2E-OUTCOME.md`.
  Core and ACP versions move with the CLI so the paired build identity,
  versioned tag and platform archives stay consistent under
  `docs/release-governance.md`.

## Qualification and delivery

Core remains a private/local Rust SDK. Core and ACP share version `9.2.6` and
source tag `aster-acp-v9.2.6`; ACP platform archives are produced by
`release-code.yml`. Aster CLI uses the independent version `0.3.8` and tag
`aster-cli-v0.3.8`, with `aster` and `aster-acp` built from one clean source
commit and distributed as a pair with shared BUILD_ID, SHA256SUMS and offline
embedding assets.

Required qualification follows `docs/release-governance.md` and the exact-source
branch runs of `qualify-code.yml` and `qualify-aster-cli.yml`. Platform archives,
member allowlists, versions and hashes must be checked before publication.
Both product releases use `--latest=false`; the desktop release retains GitHub
Latest. CLI stable and the current desktop Latest compatibility manifest must
point to the immutable CLI versioned release.

Prior published window: CLI `0.3.7` / ACP `9.2.5` (tag commit `1a8e38d51`) does
**not** include the stdio EAGAIN RetryTransient tip.

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
- Residual duplex / example ClientSide sites listed in the residual inventory
  are not all rewired in this revision; product Connection sites and the
  residual E2E nuclear cases are the release gate.
- The source tree's existing visual and live-model evidence describes its
  recorded candidate and environment. It does not establish a complete
  execution of the TUI catalogue, every provider reasoning mode, or native
  terminal behavior on an untested platform. Native process execution remains
  subject to its real host qualification and sandbox capabilities.
