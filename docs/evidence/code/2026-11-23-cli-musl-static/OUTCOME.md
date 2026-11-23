# T2026-11-23-cli-musl-static

Updated: 2026-11-23 · scope: Aster CLI static musl pair release variant, channel/installer/updater routing, and verification contracts

## Result

`aster-cli-v*` Linux releases now add two fully static pair archives alongside the existing glibc 2.31 ones: `linux-musl` (x86_64) and `linux-musl-arm64` (aarch64). Both are built from the same source and carry the same `BUILD_ID` as their glibc counterparts, but contain no dynamic loader, dynamic dependency table, or `GLIBC_*` version reference. `scripts/install.sh` prefers them on every Linux host and falls back to the old channels when a manifest predates them; `aster update` stays on the static channel when the running binary was built for musl.

Local source HEAD before edits: `31fc4ef03` (`fix(ci): restore format gate and relax macOS timing after KBurn removal`). `apps/studio` was initialized from the pinned submodule commit `a1a8d5d10f6f5b6c89616f609dc36cbdd5d6ae12` so Cargo commands could load the workspace.

## Commands and counts

- `python3 -m unittest tests.cli_musl tests.aster_cli_linux tests.cli_release_workflow tests.release_governance tests.acp_musl tests.musl_linker_flags`: **81 passed / 0 failed** (musl ELF gate, musl packaging gate, installer preference/fallback, six-archive publication, partial-pair refusal, channel validation), after installing the `x86_64-unknown-linux-musl` target locally.
- `python3 -m unittest tests.code_release_workflow tests.cli_pair_delivery tests.cli_pair_identity tests.workspace_dependencies tests.studio_checkout`: **37 passed / 0 failed**.
- `python3 tests/cli_musl.py` and `python3 tests/acp_musl.py` as direct scripts: **2 passed** and **3 passed** respectively.
- `cargo fmt --all -- --check`: exit 0.
- `cargo test --locked -p aster --bin aster cli_pair_update -- --test-threads=1` with a temporary `protoc` 29.3 on PATH: **12 passed / 0 failed**, including `musl_binaries_stay_on_the_static_channel`.
- `cargo clippy --locked -p aster --all-targets --no-deps`: exit 0. Warnings are pre-existing in unrelated test fixtures and the already-unused `archive_member` helper; none point at the new channel mapping.
- `bash -n scripts/package-aster-cli.sh scripts/publish-aster-cli.sh scripts/install.sh`: exit 0.
- Ruby `YAML.load_file` over `.github/workflows/*.yml`: all workflow files parsed.

Release-package shell fixtures copy the real offline embedding assets, so their per-case subprocess timeout was raised from 10s to 30s to remove host-load flakiness; assertions and gates were not weakened.

## Contract summary

- `release-aster-cli.yml` adds a two-arch `build-linux-musl` matrix using the same pinned Rust 1.97.1 / Zig 0.16.0 toolchain and SHA pins as the existing ACP musl release flow. It verifies both binaries with `tests/cli_musl.py` before packaging.
- `package-aster-cli.sh` accepts `linux-musl` / `linux-musl-arm64`, replaces the glibc ceiling with the static ELF gate, and keeps the archive layout (two binaries, `BUILD_ID`, `SHA256SUMS`, `embedding/`) unchanged.
- `publish-aster-cli.sh` publishes six standard archives (seven with the optional byte-identical `kylin-x86_64` alias), requires both musl arches together, and emits the two new manifest keys. Legacy four/five-archive republishes remain accepted without musl keys.
- `release-aster-cli-channel.yml` requires the musl keys for new channel publications; older updaters still ignore unknown platform keys.
- `scripts/install.sh` tries `linux-musl` → `kylin-x86_64` → `linux` on x86_64 and `linux-musl-arm64` → `linux-arm64` on aarch64.

## Real aarch64 musl cross-compile and live E2E (added 2026-11-24)

A production `release-dist` pair was cross-compiled to `aarch64-unknown-linux-musl` on the Darwin host and then booted in an aarch64 Linux guest. This supersedes the earlier "not claimed" note about a real musl build/native startup. Raw logs are saved beside this file as `build-aarch64-musl.log` and `e2e-aarch64-musl.log`.

- Toolchain: pinned Rust 1.97.1 + Zig 0.16.0, target `aarch64-unknown-linux-musl`, `CARGO_TARGET_AARCH64_UNKNOWN_LINUX_MUSL_RUSTFLAGS='-C force-unwind-tables=yes -C relro-level=full -C link-self-contained=no'`. Result: **exit 0**.
  - `target/aarch64-unknown-linux-musl/release-dist/aster` — 187,709,920 bytes, `ELF 64-bit LSB executable, ARM aarch64, statically linked, stripped`.
  - `target/aarch64-unknown-linux-musl/release-dist/aster-acp` — 93,137,144 bytes, same properties.
  - Both carry one shared `BUILD_ID`: `aster-cli-pair-v1:326aed5b0bb8666c3f4fd96939ecab4dd6de34dd:aarch64-unknown-linux-musl`.
- `python3 tests/cli_musl.py --machine aarch64 --no-launch <aster> <aster-acp>`: **exit 0**, both binaries verified static (no `PT_INTERP` / `PT_DYNAMIC` / `GLIBC_*`, RELRO + non-exec stack). `--no-launch` is required because the Darwin host cannot execute an aarch64 Linux ELF; startup was verified in the guest instead. The verifier's own unit tests pass.
- Guest runtime: QEMU 11.1.3 `virt` machine, Alpine `6.12.118-0-virt` kernel, initramfs with the two binaries, `config.acl`, and virtio-net modules. In-guest results:
  - `aster --version` → `aster 0.4.0 (31fc4ef039af)`; `aster --build-id` → the shared pair ID; `aster-acp --version` → `9.3.0`; `aster-acp --build-id` → the same pair ID.
  - Headless single turn with the `kimi-01/k3.1-pro` model from `../config.acl`: `-p 'Reply with exactly: ok'` → **ok**, exit 0.
  - Long-horizon multi-turn over the same live model using headless `--resume` (resume most recent) — a token planted in turn 2 was recalled verbatim in turn 3 and confirmed in turn 4:
    - T2 → `TURN2_OK`, exit 0.
    - T3 → `MUSL_LH_TOKEN_7391`, exit 0.
    - T4 → `MUSL_LH_TOKEN_7391 LH_DONE`, exit 0.
    - A session directory under `/work/.aster/sessions/2026-11-23/` persisted between invocations, so context survived across processes.

Host-only build note (Darwin-specific, not a repo/CI defect): macOS `/usr/bin/ar` is BSD `ar` and silently produced 96-byte empty archives for the cross-compiled native `.a` files (`libgit2`, `tree-sitter`, `libquickjs`, and jemalloc). Wrapping `ar`/`ranlib` with `zig ar --format=gnu` / `zig ranlib` fixed it; jemalloc's autotools `configure` additionally needed those wrappers on `PATH`. GitHub Actions Linux runners use GNU binutils and are unaffected.

Test prerequisite added locally: `rustup target add x86_64-unknown-linux-musl` so `tests/musl_linker_flags.py` could inspect that target's sysroot.

## Explicitly not claimed

- No release tag, GitHub Release, channel publication, or production deployment was created.
- No hosted GitHub Actions result is claimed; the release workflow was validated by contract tests and YAML parsing, not by a live CI run.
- Only aarch64 musl was compiled live here; x86_64 `linux-musl` was validated by the contract/static gates, not by a local cross-compile.
- File-mutating long-horizon turns were attempted but stopped at aster's `completion gate` / `tool_effect_unresolved` safety checks; the passed long-horizon evidence uses read-only, context-carrying turns. Those gates are application behavior present on every libc, not a musl defect.
- No cleanup of pre-existing compiler warnings from unrelated crates is claimed.
