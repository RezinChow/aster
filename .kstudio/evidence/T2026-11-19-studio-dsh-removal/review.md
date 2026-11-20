# Studio DSH removal review

## Findings and resolutions

- DSH remained in Agent and Code CLI product surfaces after the bridge removal.
  Removed the runtime, CLI registration, settings, controllers, resources,
  cache, launchpad, and dedicated tests rather than leaving a nonfunctional
  selector.
- One unused launchpad style constant remained after the shortcut deletion;
  removed it. No other changed-file TypeScript errors were reported by the full
  renderer check.
- Eleven modified files required formatting; only those files were formatted.
  Unrelated dirty-tree files were preserved.

No unresolved material finding was confirmed within the removal scope.

## Evidence boundary

Focused tests 82/82, launchpad remainder 12/12, i18n 25,266, Rust host check,
format and diff checks all passed. Eight other launchpad failures reproduced on
the original implementation and are explicitly not claimed as passing. Full
TypeScript/build/headed/cross-platform acceptance remains unverified. Project
review collector failed on dirty-submodule fingerprinting.
