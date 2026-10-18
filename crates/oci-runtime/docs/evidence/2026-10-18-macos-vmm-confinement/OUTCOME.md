# macOS VMM host confinement

The macOS VM worker now applies a default-deny Seatbelt profile before native
VM entry. It admits its verified immutable assets, one private runtime share,
the pinned console descriptor, and the exact authenticated agent Unix socket.
Other host files, TCP/extra Unix sockets, and native executable launch remain
denied. The profile uses native Seatbelt parameters for paths, including quotes,
backslashes, and Chinese characters.

All three macOS worker launch paths clear the inherited environment and place
libkrun's temporary bootstrap root inside their private runtime share. The
pinned 1.17.0 implementation otherwise creates that root in the system temporary
directory. VM entry now requires successful confinement. The authenticated
agent report retains a positive flag, and the Runtime refuses absent or false
flags on macOS, including legacy otherwise-successful reports.

## Evidence

The outside-read regression and missing-report regression both failed before
their fixes. The real-process test checks writable grants, immutable reads,
immutable/outside write rejection, allowed and denied sockets, native execution
rejection, and a pinned console write. Its ignored child entry is invoked by the
parent test in a disposable process; it is not an unexecuted acceptance gate.
The final runs passed 60 Shim tests (the subprocess child is separately invoked),
18 Runtime evidence tests, strict Clippy for both crates and all targets,
and workspace formatting. Raw test/build logs are retained beside this record.

The diagnostic authenticated Guest run passed all lifecycle, real exit-7 I/O,
PTY, file/FS, resources, pause/resume, wait/replay, and cleanup checks, and its
retained shim report says `macos_host_sandbox_enforced: true`. It used dirty
source and therefore is explicitly not a clean-revision release qualification.
The rebuilt system image and manifest are byte-identical to the earlier
retained artifacts. The clean-revision public Host Service gate also passed, as recorded below.

During investigation the machine's temporary directory was emptied during validation; its cause was not identified.
Earlier transient raw logs/artifacts disappeared; current rebuilt materials
live under `target/qualification/macos-vmm-confinement-20261018` and retained
evidence lives here. The first console-FD refusal and subsequent bootstrap-root
refusal were resolved without granting blanket host filesystem access.

## Remaining

This is an upstream execution-boundary improvement. Workspaces still need their
versioned directory transport and Core/Aster integration. Default macOS Bash,
mediated networking, release readiness, Windows qualification, and the complete
product objective are not claimed complete.

The upstream [1.17 security model](https://github.com/containers/libkrun/tree/v1.17.0#security-model)
requires host isolation for VMM-backed filesystem access; the pinned
[bootstrap-root implementation](https://github.com/containers/libkrun/blob/v1.17.0/src/libkrun/src/lib.rs#L2079)
explains the required private temporary directory.

## Clean public Host Service qualification

Source `234632f5868e68a9a0eacbeb77e49f8f55ea5480` was GPG- and DCO-signed,
rebuilt with a clean worktree, and frozen with its exact CLI and signed Shim
digests. The public Host Service gate exited zero with status `available`:

- all advertised lifecycle/I/O/terminal/filesystem operations passed;
- Host SIGKILL, exact stopped-state recovery, replay, and cleanup passed;
- 25 of 25 soak iterations and VM generations passed;
- Host descriptor counts stayed at 13, with VM, endpoint, and transient
  inventories restored after every iteration;
- 28 owned native workers were sampled without printing their environments;
  none inherited the randomly generated ambient-environment sentinel.

`public-host-service.json` is the unmodified gate report. `public-invocation.json`
binds the invocation, source, artifact digests, exit code, and environment
probe. This establishes the tested SDK/runtime boundary; it does not establish
default Aster Bash availability or production/release readiness.
