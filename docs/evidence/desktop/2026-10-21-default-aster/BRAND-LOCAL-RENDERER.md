# Aster local renderer delivery

The latest user contract is implemented in `apps/studio`: `A3S_TENANT_SLUG=aster` builds AsterDream with local models and projects and no account/login UI or member/organization requests. `A3S_TENANT_SLUG=toyou` retains the managed product. The compiled selector is `import.meta.env.PUBLIC_STUDIO_TENANT`; product names do not grant capabilities. No data migration or user-state copy was performed.

`local-r2-source-ready.json` binds 81 source/asset files, including the protected runtime definition `apps/web/public/tenant/toyou/INFO.md` with its actual `toyou` slug and `ToWork` product. `renderer-local-r2-builds.json` measures 93 inputs before and after both production builds. All hashes matched. This fresh receipt supersedes the earlier optional-organization checkpoint. Earlier evidence paths and technical labels were externally rewritten; this report does not claim that old JSON hashes were preserved.

## Behavior

- Canonical AsterDream stars/orbit/icons and blue/silver light/dark defaults remain; saved custom theme colors win. The other tenant retains its existing appearance. Historical asset provenance stays in `brand-canonical-sources.json`; copied runtime assets are independently hashed in the new receipt.
- Aster restores the original local settings menu: general, model services, web search, document processing, shortcuts, archive and about. The actual `/settings/provider` route now admits Aster and still redirects managed/unknown builds. The model picker and complete local provider CRUD use native protocol metadata and persist the default/quick/translate tuple.
- Local rail/launchpad/open-tab projection excludes the exact member surfaces `messages`, `org`, `plugins`, `platform`; direct member-page navigation is rejected before mounting. Stored navigation is not migrated. The existing single-default-agent design remains; its disabled add-agent action was not converted into a new multi-agent feature.
- Aster mounts a brand-only sidebar, not the managed account wrapper. Account snapshots, member/organization transports, center publishing and organization-model hooks fail closed before a query. Local provider requests reject `a3s` rather than falling through to credentials. User-name/avatar preferences and avatar-file resolution are not subscribed for the local build; message bodies remain visible without account identity.
- A fresh Aster profile opens the workbench directly. The lazy login-onboarding module itself is conditional at build time: its compiled component is absent from all Aster JavaScript and retained in the managed build. Shared translation text is retained.
- Planning Switch geometry/keyboard/IME behavior, orange in-progress/green completed status and the parent's one-card plan rollup remain included. Approval titles reuse exact existing tool translations. No permission policy was weakened.

## Verification

Maintained RED evidence is in `local-design-before.log`, `local-no-account-before-valid-runtime.log`, `local-no-account-view-before.log`, `local-identity-pref-before.log`, and `local-member-route-before.log`. The initial invalid-runtime account fixture was corrected before production changes and is not counted as query-boundary evidence. Two intermediate assertions used a wrong locale label and ignored TanStack's lazy component wrapper; those fixture errors were corrected without product changes. The owning launchpad regression also now accounts for both intentionally retained hidden IDs (`mail`, `platform`) when ordering.

Final related coverage: 35 files / 464 tests passed; final MainApp 7 and Sidebar 5 passed after their last small changes. Existing native-dropdown and dialog-motion ratchets passed 3 and 20 tests. Scoped ESLint has zero errors and eight existing warnings; formatting and diff checks pass. The real scoped TypeScript overlay against `86a385b02077cdc7ef4213ef6541903c8f688748` has 28 diagnostics before and after, with no additions. This does not claim that whole-tree TypeScript is green. See `local-r2-final-validation.json` for exact logs and hashes.

## Production outputs and remaining GUI gate

Run from `apps/studio` with `A3S_TENANT_SLUG=aster` or `toyou`, `NODE_ENV=production`, `NODE_OPTIONS=--max-old-space-size=12288`, and a distinct `STUDIO_RENDERER_DIST`, then `node node_modules/@rsbuild/core/bin/rsbuild.js build`.

The final immutable outputs are:

- `target/evaluations/studio-default-aster/renderer-local-r2-aster-20261021`
- `target/evaluations/studio-default-aster/renderer-local-r2-toyou-20261021`

Both actual builds passed, with canonical assets and unchanged measured inputs. The managed output contains no local-provider module/native-authoring route markers; Aster has the local module and explicit account-query guards. `renderer-local-r2-artifact-proof.json` binds complete file/mode/hash manifests.

This is source, behavior-test and static-artifact evidence. Root owns native pairing and fresh-profile GUI acceptance. In root's older C generation, the composer disappeared after the final accepted approval; no source cause has been proven. No speculative visibility, remount or multi-select change was shipped. That observation remains open for the fresh R2 GUI run and must not be reported as fixed by this work.
