# T2026-11-19-store-cas-fencing

Updated: 2026-11-19T11:55:29+08:00 · scope: WAL / writer lease / at-rest encryption consistency · **CAS fencing fix + full Core passed** · **≠ Meta Harness Done**

## Result

A real multi-writer compare-and-swap race was reproduced and fixed.

`save_snapshot_cas` previously read the expected snapshot digest before acquiring the cross-process WAL flock. Two handles could therefore pass the same stale comparison and both commit. A deterministic fixture held the WAL lock while both handles compared, then released it: **2 writers succeeded instead of exactly 1**.

The comparison and commit now share one flock via `commit_snapshot_lock_held`. The same fixture returns exactly **1 success**. Normal snapshot commits retain the existing process-mutex → flock order, and no re-entrant flock is attempted.

WAL intent/commit recovery, writer-lease takeover fencing, AES-256-GCM round trips, wrong-key refusal, legacy digest compatibility, and symlink boundaries were reviewed without another production change.

## Verification

- New CAS race: **red before / green after**.
- Store suite: **85 passed / 1 existing ignored**.
- Explicit S-PE-01 soak: **1/1**, covering **40 snapshot generations and 5 crash-before-rename injections**; the ignored-by-default test was run explicitly with `--ignored`.
- Capability runtime: **74/74**.
- TUI deterministic suites: **70 passed / 0 failed / 1 ignored** (`deterministic-summary.json`).
- Final serial Core: **5981 passed / 0 failed / 33 ignored / 619.13s** (`core-lib-serial.log`).
- Core and ACP Clippy all targets: **exit 0** each. Existing warnings are not claimed as cleaned.
- Final paired build: **exit 0**; both binaries report `aster-cli-pair-v1:f89e4919603a5b7e3d04f527be9dbf7bca972b7e:aarch64-apple-darwin`.
- `git diff --check`: **exit 0** for Core/ACP sources, ACP tests, and this evidence directory.

Two earlier full-suite attempts hit the MCP stdio fixture's 3-second cold-start timeout. Production retains that 3-second limit; test-only builds now allow 10 seconds so the same connection, cancellation, rollback, and reaping assertions can complete under load. The final suite has no such failure. Earlier red logs are preserved as `core-lib-serial-mcp-timing.log` and `core-lib-second-mcp-timing.log`, not as acceptance evidence.

`cargo fmt --all` was run and the existing `terminal_bench_runner.rs` edits were restored byte-for-byte. Final `cargo fmt --all -- --check` remains **exit 1 only for that pre-existing file** (`fmt-check.log`); no Core/ACP source or ACP test formatting difference was reported.

## Limitations

- No real model was run for this persistence slice. Deterministic multi-handle and crash-injection tests establish the actual store behavior, not provider behavior or a release SLO.
- No Windows native check, commit, push, branch, worktree, install, release, or external workspace edit was performed. USD/token cost is unavailable.
- This closes the named persistence-consistency slice, not the overall Meta Harness goal. Studio synchronization and daily-use release evidence remain outside this slice.
