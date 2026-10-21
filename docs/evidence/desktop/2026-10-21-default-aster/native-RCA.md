# Native identity and local-model repair

Spec 004 uses the shared `apps/studio` native host. This work does not open, import, copy or rewrite real legacy AsterDream profiles. Store tests use newly created synthetic directories. The workspace ACP companion and the spec 003 approval/stop/goal contracts remain in use.

## Product identity and paths

Cargo selects exactly one `tenant-aster` or `tenant-toyou` feature. Missing and combined selections fail compilation. `HostIdentity::compiled()` binds the native generation; installed identity and an explicitly supplied tenant must match it. An unset development tenant uses that compiled product. Resource-only brand fixtures do not become additional runnable product identities.

| Build | Product | Bundle/app ID | Native profile |
| --- | --- | --- | --- |
| `aster` | AsterDream | `dev.a3s.studio.aster` | `<platform data>/dev.a3s.studio/studio/aster` |
| `toyou` | ToWork | `dev.a3s.studio` | Existing compatible `toyou` location |

Aster instances use `studio/aster/instances/<instance>`. Their machine ID stays inside the new `studio/aster` ownership root. There is no fallback probe of legacy Work's `aster` or `aster-<instance>` data directory. ToYou preserves existing Mac-style and flat instance locations; otherwise it uses the native platform root and nested instance location. Platform roots use macOS Application Support, Windows APPDATA/USERPROFILE and Linux XDG_DATA_HOME or `.local/share`.

Providers, member sessions, preferences, capabilities, applets, agent-plane stores, desktop settings, debug app bundles and single-instance locks converge on `ProfileLocation`. Runtime discovery is `temp/a3s-studio/<tenant>/runtime.json`, with `instances/<instance>` for side windows. The explicit `STUDIO_RUNTIME_FILE` override remains unchanged.

Main and popup browser storage share one isolation helper. Aster and side instances receive separate WebKit store identifiers; Windows/Linux receive profile-owned WebView directories. Primary ToYou retains its previous browser store. macOS below 14 cannot select persistent WebKit store identifiers, so side instances use ephemeral browser stores and do not retain that browser storage across launches. This is a platform limit, not a migration.

## Local models and preferences

Only the Aster build compiles the local provider authoring, credential and sync module. ToYou retains managed organization admission. Aster accepts enabled local provider credentials from its own new profile. `a3s` execution still requires the real member token and cannot use a saved local key. Anonymous local use never creates a member session, remote member UUID or organization bearer.

Aster anonymous preference data lives under `preferences/local/<native-local-scope>.acl`. The native local UUID labels that ACL only. Device model defaults remain in the device ACL, so all three defaults survive restart. Signed-in preference files remain separate even if a remote UUID equals the local ACL label. Main-window/origin/host-token and exact commit-scope checks still apply. Ordinary local agent/session CRUD uses the existing host bearer guard. Reserved personal/organization resources continue to require real membership.

Custom providers use UUID authoring with explicit `isCustom`, `presetProviderId`, `defaultChatEndpoint`, `adapterFamily` and `runtimeSupported` metadata. Credentials, models and model metadata survive reopening. Provider/model removal clears matching native defaults and all three device preference keys. Failure restores the prior store. Rejected provider updates also restore saved/catalog/custom authoring state.

The supported local transports are OpenAI chat completions and Anthropic messages. A declared registry default, or a unique declared supported endpoint when no default exists, selects the transport. Empty, ambiguous, image-only and unsupported endpoints do not become OpenAI by inference. A custom provider's explicit protocol reaches generated ACL and ACP model arguments, so its UUID is not used as an SDK protocol name. Google native APIs remain unsupported by this SDK and are unavailable locally. Shared Core APIs are unchanged.

## Validation

Final result receipts are [native-final-validation.json](native-final-validation.json) and [native-final-suites.json](native-final-suites.json). The direct exact test crates passed Aster 19 and ToYou 13 focused cases. These overlap the neighboring suites; their counts are not added together. Neighboring owning suites passed updater 28, preferences 18, providers 20 and launcher 15. The final anonymous actual ACP case passed, and the same local-model turn was rejected without spawning ACP or contacting the provider in both compiled feature test binaries.

The real anonymous ACP case uses the current workspace binary and a private loopback provider. It asserts planning cannot mutate, then verifies a real single-use bound approval, actual execution file contents, a persisted reply marker, typed active/paused/cancelled goal state and the actual raw outcome/observation notifications. The fixture has no member session and obtains credentials through the real local provider store. Its final run completed in 6.13 seconds. It is a backend integration test, not CUA.

Missing-feature and both-feature builds each fail with the expected compiler guard. Scoped Rust 2024 formatting and diff checks pass. All 30 owned source files still match the final manifest. Root owns canonical two-feature Cargo builds, package/signature validation and native GUI acceptance; those are distinct from direct test-crate proof.

Actual workspace `cargo check --locked --workspace --all-targets` failed outside this scope: `a3s-use` lib-test fixture includes reference missing nested `crates/core`/`crates/extension` paths (33 errors), and `apps/gateway/examples/protocol_benchmark_load.rs:138` passes `Vec<u8>` where `Message::Binary` requires `Bytes`. Those sources were not changed. Focused actual Cargo tests passed all 11 desktop-contract and 3 data-sqlite tests. Commands, exit statuses and current log identities are in [native-workspace-validation.json](native-workspace-validation.json). The workspace-wide gate is therefore **not green**.

## Before evidence and limits

The original profile tests produced 3 failures. The first local credential test produced 1 failure and 1 retained managed-negative pass. The independent review found two additional defects: rejected custom writes retained authoring state in memory, and an absent registry default mislabeled an image-only provider as chat. Both maintained regressions failed in the immutable pre-fix binary. The actual production credential factory reloads disk, so the rollback defect is an authoring-state inconsistency; the regression does not demonstrate a persisted credential-admission bypass.

macOS delayed several fresh MachO processes before the test harness. Samples showed 112KB and `_dyld_start`. The same owned ACP binary's `--version` control took 48.03 seconds, then exited successfully. Those startup waits, bounded timeouts and signed-copy controls remain recorded. They are not product assertion results, and no product timeout was relaxed. An initial short `--exact` filter selected zero ToYou tests; its record is retained separately and excluded from passing counts. The corrected filter ran one real negative case.

The evidence directory was concurrently renamed from `docs/evidence/studio` to `docs/evidence/desktop`. Some prose was also rewritten by that external work. This report restores actual technical identifiers from the frozen source. Current receipt hashes bind the bytes observed now; rewritten historical documents are not claimed to retain their original hashes.

This work does not certify physical Kylin input, Windows/Linux GUI behavior, a live provider, a published update feed or host-restart goal restoration. Legacy Work data remains untouched; no migration or credential copying is provided.
