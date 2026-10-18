# ACP initialization failures

## Result

The original shipped ACP exited before replying to `initialize` because its
workspace-only default model had no provider in the trusted catalog. The pager
showed only a closed-channel error and an obsolete launch command.

ACP now returns a bounded configuration error through JSON-RPC. The error names
the missing model and the trusted configuration paths; session creation remains
refused. Workspace providers are not implicitly trusted. Unexpected transport
closure keeps separate executable/log guidance.

## Checks

- Both shipped binaries build with Rust 1.97.1 and the locked workspace.
- [Protocol contracts](protocol.log): 2 passed. A repository-only provider gets
  an actionable error without leaking its fixture key; it cannot create a
  session. A trusted local-only provider still initializes.
- [Existing trust-boundary contract](trust-boundary.log): 1 passed.
- [Actual terminal error](terminal-error.log): 1 passed, 5.39 seconds; the pager
  shows the model error before its connection deadline.
- [A3S Test startup](fixture-result.json): passed with isolated state and a
  local-only fixture provider, including three terminal sizes and animation.
- With the user's explicit authorization, only provider/default-model blocks
  were migrated to the user ACL using a3s-acl. Other host settings were
  preserved, the original was backed up, and the destination uses mode 0600.
  Direct initialization and the same actual-terminal startup flow then passed
  with that user configuration. Credentials and private configuration are not
  retained in this evidence directory.

## Explicitly not claimed

No model API request, release, Windows/Linux execution, or qualification of the
macOS native shell boundary. The full workspace format check reported a separate
Work platform-roots test import-format issue; the changed Rust files format
cleanly. The local internal-dependency boundary passed. The broader desktop
fixture gate separately reported a missing tenant INFO file during validation.
