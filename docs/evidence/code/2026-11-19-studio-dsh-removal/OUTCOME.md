# Studio DSH product and CLI removal

Updated: 2026-11-19

## Scope

Removed the existing DeepSeek Harness Agent runtime and DeepSeek Harness Code
CLI product support from Studio. The earlier `dsh-bridge` and native
compatibility experiments remain removed. Historical evidence and unrelated
Studio runtimes, providers, CLI tools, and user changes were preserved.

## Delivered

- Removed DSH from Agent type schemas, runtime capabilities, icons, launchpad,
  runtime e2e cases, and the Tauri agent domain.
- Removed DSH model/tool adapters, settings schemas, managed-process controller,
  config fields, IPC schema, provider filters, cache state, and Code CLI preset.
- Removed the DeepSeek Harness bundled skill, launchpad icon, product-manifest
  registration, dedicated tests, and runtime regression case.
- Removed DSH-specific test fixtures while retaining runtime-neutral message and
  tool projection coverage.
- `clean-plan.json` was reviewed; its generated-junk `delete` set was empty, so
  no helper deletion was applied.

## Verification

- Focused runtime/CLI suites: **82 passed, 0 failed**.
- Launchpad remaining cases: **12 passed**; another 8 failures were reproduced
  unchanged against the original pre-removal implementation, so they are
  pre-existing failures rather than regressions introduced by this cleanup.
- `pnpm i18n:check` — passed for **25,266 translations**.
- `cargo check -p aster-studio` — passed with existing warnings.
- Targeted `oxfmt --check` for all modified files — passed.
- `git diff --check` and `git diff --cached --check` — passed.
- Production search for DSH identifiers has no hits in `src/`.
- `.kstudio/workflow/review.py --run` could not fingerprint the dirty Studio
  submodule, so its declared checks are not claimed.

## Explicitly not claimed

- No full Studio build, full test suite, headed run, cross-platform run, or
  product Pass is claimed.
- Full TypeScript checks retain unrelated existing errors in `rsbuild.config.ts`,
  `electron-builder` types, WorkInbox, and other unchanged files.
- Pre-existing Studio DSH product/CLI catalog data outside the removed runtime
  remains historical data, not a claim of active DSH compatibility.
