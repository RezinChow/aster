# Local renderer R3: catalog and sidebar closure

Fresh-profile native CUA exposed two real residuals after R2. The local agent/session list read the published organization catalog; when local agents were empty, its denied member request was displayed as a session failure. The shared sidebar footer also still mounted organization workbench, notifications and the applet launchpad. The read-only original local source under the isolated Work archive confirms that its footer had only settings.

The minimal fix stays at the two owning seams. `useAssistantCatalogPresets.ts` disables the published member loader, its enabled hook and member refresh listeners in the statically selected `aster` build. Bundled local presets remain available. `SidebarShellActions` selects a settings-only Aster branch before mounting managed components or member subscriptions. The existing ToYou branch and its interactions remain intact. Native account denial was not weakened, session errors were not swallowed, and no stored preferences or user data were migrated.

Maintained RED evidence: `local-catalog-before.log` records the exact account error in actual mounted Sessions and the loading-hook failure; `local-footer-before.log` records the unwanted icon/full footer buttons. `local-catalog-footer-after.log` passes all three owning suites: **137 tests**. The Sessions fixture now models subscription cleanup correctly when the real catalog hook rerenders; intermediate ResizeObserver/phantom-listener fixture failures are explicitly recorded in the final receipt.

The synthetic native fixture was read through its actual discovery contract: authority `/api/agent-plane` returns the independent plane URL, then local agents and sessions return 200. Directly calling the authority as though it were the agent plane is not a valid test. `local-catalog-real-plane-before.json` contains only statuses/counts, with no bearer or session contents.

`local-r3-source-ready.json` binds **86 source/asset files**. Both actual production builds measured **98 unchanged inputs**. The immutable outputs are:

- `target/evaluations/studio-default-aster/renderer-local-r3-aster-20261021`
- `target/evaluations/studio-default-aster/renderer-local-r3-toyou-20261021`

Commands run from `apps/studio`: `A3S_TENANT_SLUG=aster|toyou STUDIO_RENDERER_DIST=<distinct output> NODE_ENV=production NODE_OPTIONS=--max-old-space-size=12288 node node_modules/@rsbuild/core/bin/rsbuild.js build`. Both passed. `renderer-local-r3-artifact-proof.json` binds the complete file/hash/mode manifests, canonical assets, Aster login-component absence and local-provider presence, and ToYou local-provider absence. R2 directories were not overwritten.

The real scoped compiler comparison has 33 diagnostics before and after with zero additions; whole-tree TypeScript is not claimed green. Five changed files pass formatting and diff checks. Scoped ESLint reproduces the same two pre-existing source-import errors against the actual baseline, with no additions or allowlist changes; this is not an all-green lint claim. Exact hashes, commands and limitations are in `local-r3-final-validation.json`.

Root owns final fresh-profile R3 GUI/native acceptance. This report does not claim that static artifacts replace CUA or that the earlier C-generation window/composer paint observation was fixed. No speculative visibility/remount change was made.
