# Native Cordis review

## Scope and snapshot

Reviewed the native `capability::cordis` implementation, its tests and behavior
driver, the Cordis 4.0.4 reference fixture, and the Studio bridge/dependency
removal. Aster source `58be47b06655b193779e09ed14f314b9b4f08f0a`; Studio source
`bedc30698c2ad714ae4b4bc5d43e3e602040d84f`; unrelated dirty-tree changes were
not reviewed or modified intentionally.

## Findings and resolutions

1. Root dependency refresh could dispose all root-owned children. Reproduced by
   all initial plugin lifecycle tests. Fixed by excluding the root record from
   plugin dependency teardown; regression tests pass.
2. Failed activation could immediately retry through `refresh_all`, leaving the
   update test running. Reproduced and stopped. Failed activation now skips the
   global dependency refresh and drains owned effects; regression test passes.
3. The bridge removal initially left an empty document `sources` list. Fixed
   with an existing runtime source; the follow-up frontmatter run retains only
   9 unrelated existing violations.

No unresolved material finding was confirmed within the implemented service,
event, dependency, update, and disposal contracts.

## Verification boundary

- Native behavior replay: 6/6; original replay: 6/6; Core focused tests: 5/5.
- Clippy all targets completed with existing warnings and no Cordis warning.
- Studio dependency lockstep passed; bridge/Cordis/DSH entries are absent from
  its package manifest and lockfile.
- Project `review.py` / `--run`: not run because the collector cannot
  fingerprint a changed submodule. Its declared checks are not claimed.
- Full docs, full Core/Studio suites, non-macOS native behavior, complete
  JavaScript API parity, and product/headed acceptance remain unverified.

This is a verified named slice, not overall Meta Harness Done.
