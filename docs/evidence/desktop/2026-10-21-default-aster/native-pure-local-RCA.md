# Pure-local Aster native closure and Work dependency retirement

The user's later requirement replaces optional organization access in the Aster build. Aster is now local-only. ToYou retains its managed sign-in and organization policy. The canonical Cargo members remain `apps/studio`; the externally created `apps/desktop` symlink is not used as a Cargo workspace identity.

## Native boundary

`RuntimePolicy::LocalOnly` is compiled only with `tenant-aster`. The Aster login HTML, JavaScript and login images are not compiled into the native shell. Its root/index, shell client, QR/background routes return 404. Member-session read/profile/save/logout, gateway credential, model-service and organization/member relay dispatch are unavailable. The separate local agent/session/provider APIs retain the existing host bearer guard.

The local member store does not read or write a member-session file or machine sign-in ID. The local preference scope is selected before consulting any member store, including when an in-memory synthetic member is supplied. The three device defaults still use the existing device ACL. No member identity or organization bearer is invented.

Local provider lookup/listing omits managed providers; a3s execution credentials and defaults are refused for the local store. The local PlaneConfig skips member credentials and does not mount cloud/mail organization endpoints. The main window goes directly to the renderer without first opening a member record. Aster's ACP child explicitly removes inherited `A3S_GATEWAY_KEY`, so an unrelated parent environment cannot cause organization decision requests.

ToYou still serves the login shell and member APIs. The complete managed authority suite passes in the actual `tenant-toyou` test crate; the local suite passes independently. Managed-specific tests are assigned to that product feature rather than adding a product bypass under cfg(test).

## Evidence

See [native-pure-local-final-validation.json](native-pure-local-final-validation.json). Three maintained pre-fix cases failed at the real boundaries: native root served login, member queries returned data and a synthetic member file was read. The final authority suites pass Aster 30 and ToYou 45. Additional suites pass local focused 4, identity 19, providers 20, preferences 19 and launcher 15. Counts overlap and must not be added.

The actual workspace ACP test passes with an inherited synthetic gateway key and a separate observable loopback gateway. It performs the local planning/approval/execution/typed-goal flow and records zero gateway requests. This proves the native child environment boundary in that fixture; it is not a global network capture. Source and log identities are bound by the validation receipt.

An unrelated stale local-skills assertion was reproduced alone: the existing response already contained both roots and skills arrays. Only the expected JSON schema was corrected. The first test-helper compilation attempt and the initial invalid synthetic token setup are retained and excluded from the three genuine pre-fix failures.

## Work dependencies

The root workspace no longer includes `aster-dream` from `apps/work/src-tauri`. Cargo's offline resolution removes that package and its exclusive updater dependencies, with no added package/version. The existing Studio member paths and public crate names are unchanged. ACP delivery-contract and form catalog/skill fixtures now refer to the canonical host/shared packages. The workspace dependency guard passes all six cases.

Root owns the Office vendor-source merge, kernel script relocation, license and dirty-source archive, and final conditional Work-directory removal. The packaging owner retires only the old Work updater/onefile distribution tests, retaining current desktop updater, IME and generation gates. This agent has not deleted the old application directory, read legacy user data, staged files or modified the index.

## Explicitly not claimed

Direct real-test-crate evidence does not certify the final package, signature, native GUI, IME interaction or published updater feed. Root owns fresh two-product Cargo/package/CUA acceptance. The earlier workspace-wide all-targets gate had separate a3s-use fixture-path and gateway example type failures; this change does not assert those unrelated failures are repaired. No user profile, credentials or history were migrated.
