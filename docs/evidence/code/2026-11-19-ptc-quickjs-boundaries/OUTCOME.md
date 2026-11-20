# T2026-11-19-ptc-quickjs-boundaries

Updated: 2026-11-19T10:59:31+08:00 · scope: PTC/rquickjs resource and permission boundaries · **implementation fix + deterministic E2E + full Core passed** · **≠ Meta Harness Done**

## Result

The PTC/rquickjs boundary review found and fixed a real source-gate bypass:

- Before the fix, `eval/*x*/("({ nativeEval: true })")` executed successfully and returned `nativeEval: true`.
- The VM now installs `eval` and `Function` as non-writable, non-configurable `undefined` globals before running PTC source. Commented `eval` and `Function` invocations now fail closed instead of depending on substring filtering.
- `fetch`, `WebSocket`, and `Worker` remain disabled under the same bootstrap contract. Existing source-size, timeout, tool-call, output-byte, nested-gateway, and cancellation limits remain intact.

The default module loader was also probed with a commented dynamic import of an actual `.mjs` file. It returned `could not load module`, so no native/module-loading bypass is claimed from that probe. No module-loader behavior was changed.

Resource limits were verified with real PTC executions: a growing array beyond the 64 MiB VM limit and unbounded recursion beyond the 512 KiB stack limit both return errors without crashing the process.

## Verification

- PTC tool suite: **49 passed / 0 failed**, including commented import/eval/Function counterexamples.
- Memory and stack counterexamples: **2 passed / 0 failed**.
- Program primitives: **26 passed / 0 failed**.
- Fact-log program failure receipts: **2 passed / 0 failed**.
- TUI deterministic suites: **70 passed / 0 failed / 1 ignored** (`unattended_e2e` 33, `shipped_tui_e2e` 26, `tui_913_hermetic` 11), summarized in `artifacts/ptc-quickjs-2026-11-19/deterministic-summary.json`.
- Full serial Core: **5980 passed / 0 failed / 33 ignored / 613.80s**, in `artifacts/ptc-quickjs-2026-11-19/core-lib-serial.log`.
- Core Clippy all targets: **exit 0** (`core-clippy.log`). ACP Clippy all targets: **exit 0** (`acp-clippy.log`). Existing warnings are not claimed as cleaned.
- Final paired build: **exit 0** (`paired-build-final.log`); both binaries report `aster-cli-pair-v1:a39cc5e7bdaffed8de3f9e517bea72ecc6fe6df1:aarch64-apple-darwin`.
- `git diff --check`: **exit 0** for Core/ACP sources, ACP tests, and this evidence directory.

`cargo fmt --all` was run and the existing `terminal_bench_runner.rs` edits were restored byte-for-byte. Final `cargo fmt --all -- --check` remains **exit 1 only for that pre-existing file** (`fmt-check.log`); no Core/ACP source or ACP test formatting difference was reported.

## Boundary and limitations

- The fix is a VM-global capability denial, not a broader JavaScript parser or a new sandbox API. Existing text validation remains as a secondary preflight check.
- No real model was run for this PTC slice. Deterministic PTC and TUI tests establish the actual VM and host behavior; they do not establish model behavior across providers.
- No Windows native check, commit, push, branch, worktree, install, release, or external workspace edit was performed. USD/token cost for deterministic tests is unavailable.
- This closes the named PTC/rquickjs boundary slice, not the overall Meta Harness goal. Studio synchronization and daily-use release evidence remain outside this slice.
