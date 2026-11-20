# Remove native Cordis and DSH compatibility

Updated: 2026-11-19

## Scope

The user cancelled the compatibility campaign and requested complete removal of
the native Cordis kernel and the new DSH compatibility implementation.

## Delivered

- Removed `capability::cordis`, including the native kernel, DSH profile/host,
  Node executor, tests, examples, fixtures, and downloaded research copy.
- Removed the Cordis-only `semver` dependency from `aster-core`.
- Restored Core architecture manuals to their pre-Cordis wording.
- Preserved the earlier Studio DSH bridge deletion and dependency cleanup.
- Preserved historical evidence and task ledgers as required by the repository.

## Verification

- `cargo check -p aster-core --lib` — passed; existing unrelated warnings remain.
- Targeted `git diff --check` — passed.
- `git diff --exit-code` for the Core manifest, capability module, and restored
  manuals — zero diff against the original files.
- Production search hits for the removed API are absent; remaining matches are
  historical evidence or ledger entries.
- Studio `package.json` and `pnpm-lock.yaml` retain no Cordis or `dsh-bridge`
  package entries.

## Explicitly not claimed

- No Cordis kernel or DSH plugin compatibility remains in Aster Core.
- No full Core/Studio test suite or product Pass is claimed.
- Historical evidence documents prior experiments; it does not claim that the
  removed implementation still exists.

## Final cleanup audit

- `pnpm install --ignore-scripts --frozen-lockfile` synchronized Studio's
  dependency directory and removed the deleted DSH packages without running
  lifecycle scripts.
- No `node_modules/@deepseek-ai/**/package.json` or DeepSeek entries under
  `node_modules/.pnpm` remain in Studio.
- Removed all `target/debug/examples/cordis_behavior*` build artifacts.
- No plugin executor, DSH fixture, or Cordis behavior process remains.
- `pnpm --config.verify-deps-before-run=false deps:check` passed.
- Final production search for the removed host, service, module, example, and
  adapter identifiers has no hits outside the historical task ledger.
- Pre-existing Studio DSH product/CLI catalog code was not part of the added
  compatibility layer and was not deleted as an unrelated scope expansion.
