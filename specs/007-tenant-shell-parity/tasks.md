# Tasks: Aster/ToWork shell parity (phase B)

Each task names its verification. Product regime: hermetic renderer Vitest
only. Evidence lands in `docs/evidence/desktop/2026-10-22-tenant-parity-phase-b/`.

- **T0 — Baseline revert (done 2026-10-22, in working tree).**
  Verify: reference scan zero; AppShell + WorkbenchHome 124/124.
  Lands with T7.

- **T1 — Plugins rail parity.** Trace the aix catalogue feed to a named local
  source and record it; then remove `'plugins'` from `LOCAL_HIDDEN_APP_IDS`
  (`apps/studio/src/renderer/utils/sidebar.ts`). Refuse the flip if the feed
  proves org-sourced.
  Verify: `activityBarData.test.tsx` — aster mode projects the plugins rail
  entry at the canonical position (immediately after the org slot per
  `canonicalActivityBar`); redirect helper no longer displaces a plugins tab.

- **T2 — Shell skeleton parity test.** Render the shell in both tenant modes.
  Verify: new cases in `AppShell.test.tsx` — both stubs render the activity
  rail (`[data-testid="sidebar"]`) and the same content-frame
  `data-ui` parts; no tenant-conditional structural branch fires.

- **T3 — Tenant theme stamp test.** Read `utils/tenantTheme.ts` +
  `scripts/studioTenantBrand.ts`; assert the stamp is read from the document
  root and a saved user preference wins over any default.
  Verify: hermetic test in the owning test file (existing
  `scripts/studioTenantBrand.test.ts` stays green).

- **T4 — Assistant catalog source verification (read-only).** Confirm the
  published/preset catalogue is org-sourced in
  `hooks/useAssistantCatalogPresets.ts`; record the keep verdict. No code.

- **T5 — DESIGN.md wording check (read-only unless needed).** Scan for any
  wording that implies a second aster chrome; at most one sentence amended.
  No dual-state §11.

- **T6 — Evidence.** `OUTCOME.md` with commands, counts, the classification
  table, the fresh `PUBLIC_STUDIO_TENANT` gate scan, T1 trace, and an
  Explicitly-not-claimed section. Side-by-side captures: hermetic DOM
  comparison recorded; live `just dev` / `just dev:toyou` screenshots are
  owner-assisted (commands provided) unless the agent can run them.

- **T7 — Commit choreography.** Studio submodule: signed conventional commit
  (`git commit -S --signoff`) staging exactly the touched files (sidebar.ts,
  test files). Parent: spec/plan/tasks + evidence + the advanced gitlink.
  Guard: `git diff --cached --name-only` inspected before every commit; never
  stage another lane's in-flight files (the tree still carries them).
