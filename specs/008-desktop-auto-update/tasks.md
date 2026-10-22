# Tasks: Desktop auto-update from GitHub Releases

**Input**: Design documents from `specs/008-desktop-auto-update/`

**Prerequisites**: plan.md (required, including its Constitution Check),
spec.md (required)

**House rule**: every task that changes behavior carries its hermetic
test in the same task. A task without that test is not done.

## Phase 1: Behavior and tests (host)

- [ ] T001 [US1] `apps/studio/src-tauri/src/app_updater.rs`: add the closed
      enum `FeedKind {gateway, github}` with `parse()`/`as_str()`; map
      `HostIdentity::Aster → FeedKind::GitHub`, keep `ToYou → gateway`.
      Hermetic test: identity→kind mapping is total and cross-tenant kinds
      refuse.
- [ ] T002 [US1] Manifest parser for `desktop-latest.json` → `ReleaseMeta`
      (+ url/size for the download step). Refusals: missing product,
      wrong product, missing `darwin-aarch64` platform entry, version not
      newer than current, JSON over `MAX_JSON`, truncated JSON. Hermetic
      tests: one per refusal on fixture bytes.
- [ ] T003 [US1] GitHub transport: fetch manifest and stream the archive
      via the providers curl pattern (config stdin, no argv secrets),
      honoring the manifest sha256 through the existing
      `stream_verified`-equivalent path. Hermetic tests: curl invocation
      shape (URL, headers, digest flag), connection errors map to
      `NotPublished`/`Failed` per the existing `connect_fail` table.
- [ ] T004 [US4] Channel isolation: under the Aster identity the gateway
      path is never called; under ToYou the GitHub path is never called;
      a manifest naming another product refuses with `ProductMismatch`.
      Hermetic test pins all three.
- [ ] T005 [US1] Wire `app_updater_check`/`app_updater_install` to the
      feed kind; `BusyGuard` and every existing verification/replace/
      rollback step unchanged. Test: the existing app_updater suite stays
      green and the counts grow only.

## Phase 2: Wiring (renderer + preference)

- [x] T006 [US2] Preference `app.update.auto_check` (default enabled,
      fail-closed read) through `data/classification.json` +
      `pnpm data:generate`; hermetic preference-schema test. — Landed as
      the EXISTING key `app.dist.auto_update.enabled` (already classified,
      default true; schema verified); no classification change needed.
- [x] T007 [US2] Auto-check scheduler: one check on About/settings mount
      and at most once per 24 h (persisted last-check timestamp in the
      preference store); disabled preference issues no request. Renderer
      vitest for mount/24 h/disabled/failure-does-not-block. —
      `useAppUpdateHandler` effect + persist cache key
      `app.dist.update_last_check`; vitest 26/26 incl. the two new cases.
- [x] T008 [US2] About page: reuse the existing state machine; add the
      auto-check toggle and the last-checked line; i18n keys in `en-us`
      + all locales translated. Renderer vitest updated. — 18/18 incl.
      the toggle row case; i18n:check green (22,140 entries).

## Phase 3: Pipeline (root repository)

- [x] T009 [US3] `.github/workflows/release-aster-desktop.yml` on
      `desktop-v*`: `just build-studio aster` → zip `Aster.app` → sha256 →
      generate/attach `desktop-latest.json`; refuse to regress an existing
      newer manifest version. Hermetic check:
      `tests/desktop_channel_manifest.py` (schema, digest, ordering,
      regression refusal) run on fixtures and on the generator output. —
      workflow_dispatch on macos-14 via `pnpm package:host`; inputs ride
      env vars; publish job regenerates against the currently published
      manifest before clobbering the `desktop-stable` channel release.
- [x] T010 [US3] Generator script lives with the workflow inputs (a small
      shell/python step or a checked-in script invoked by the workflow);
      the python contract test executes the same generator. —
      `scripts/desktop_release_manifest.py` (generate/check);
      `tests/desktop_channel_manifest.py` 4/4.

## Phase 4: E2E and evidence

- [ ] T011 [US1] Loopback e2e: local static server serving a fixture
      manifest + archive; a scratch tenant bundle; run the real
      check→download→verify→replace path and assert the relaunch script
      targets the scratch bundle; run the downgrade-refusal and
      digest-mismatch variants. Commands and counts recorded.
- [ ] T012 [US1] `docs/evidence/desktop/2026-10-22-desktop-auto-update/OUTCOME.md`
      with Result, What landed, Validation table, and Explicitly not
      claimed (no real GitHub release published — owner step).
- [ ] T013 Close the spec/task checkboxes; commit the studio submodule
      (signed) and the root lane (workflow, python check, spec, evidence)
      with the index guard.
