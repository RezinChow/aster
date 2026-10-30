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

This record qualifies the source before push. Actual deployment and public
URL verification will be recorded after the GitHub Pages run completes.

## Explicitly not claimed

- No desktop/CLI binary release, sandbox release or private Studio source change.
- No whole-repository CI pass or new durable runtime acceptance campaign.
