# Entry and CI migration closure

The live desktop entrypoints now use `apps/studio`. `just work` remains a compatibility
alias to that host. Separate `build-work` and `build-work-release` recipes are removed.
Their continued presence failed the maintained recipe-discovery regression before removal.
This change does not delete the Work directory or certify the parent Office relocation.

A separate preflight regression found that `export TAURI_CONFIG="$(...)"` hid a failing
product helper: the export itself returned success and Cargo ran with an empty/default
configuration. The real Just entry for both products and the actual CI/Kylin shell bodies
failed four assertions before the fix. Each now assigns first, then exports. The positive
entry fixture also supplies valid INFO/logo assets, rather than passing while this error
was hidden. The current owning entry suite passes 9 tests.

CI now builds the renderer separately for `aster` and `toyou`. Each native product build
disables default features, selects one tenant feature, and runs the tenant and current
native updater contracts. The old Work updater, onefile installer, empty Work step and
Work frontend dispatch are removed. The existing Studio typecheck baseline is not claimed
fixed by removing the obsolete Work-only typecheck command.

The broader root input-method suite now targets the current launcher. Eleven mechanisms
remain: daemon selection, GDK detection/failure behavior, filtered-bus environment,
independent fcitx caches, actual GDK fallback under Xvfb, actual display-specific Fcitx4
service detection on an isolated bus, and cache rewriting. Only the old installer-wording
case is retired. Application-generation integrity is separately tested by the 18 delivery
cases; the environment unit seam does not bypass the shipped launcher's SHA verification.

- Export before: [4 failing assertions](delivery-config-export-before.log); after:
  [8 tests pass](delivery-config-export-after.log).
- Removed recipe before: [1 failure](delivery-retired-work-entry-before.log); final
  [9 entry tests pass](delivery-retired-work-entry-after.log).
- Linux [11 input-method mechanisms pass](delivery-current-ime-mechanisms-final.log),
  including both native prerequisites. The first run had one missing-GI skip; the owned
  container's test dependency was installed and the full suite rerun.
- [Parsed CI and real shell-loop probe](delivery-ci-skills-closure-probe.json): eight recorded
  Cargo calls retain exact product identities and features, including the builtin skill
  resolver contracts. The package generation step runs the 25 sealer/helper tests.
  This probe does not compile
  Rust or certify remote GitHub Actions execution.
- [Retired test archive](retired-work-tests/manifest.json) retains the complete original
  old updater/onefile tests and the pre-port input-method source with hashes.

No user profile, feed, application installation, Git index or Work directory was changed
by this entry/CI closure. Final native/renderer artifacts remain the parent's integration gate.
