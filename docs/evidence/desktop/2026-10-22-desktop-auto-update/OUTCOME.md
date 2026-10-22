# Desktop auto-update from GitHub Releases — outcome

Date: 2026-10-22. Spec: `specs/008-desktop-auto-update/`. Product regime
(`apps/studio` + root workflow/tests). This lane replaces the Aster
desktop updater's `NotPublished` channel gate with the repository's own
GitHub Releases feed, adds the automatic check cadence, and ships the
publishing pipeline and its manifest contract check.

## Result

Landed. The Aster desktop updater reads the repository's GitHub Releases
channel, the automatic check cadence ships, and the publishing pipeline
plus its manifest contract are in place. No release is published yet:
the first `release-aster-desktop` dispatch is the owner's outward step.

## What landed

- Host feed branch (`apps/studio/src-tauri/src/app_updater.rs`): the
  closed enum `FeedKind {gateway, github}` maps Aster to the GitHub feed
  and ToYou to the unchanged gateway channel. The manifest
  `desktop-latest.json` parses into `ReleaseMeta` with per-refusal
  reasons; the archive download rides the providers curl pattern (config
  stdin, no argv secrets) and digest-verifies before `ReadyUpdate`.
  The manifest URL pins the dedicated channel tag `desktop-stable`
  (a `/releases/latest` URL would be subject to the whole repository's
  newest release, which the CLI also publishes to).
- Automatic check (`useAppUpdateHandler`): one check on mount plus an
  hourly re-arm, at most once per 24 h, gated by the existing preference
  `app.dist.auto_update.enabled` (default on) and a persisted
  `app.dist.update_last_check`. Automatic checks never toast "up to
  date" and never open the update dialog; install stays manual.
- About page: an auto-check toggle and a last-checked line, i18n in both
  locales.
- Pipeline: `.github/workflows/release-aster-desktop.yml`
  (workflow_dispatch, macos-14, `pnpm package:host` → sealed
  `Aster.zip` → manifest regeneration with regression refusal against
  the currently published manifest → assets clobbered onto the
  `desktop-stable` channel release). Inputs ride env vars, never bash
  interpolation.
- Contract check: `scripts/desktop_release_manifest.py` (generate/check)
  and `tests/desktop_channel_manifest.py` pinning the manifest schema,
  digests, and the version-regression refusal.

## Validation

| Command | Result |
| --- | --- |
| `CARGO_TARGET_DIR=.target-lane cargo test --locked -p a3s-studio --lib -- app_updater` (lane-private target; the shared target dir was lock-contended by a concurrent session) | 41 passed, 0 failed — includes the 6 new GitHub-feed cases and the loopback fetch+verified-download through real curl. The first lane run's `E0382/E0596` test-code errors were fixed before this count; an earlier run's exit 0 was `tail`'s, not cargo's |
| `./node_modules/.bin/vitest run --project renderer src/renderer/windows/main/hooks/__tests__/useAppUpdateHandler.test.ts src/renderer/pages/settings/AboutSettings/__tests__/AboutSettings.test.tsx` (apps/studio) | 26 passed, 0 failed — mount/due/stale/off cadence cases and the About toggle row |
| `./node_modules/.bin/tsx scripts/i18n-check.ts` (apps/studio) | pass, 22,140 entries (after the pre-existing sort repair) |
| `python3 tests/desktop_channel_manifest.py` | 4 tests OK — digest correctness, version-regression refusal (--force override), check acceptance, per-refusal naming |
| `python3.13 tests/just_work.py` / `python3.13 tests/workspace_dependencies.py` | 11 OK (1 skip) / 6 OK |
| `rustfmt --edition 2024 --check` on the three touched Rust files; `oxfmt` + `oxlint --deny-warnings` + `eslint` on the five touched TS files | clean (one pre-existing architecture import warning in AboutSettings, non-blocking) |
| `node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit -p tsconfig.web.json` | zero errors in the lane's files (pre-existing errors elsewhere remain) |
| `python3 -c yaml.safe_load(...)` on the workflow | parses; workflow_dispatch inputs version/notes; macos-14 runner |

## Pre-existing repair outside the lane's scope

`i18n:check` was red on main before this lane: three keys landed
mis-sorted by the concurrent desktop lanes
(`documents.compile_failed`, `knowledge.notes.compile_rewrite`,
`workbench.proof.binary_preview`). Both catalogs were re-sorted with the
checker's own comparator; the diff moves only those keys.

## Explicitly not claimed

- No real GitHub release was published; the first
  `release-aster-desktop` dispatch is the owner's outward step.
- The `AppHandle` glue between a `ReadyUpdate` and `install_zip` is not
  unit-reachable; the replace/relaunch/rollback internals remain proven
  by the existing `delivery_tests.rs` fixture suite.
- macOS notarization and an Ed25519 manifest signature are deferred
  (spec assumptions); the pinned codesign check stays the trust anchor.
- Auto-install, staged-rollout percentages, and delta updates are not
  claimed (spec).
