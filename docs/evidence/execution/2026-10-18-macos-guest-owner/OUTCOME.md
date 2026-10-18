# Aster macOS Guest lifetime follow-up

Date: 2026-10-18. This is local development qualification, not a deployed backend or release.

The Guest adapter now passes the exact Core process identity to the paired shim. OCI Runtime commit `3189636cb` reuses its kqueue owner monitor at both the command shim and VM worker. Killing either owner can no longer leave the command generation running. The original Code adapter changes are retained in signed commit `cd3764c9`; Aster has the same adapter files.

The command script uses exclusive creation and immediately owns its cleanup. Existing regular files, symbolic links and hard links refuse without overwrite; the regression failed before the fix. The upstream `cb5b5521` availability provider is also integrated: known backend refusal is required context in the first model request, and recovery removes the old refusal. This does not enable an unqualified backend or start a probe from a context lookup.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Previous actual Guest owner/shim death | 2 expected failures, each with real readiness and a late write | [Before](native-before.log.gz) |
| Frozen signed shim, actual HVF | 5/5: normal output/host-visible bytes, wrong owner, shared group, host kill, shim kill | [After](native-after.log.gz) |
| Aster Core actual Guest lifecycle | All 7 checks passed: host write, outside-write refusal, network deny, setsid descendants, timeout, cancellation and indeterminate exit; 173.93 seconds | [Live run](core-frozen-live.log.gz) |
| Aster Core `sandbox` family | 63 passed, 0 failed, 2 opt-in tests separately executed | [Tests](sandbox-tests.log.gz) |
| Opt-in Bash routing soak | Passed; the other ignored case is the real Guest gate above | [Soak](routing-soak.log.gz) |
| Aster Core strict Clippy, `--lib --no-deps -- -D warnings` | Passed | [Clippy](core-clippy.log.gz) |
| Existing command-file regression before the fix | Expected failure; after the fix the complete Guest family passes | [Before](control-before.log.gz), [family](sandbox-tests.log.gz) |
| Aster CLI + ACP `cargo build --locked -p aster -p a3s-code-acp` | Passed; both binaries built together | [Build](consumer-build.log.gz) |
| `just build-work` | Compilation passed; repeated stable reads now show matching bundled ACP and Office digests; an earlier transient mismatch is retained for investigation | [Work build](work-build.log.gz), [identity mismatch](work-companions.json) |
| Producer `a3s-oci-krun` all targets | 76 passed, 0 failed, 0 ignored | [Producer tests](crate-tests.log.gz) |

[Source and artifact identities](source-identities.json) bind the adapter, context provider and frozen signed shim. The [image manifest](system-image.json) binds the immutable system image; it was built twice with identical bytes from the pinned Alpine archive and static PID-namespace supervisor. No user command was run in an unmediated host fallback. The tests used private disposable workspaces and only explicit per-test artifact paths.

## Explicitly not claimed

Default macOS native Shell remains refused. An earlier Work ACP byte/UUID mismatch resolved on later stable rechecks while other build/app processes were live. Its cause is not established; these observations do not prove a build-script defect or qualify concurrent-build publication. The Guest image and shim are developer fixtures outside the Aster repository, not product-bundled dependencies. The image supplies `/bin/sh`, not a qualified Bash/Python/openpyxl environment. Protected workspace metadata/credentials, stale control-file recovery, streaming/background execution, mediated network, complete Work-host → ACP → VM owner death and installed-product workflows remain open.

Aster's local Sandbox dependency remains 0.2.3; this slice does not claim the rest of the 0.3.0/R0/indexing migration. The original Code strict Clippy still has baseline diagnostics outside the two changed adapter files. No Linux/Windows qualification, production capability promotion, CI trigger, push or release is claimed.
