# Core / ACP 9.2.4 and Aster CLI 0.3.6

## User-visible changes

- Long-running shell commands no longer get cut off by a short fixed time
  budget. The bash tool now asks the model to estimate each command's duration
  explicitly (builds, installs, migrations and full test suites commonly need
  5-30 minutes), and its fallback moved from 2 minutes to 10 minutes. A timeout
  is reported as a budget decision with an actionable retry hint, not as a
  command failure.
- Command execution is progress-aware. Output chunks renew the no-output
  budget; only a command that goes silent is treated as stalled, with an
  absolute ceiling retained as a runaway guard. An explicit model-supplied
  timeout is still honoured exactly. Timeout results now carry a progress
  snapshot (elapsed time, last output, output chunks) so a caller can tell a
  slow-but-healthy command from a deadlock.
- Core and ACP have no independent feature change in this revision. Their
  versions move with the CLI so the paired build identity, versioned tag and
  platform archives stay consistent under `docs/release-governance.md`.

## Qualification and delivery

Core remains a private/local Rust SDK. Core and ACP share version `9.2.4` and
source tag `aster-acp-v9.2.4`; ACP platform archives are produced by
`release-code.yml`. Aster CLI uses the independent version `0.3.6` and tag
`aster-cli-v0.3.6`, with `aster` and `aster-acp` built from one clean source
commit and distributed as a pair with shared BUILD_ID, SHA256SUMS and offline
embedding assets.

Required qualification follows `docs/release-governance.md` and the exact-source
branch runs of `qualify-code.yml` and `qualify-aster-cli.yml`. Platform archives,
member allowlists, versions and hashes must be checked before publication.
Both product releases use `--latest=false`; the desktop release retains GitHub
Latest. CLI stable and the current desktop Latest compatibility manifest must
point to the immutable CLI versioned release.

The macOS PTY qualification suites now wait for the same observable state they
assert (index counts and semantic candidates rather than a phase flag alone),
and screen waits share a bounded render floor instead of per-call 2-second
guesses. No assertion was weakened and no test was skipped.

## Known limits

- The native sandbox still owns its internal command deadline. Progress-based
  cancellation is applied through the cancellation token so owned process
  cleanup is preserved, but the sandbox's own hard ceiling remains in effect.
- The 508-case shipped-TUI campaign is not complete: 7 PASS, 203 PARTIAL,
  298 NOT_RUN. PTY, static and Rust suite results are suite-level evidence and
  do not by themselves flip a campaign case to PASS.
- The agent-desktop visual E2E lane was blocked in the recorded environment
  because `/bin/ps` was denied, so no native-window case was executed there.
- `PTY-INPUT-005` remains an intermittent failure under full-suite runs. The
  harness records screen, composer and relay state on recurrence; no assertion
  was weakened and no retry was added.
- The 12-column composer rendering has no product layout test below 40 columns
  and is an undefined contract, not a proven defect or a harness false negative.
- The source tree's existing visual and live-model evidence describes its
  recorded candidate and environment. It does not establish a complete
  execution of the TUI catalogue, every provider reasoning mode, or native
  terminal behavior on an untested platform. Native process execution remains
  subject to its real host qualification and sandbox capabilities.
