# T2026-11-20-acp-musl-static

Updated: 2026-11-20 · scope: `aster-acp` static musl build, startup, protocol verification, and delivery gates

## Result

The ACP release flow now retains the existing x86_64 glibc archive and adds `linux-musl` (x86_64) and `linux-musl-arm64` (aarch64). Both use the pinned Rust 1.97.1 toolchain and Zig 0.16.0 with an official SHA-256 pin. Zig drives C, C++, and final linking; stable `-C link-self-contained=no` lets Zig supply one consistent musl CRT/libc/unwind/C++ runtime instead of mixing duplicate Rust and Zig CRT objects.

The regular CI gate builds the x86_64 static binary, checks its ELF and native startup, and runs the existing ACP stdio conformance suite. The release matrix verifies both architectures on native Linux runners and requires five archives before publication.

Local source HEAD at the start of verification: `ed09288c540703fbf08a2b7ec5f314bb5c842ca0`. The working tree already contained unrelated Core/ACP changes; local binaries verify that current workspace, not a clean release commit.

## Build contract

- `CRATE_CC_NO_DEFAULTS=1` prevents cc-rs from adding a Zig-incompatible target argument.
- `CC_<target>` and `CXX_<target>` select `zig cc` / `zig c++` with the explicit musl target.
- `CARGO_TARGET_<target>_LINKER` selects a small `zig cc` wrapper.
- `CARGO_TARGET_<target>_RUSTFLAGS="-C force-unwind-tables=yes -C relro-level=full -C link-self-contained=no"` preserves the repository hardening and avoids duplicate CRT objects on the stable compiler.
- `tests/acp_musl.py` rejects non-ELF64 input, wrong architectures, non-`ET_EXEC` output, `PT_INTERP`, `PT_DYNAMIC`, missing RELRO, executable stacks, and `GLIBC_*` version references. Unless `--no-launch` is explicit, it also requires the real `--version` and `--help` processes to succeed.

Initial attempts using `rust-lld` alone failed on `-lstdc++`; mixing Rust and Zig CRT then produced duplicate `_start`. The accepted stable configuration is the one above. No test or linker safety check was weakened to obtain a pass.

Commands executed in the corresponding Linux containers with the environment above:

```bash
cargo build --locked --release --target aarch64-unknown-linux-musl -p aster-acp --bin aster-acp
python3 tests/acp_musl.py --machine aarch64 target/aarch64-unknown-linux-musl/release/aster-acp
cargo test --locked --release --target x86_64-unknown-linux-musl -p aster-acp --test acp_conformance_stdio -- --test-threads=1
python3 tests/acp_musl.py --machine x86_64 target/x86_64-unknown-linux-musl/release/aster-acp
```

## Verification

- `tests/code_release_workflow.py`: **7 passed / 0 failed**. The local managed Python path contains spaces, so the test was invoked through `target/test-python/python3`; this avoids an unrelated fixture shebang failure without changing the test.
- `tests/acp_musl.py`: **3 passed / 0 failed**.
- Both workflow YAML files parsed successfully; both Zig installation scripts passed `bash -n`.
- x86_64 artifact: `target/acp-musl/x86_64-unknown-linux-musl/release/aster-acp`.
  - Full test build: **exit 0 in 12m 59s** (including waiting for the serialized ARM build). Final `tests/acp_musl.py` verification, including process startup: **passed**.
  - `file`: **ELF64 x86-64, statically linked, stripped**. Final size: **97,978,464 bytes**. Final SHA-256: `3b0820df919401cd0ba81c6df66dd4c95cc381882321215eb410a9c935dea90c`.
  - `readelf`: **ET_EXEC**, no `PT_INTERP`, no dynamic section, no version information, `GNU_RELRO` present, `GNU_STACK` is `RW` (not executable).
  - A clean `debian:trixie-slim` x86_64 container returned **9.3.0** for `--version` and the complete ACP help for `--help`.
  - ACP stdio report `acp-v1-conformance-x86_64.md`: **15 of 15 cases pass**; complete test binary: **15 passed / 0 failed in 4.69s**.
  - The first run without `bubblewrap` produced **13 of 15 cases pass** and **14 tests passed / 1 failed**: only `permission-request-shape` and `permission-cancelled` timed out waiting for `session/request_permission`. Installing the same `bubblewrap` prerequisite used by the existing Linux qualification workflow and rerunning the unchanged suite produced the accepted result above. CI now installs that prerequisite explicitly.
  - Release archive `aster-acp-v9.3.0-linux-musl.tar.gz` contains exactly `aster-acp`; archive SHA-256: `c98dc0ee14e92ecb6b0a310ea0a23b96dba2345f722c8a45f4bc8ec506358e15`.
- aarch64 artifact: `target/acp-musl/aarch64-unknown-linux-musl/release/aster-acp`.
  - Full release build: **exit 0 in 4m 17s**; native `tests/acp_musl.py` verification, including `--version` and `--help`: **passed**.
  - `file`: **ELF64 AArch64, statically linked, stripped**. Size: **92,533,808 bytes**. SHA-256: `7e2007141c5bce3f74de38c400dd7a599cc4061b354778ba27096e5765ab92c9`.
  - `readelf`: **ET_EXEC**, no `PT_INTERP`, no dynamic section, no version information, `GNU_RELRO` present, `GNU_STACK` is `RW` (not executable).
  - Release archive `aster-acp-v9.3.0-linux-musl-arm64.tar.gz` contains exactly `aster-acp`; archive SHA-256: `48a8f225e798aee40c3e2f6d730b0bf07813b9f15016a6aee43a1650f6d0ddc0`.

## Explicitly not claimed

- No release tag, GitHub Release, installation, or production deployment was created.
- No real model completion was used; stdio conformance uses the existing scripted local model.
- Local verification does not stand in for the post-push hosted CI result.
- Existing unrelated compiler warnings and working-tree changes are not claimed as fixed.
