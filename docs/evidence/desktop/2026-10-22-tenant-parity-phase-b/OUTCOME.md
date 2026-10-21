# Tenant shell parity phase B — outcome

Date: 2026-10-22. Spec: `specs/007-tenant-shell-parity/`. Studio submodule,
product regime. All changes land inside `apps/studio` plus this evidence.

## What landed

1. **Baseline revert (T0)** — the terminated session's asterShell lane was
   removed from the working tree the same day: `AppShell.tsx`,
   `AppShell.test.tsx`, `WorkbenchHome.tsx`, `WorkbenchHome.test.tsx`
   restored to HEAD; `AsterShellNav.tsx` deleted; the orphan i18n key
   `workbench.nav.section.use` removed from both locales. Reference scan
   (`asterOmitsActivityBar|asterNavClass|AsterShellNav|aster.shell-nav`)
   returns zero.
2. **Plugins rail parity (T1)** — `'plugins'` removed from
   `LOCAL_HIDDEN_APP_IDS` (`apps/studio/src/renderer/utils/sidebar.ts`).
   The aster rail now projects `[agents, knowledge, plugins]`; a plugins
   tab no longer redirects. `messages`, `org`, `platform`, `mail`,
   `schedule` stay hidden (account-bound).
3. **Shell skeleton parity test (T2)** — `AppShell.test.tsx` renders the
   shell under both tenant stubs and asserts the same rail + content
   skeleton.
4. **Tenant theme stamp verification (T3)** — the existing
   `utils/__tests__/tenantTheme.test.ts` (already at HEAD) covers the
   contract: stock green without a stamp; the stamp wins over an empty or
   stock-green preference; a preference the user chose wins over the stamp;
   a non-6-digit-hex stamp is ignored. Re-verified green. An agent-drafted
   duplicate was caught against the staged diff and discarded before
   commit; no test file changed for T3.
5. **Assistant catalog verification (T4, read-only)** —
   `useAssistantCatalogPresets.ts:221-224`: the published catalog is
   `memberRequest('/api/catalog-agents?pageSize=100')` — the org Console
   catalog behind a member session. Verdict: account-bound, keep.
6. **DESIGN.md wording check (T5, read-only)** — scan for tenant wording
   found only the header scope and the §"tenant brand" statement (lines
   19–20), which already says the stamp does not paint this chrome. No
   dual-state wording exists; no amendment needed.

## T1 trace (the unify decision)

PluginStorePage → `useSyncExternalStore(subscribeAixCatalogue)` →
`services/plugins/aixCatalogueStore.ts` (pure pub/sub) →
`publishInstalledCatalogue` (`components/plugins/ExtensionPointHost.tsx:17`)
→ `AixWorkbenchRuntime.tsx:582` → `readAixWorkbench`
(`services/plugins/aixWorkbench.ts:52`) →
`fetch(`${runtime.apiBaseUrl}/api/aix/views`)` with
`runtime = readStudioRuntime()` — the **local native AIX host** that ships
with the app (`@shared/studioRuntime`). When the host is absent the call
throws "Native AIX host is unavailable" and the runtime degrades to the
EMPTY catalogue with a warning log — fail closed, no org fallback. The
catalogue is local-host-sourced, not org-OS-sourced, so the gate unifies.

## Classification (the closed set)

| # | Site | Verdict |
| --- | --- | --- |
| 1 | `LOCAL_HIDDEN_APP_IDS`: `messages`, `org`, `platform` | keep (account-bound: message center / org membership / platform admin) |
| 2 | `LOCAL_HIDDEN_APP_IDS`: `plugins` | **unified** (T1, trace above) |
| 3 | aster rail-hide `mail`, `schedule` | keep (team sidebar carriers, DESIGN.md §11) |
| 4 | `im/useIm.ts` (3 gates) | keep (managed message center) |
| 5 | `useAvatar.ts`, `useUserName.ts` | keep (managed identity) |
| 6 | `MainApp.tsx` onboarding `null` | keep (account login flow) |
| 7 | `MessageHeader` + `useMessageHeaderCapabilities` | keep (managed user profile) |
| 8 | `useAssistantCatalogPresets` (3 gates) | keep (org Console catalog, T4) |
| 9 | `ShellTabBarActions` variant | keep (org workbench / inbox / launchpad behind `orgId`) |
| 10 | `app/Sidebar.tsx` variant | keep content (local product identity vs account header); same `UISidebar` skeleton — T2 test pins it |
| 11 | `settingsMenu` local-model pages | keep (specs/004 FR-013 BYOK contract) |
| 12 | native `tenant-aster` / `tenant-toyou` features | keep (mutually exclusive builds, specs/004 FR-009) |
| 13 | `tenantBrand.ts` | sanctioned brand mechanism, not a gate |
| 14 | `utils/tenantTheme.ts` stamp | verified + tested (T3) |

Fresh gate scan (`grep -rn "PUBLIC_STUDIO_TENANT" src/renderer src-tauri/src
scripts/`) after the change returns the sites above and nothing new.

## Commands and counts

- `./node_modules/.bin/vitest run --project renderer` on
  `sidebarShortcuts.test.ts`, `tenantTheme.test.ts`, `AppShell.test.tsx`,
  `Sidebar.test.tsx`, `activityBarData.test.tsx`:
  **69 passed / 1 failed (70)**. The one failure is pre-existing and
  environmental, proven by re-running with the T1 edit stashed (HEAD
  state): the same `数据 ActivityBar > opens the data page` test fails
  identically with "SQLite file is unavailable" from the
  `use-registry` child engine. Not claimed as related.
- Baseline revert verification (earlier the same day):
  `AppShell.test.tsx` + `WorkbenchHome.test.tsx` = **124/124**.
- `./node_modules/.bin/oxlint` + `eslint` on the four changed files: clean.
- Locale integrity: `JSON.parse` on both locale files after the key
  removal; neighbors verified.

## Explicitly not claimed

- Live `just dev` / `just dev:toyou` side-by-side screenshots: owner-run
  (`just dev`, then `just dev:toyou`; the shell should match except name,
  logo, default accent, and aster lacking 消息/团队/平台). No agent-run
  capture exists in this directory.
- Full `pnpm lint` / `pnpm test` workspace gates: the pnpm binary is not on
  the agent shell's PATH; the targeted vitest/oxlint/eslint runs above
  stand in. CI runs the full gate.
- Phase A (login / org / IM on aster): out of scope; requires a specs/004
  FR-007/FR-013/FR-014 amendment first.
- The dead session's other uncommitted lanes (CUA, knowledge compile,
  documents, taskConversation, dev server tenant script, e2e py) remain
  untouched in the working tree, awaiting owner triage.
- Data-isolation contracts (bundle IDs, stores, locks, namespaces) are
  untouched.

## Files changed (this epic, studio submodule)

- `src/renderer/utils/sidebar.ts` (one line: hidden set)
- `src/renderer/utils/__tests__/sidebarShortcuts.test.ts` (updated
  parametrized expectations + new aster rail-order case)
- `src/renderer/components/layout/__tests__/AppShell.test.tsx` (new parity
  pair)
