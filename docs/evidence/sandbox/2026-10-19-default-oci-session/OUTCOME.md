# Default OCI session checks

## Result

On macOS aarch64, a deny session that installs the default local sandbox
selects the OCI Host when the companions validate, including when the
process-host opt-in is set. The same companions with a mediated posture
do not run the command. Missing companions still refuse both Bash exec
APIs before any command process.

The guest agent inside the image that discovery's host boots hellos
`0.3.6`, and the runtime version stored in that host binary is `0.3.6`.
One command through the installer returned the program's stdout and
exit code.

A caller-owned mode `0700` workspace whose path contains a literal
backslash returned the file bytes from Bash, from `python3` through
that Bash backend, and from the in-process read tool. Both runs
matched. The same installer path maps container root onto the caller
only, keeps a denied credential and its hardlink unreadable, creates
no file outside the workspace, and stops a `setsid` descendant after
timeout and after cancellation. The timeout case ran twice.

## What landed

`select_default_local_sandbox` was already the installer decision.
These tests lock it.

- `validated_companion_files_keep_deny_on_oci_and_mediated_off_the_vm`
  uses companion files that pass discovery. Deny plus the process-host
  opt-in keeps OCI overhead `90000` and no native policy digest.
  Mediated stays off that Host, and both exec APIs refuse before a
  sentinel exists.
- `validated_companions_select_oci_for_deny_and_refuse_mediated` runs
  the real companions through `install_default_local_sandbox`. Deny
  returned `deny-exec` / exit 7 and `deny-exec-command` / exit 8, both
  with `Linux`, while `macos-hvf-host-service` was alive. Mediated
  refused both APIs with `native_process_lifetime_unqualified`, left
  no sentinel, and did not start that host.
- `missing_oci_companions_keep_both_native_apis_refused` still refuses
  both APIs with `native_process_lifetime_unqualified` and creates no
  sentinel.
- `sandbox/oci/version.rs` reads the host runtime from the bytes
  immediately before `guest agent version does not match the host
  runtime version`, and the guest hello from the semver immediately
  before the architecture name. The manifest field
  `sources.agent.version` is not the comparison.
- `guest_hello_matches_the_host_runtime_discovery_launches` read those
  bytes from `a3s-oci` and from `/usr/bin/a3s-oci-agent` in the image
  named by that manifest, then ran one installer command: stdout
  `version-pair-ok`, exit 4.
- `default_local_sandbox_reads_a_private_backslash_workspace` ran
  twice on `leaf\name` mode `0700`. Both runs returned
  `CORE-0700-BYTES-9f3c`, Bash and Python exit 7, `kern=Linux`, a
  successful read, and no outside file.
- `admit_workspace_path` accepts a source-relative component that
  contains `\`, and rejects NUL, an empty component, and `..`.
- `default_install_checks_uid_map_credentials_and_setsid` read
  `marker=CONTRACT-MARKER-9f3c`. The first uid and gid rows were
  `0 <caller> 1` (`0 501 1` and `0 20 1` for this process). `.env`
  and its hardlink stayed unreadable. The outside path was not
  created. Two timeouts returned exit 124 and the counter stopped at
  21 bytes. Cancellation stopped the counter at 1 byte.

Commands, from the repository root, with
`ASTER_TEST_OCI_ASSETS=/Users/roylin/Library/Caches/aster/sandbox/dev-20261018-core-bash`
on the live tests:

- `cargo test -p a3s-code-core --lib -- --test-threads=1 --include-ignored --nocapture validated_companion_files_keep_deny_on_oci_and_mediated_off_the_vm validated_companions_select_oci_for_deny_and_refuse_mediated missing_oci_companions_keep_both_native_apis_refused` — 3 passed.
- `cargo test -p a3s-code-core --lib -- sandbox::oci::version::tests` — 4 passed.
- `cargo test -p a3s-code-core --lib -- --test-threads=1 --ignored --nocapture guest_hello_matches_the_host_runtime_discovery_launches` — 1 passed.
- `cargo test -p a3s-code-core --lib -- --test-threads=1 --ignored --nocapture default_local_sandbox_reads_a_private_backslash_workspace` — 1 passed.
- `cargo test -p a3s-oci-sdk --lib -- admits_a_literal_backslash_and_rejects_nul_empty_and_dotdot` — 1 passed, 202 filtered.
- `cargo test -p a3s-code-core --lib -- --test-threads=1 --ignored --nocapture default_install_checks_uid_map_credentials_and_setsid` — 1 passed.
- `cargo test -p a3s-code-core --lib -- --test-threads=1 sandbox:: agent_api::session_sandbox::` — 51 passed, 0 failed, 8 ignored, 5050 filtered.

The eight ignored tests are the signed HVF cases, including the four
live tests above. They were run separately. The original cache image
`dev-20261018-nuk8fn6w/a3s-oci-system.ext4` still hashes to
`938322b0b2581ed55fd5baad3465e43694fc5d5529820411aa4841ebb512fb72`.
The copy used here hashes to
`842590e3619d267a09d877b53abf7e2c1cdb5bae587cc7477d95ff736302f8ce`.

## Explicitly not claimed

No AsterDream GUI, task-catalog conversation, or live model turn was
run. The macOS native backend was not enabled. Process-host and the
direct HVF guest shim are not the product default. No Python tool was
added, and read still runs in-process. Windows and Linux sandbox
behavior was not changed. Source package versions were not rewritten
to `0.3.6`. No commit was created.
