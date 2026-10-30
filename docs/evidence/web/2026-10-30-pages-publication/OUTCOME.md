# Website publication qualification — 2026-10-30

The user requested committing, merging and pushing the website changes to
remote main and deploying GitHub Pages. The publication checkout starts at
`2f01c857782a424b8a89bc81f0cb61da6fef6585`, the fetched remote main.
Original dirty checkouts and indexes are kept in place.

## Selected change

- Restore the accepted violet galaxy, gather/spread cycle, layered star
  movement and glass download cards, together with the original regressions.
- Add ACL 0.3.0 and Flow 2.0.0, three source-owned guides and one architecture
  diagram each, with fixed source citations and version aliases.
- Order products through one catalog shared by the sidebar, product switcher
  and documentation homepage. Preserve every existing product record and URL.
- Regenerate the existing npm lock for clean installation and refresh the
  published download snapshot using the existing release-selection command.

Remote main already contains the complete sixteen-product documentation and
unified Astro pipeline. Those sources are inherited from main. In-flight ACP
API additions and unrelated local feature changes are not introduced by this
website publication. Earlier shared-workspace campaign reports are retained
separately; the checks below apply to this publication checkout.

## Checks before push

```sh
npm --prefix apps/web ci --workspaces=false --ignore-scripts --no-audit --no-fund
node apps/web/scripts/build_releases.mjs --refresh
JS_DOM_MODULE=/Users/roylin/code/aster/packages/ui/node_modules/.pnpm/jsdom@26.1.0/node_modules/jsdom \
  npm --prefix apps/web test
python3 apps/web/scripts/stage_site.py target/site-publish
```

- Clean install passed: [installation](publish-install.log.gz).
- Release selection passed using authenticated GitHub metadata, without
  retaining credentials: [selection](publish-release-refresh.log.gz).
- **20 Python and 133 JavaScript tests passed**, including galaxy lifecycle,
  new guide routes, search records, version aliases and shared menu ordering:
  [complete test log](publish-site-test.log.gz).
- **258 HTML pages** built, including **254 documentation URLs** for
  **18 products and 140 source pages**, plus homepage, download and legal pages.
- **306 staged files** equal the complete public allowlist and were reopened
  byte-for-byte against `dist/`: [staging receipt](publish-staging.json.gz).
- Every previous product record and documentation URL from remote main is
  preserved. [Qualification counts](qualification.json).
- Scoped `git diff --check` passed before commit. Files are staged explicitly;
  the original parent's 161 staged files and Studio's index remain separate.

## Publication status

Source commit `935ddc9c3bfb2607ef26a14e65ecb8b85e7c1c84` was signed locally
and fast-forwarded to remote main. Its first [Pages run](https://github.com/aster-ai-lab/aster/actions/runs/41037971172)
failed before deployment during `npm ci`: [CI failure](pages-first-failure.log.gz).
The local npm 11.19.0 lock regeneration omitted optional esbuild platform
packages required by CI's npm 11.6.2. Local npm success did not establish
compatibility with the pinned CI toolchain.

The failure was reproduced with the workflow's Node.js 24.12.0 and bundled
npm 11.6.2: [before](node24-lock-before.log.gz). Running the existing
`npm install --package-lock-only --workspaces=false --ignore-scripts --no-audit --no-fund`
with that toolchain regenerated a lock byte-identical to the original remote
main lock: [regeneration](node24-lock-regeneration.log.gz). No declared
dependency or existing package version changed. The development instructions
now name the same toolchain for installation and lock regeneration.

The pinned-runtime clean install and full **20 Python / 133 JavaScript**
checks passed: [install](node24-clean-install.log.gz),
[tests](node24-site-test.log.gz). All **306** restaged file hashes equal the
previously qualified site: [staging](node24-staging.json.gz).
The original parent and Studio HEADs and indexes remain unchanged:
[preservation check](worktree-preservation.json).

Actual successful deployment and public URL verification will be recorded
after the corrected GitHub Pages run completes. GitHub reports the local
signing key as `unknown_key`; this record does not claim GitHub Verified status.

## Explicitly not claimed

- No desktop/CLI binary release, sandbox release or private Studio source change.
- No whole-repository CI pass or new durable runtime acceptance campaign.
