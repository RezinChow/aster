# Gateway local source synchronization

The six-file Gateway increment verified on the GPU server was applied to `D:\code\aster` with `git apply`, after a clean `git apply --check`. No manual port or whole-file replacement was needed despite the different repository HEADs.

- Local HEAD: `64cfd79cac690e78c288c374ddba0c7650e5bfcc`.
- Remote HEAD: `16469319771867f9dfd46d41534ef00fe2a2addc`.
- Remote initial dirty stash: `02f45d09c112c4b7a81d2219f4d915a7a22375a1`.
- Increment: [gateway-cancellation-deadline.patch](gateway-cancellation-deadline.patch), SHA256 `5f0778c82c2886d46541ab366bcc0c0ce18b0e2597ee565f863d426382129dda`.
- Both forward preflight and post-application reverse checks passed.

The owned paths under `apps/gateway/src` are:

1. `entrypoint/listener.rs`.
2. `entrypoint/tests.rs`.
3. `entrypoint/listener_cancellation_tests.rs` (new).
4. `entrypoint/inference_distributed_tests.rs`.
5. `entrypoint/inference_distributed_deadline_tests.rs` (new).
6. `entrypoint/protocol/distributed_handler.rs`.

Local CRLF line endings were retained. All six LF-normalized source hashes exactly match the remotely tested files; their raw local hashes and normalized remote mapping are recorded in [gateway-local-source-mapping.json](gateway-local-source-mapping.json). The existing dirty `entrypoint.rs` and `inference/principal.rs` were untouched. The existing listener changes outside the increment were preserved. `Cargo.lock` and `justfile` were not changed. Raw before-file bytes, hashes and original status are retained privately in `.git/optimization-20261021/gateway-local-sync/before/` and `before.json`.

## Local checks

Pinned Cargo and rustc are both 1.97.1. Package default features remain empty. All commands run from the repository root.

| Command | Result |
| --- | --- |
| `git apply --check` and `git apply --reverse --check` | Passed |
| Six owned files, `rustfmt --edition 2021 --config skip_children=true --check` | Passed |
| `git diff --check` for the owned paths | Passed |
| `cargo fmt -p a3s-gateway -- --check` | Passed |
| `cargo fmt --all -- --check` | Windows OS error 206: command/file name too long; independently reproduced |
| `cargo test --locked -p a3s-gateway --lib --no-run -j8` | Rust compilation reached final native linking; failed with 36 unresolved CRT imports in `ort_sys`, LNK2019/LNK1120 |
| `cargo test --locked -p a3s-gateway --lib listener_cancellation_tests -j8 -- --test-threads=1` | Same default-flags link failure independently reproduced |

Root MSVC flags force `+crt-static`; the prebuilt ONNX Runtime native archive references dynamic CRT imports such as `__imp_nearbyintf`. Default Windows test execution is therefore not claimed green. Full logs are `gateway-local-compile.log`, `gateway-local-link-repro.log`, and the format logs beside this document.

A separate host-link validation uses only process-local `RUSTFLAGS=-C force-unwind-tables=yes -C target-feature=-crt-static`. It changes no repository Cargo, toolchain, configuration or lock files. After respecting the existing Cargo lock and rebuilding native dependencies, this alternate configuration also failed at linking: esaxx_rs esaxx.o uses MT_StaticRelease while clipper2c.o uses MD_DynamicRelease (LNK2038/LNK1319). A single listener-test filter independently reproduced that second failure. No local test executable was produced and no local tests ran. This is not reported as a successful workaround. No third flag or source/configuration change was used to suppress the ABI mismatch.

## Explicitly not claimed

This source synchronization does not update a production service or a local release binary. No GPU/native engine, remote process, credential or production traffic was accessed for this local task. Local default-CRT test execution and whole-workspace formatting are not reported as passing. The process-local CRT validation, if successful, remains distinct from default Windows configuration. Managed scheduling contracts come from the relevant hermetic tests; generic private proxy traffic does not prove those contracts.

Final local validation: four Cargo build/test attempts reached native-link failures (two distinct configurations, each independently reproduced); local runtime test count is **0 executed**. Six-file owned formatting, Gateway package formatting, forward/reverse patch checks and diff whitespace checks passed. Machine-readable summary: [gateway-local-check-results.json](gateway-local-check-results.json). Alternate-link logs: [gateway-local-dynamic-crt-compile.log](gateway-local-dynamic-crt-compile.log), [gateway-local-dynamic-crt-link-repro.log](gateway-local-dynamic-crt-link-repro.log). Original protected file hashes and all six delivered source hashes were rechecked unchanged at the end. No source or configuration changes were made in response to Windows linking failures.

