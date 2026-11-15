# ACP stdio EAGAIN / WouldBlock must not kill the session

Date: 2026-11-15, Asia/Shanghai.

## Environment and identity

- macOS Darwin arm64; toolchain `rustc 1.97.1 (8bab26f4f 2026-07-14)` from `rust-toolchain.toml`.
- Checkout HEAD at verification: `6a188a746a29f116b93ae32ca29b43b0ee47f872`.
- Incident reference: inkstone session `75ff3e99-5545-4d1c-b73f-f057cc0a49ea` —
  `aster_acp::stdio` logged `-32603 Internal error` with
  `error_data = "Resource temporarily unavailable (os error 35)"` then exit 1.

## First principles

1. ACP NDJSON transport is a long-lived duplex pipe. Full-pipe / brief fd
   contention is **backpressure**, not a protocol failure.
2. `agent-client-protocol` maps **every** outgoing-sink / incoming-stream
   `io::Error` through `Error::into_internal_error` and ends `handle_io`.
3. Therefore any adapter that surfaces `ErrorKind::WouldBlock` (`EAGAIN`,
   macOS os error 35) or `Interrupted` as `Ready(Err(_))` will suicide the
   Agent connection. The correct contract is `Poll::Pending` + retry.

## What was fixed

1. Added `aster_acp_lib::{RetryTransientWrite, RetryTransientRead, is_transient_io}`
   (`transient_io.rs`): converts WouldBlock / Interrupted into Pending with
   exponential backoff (50 µs → 16 ms).
2. Wired both sides of the shipped stdio path:
   - `aster-acp` binary: stdin = `LineBufferedRead(RetryTransientRead(…))`,
     stdout = `RetryTransientWrite(…)`.
   - pager ACP bridge: child stdout / stdin wrapped the same way.
3. Hermetic regression proves write/read survive repeated WouldBlock, pass
   through BrokenPipe, and (macOS) that os error 35 matches the observed log
   Display string.

## Commands and counts

| Command | Result |
| --- | --- |
| `cargo fmt -p aster-acp-lib -p aster-acp -p aster-pager -- --check` | exit 0 |
| `cargo test --locked -p aster-acp-lib --lib -- --test-threads=1` | 22 passed (includes 5 `transient_io` cases) |
| `cargo clippy --locked -p aster-acp-lib --all-targets --no-deps` | exit 0 |
| `cargo clippy --locked -p aster-acp -p aster-pager --all-targets --no-deps` | exit 0 (pre-existing warnings only) |
| `cargo test --locked -p aster-pager --lib acp::aster_spawn::transport_tests -- --test-threads=1` | 5 passed |
| `cargo test --locked -p aster-acp --bin aster-acp -- --test-threads=1` | 10 passed |
| `git diff --check` on touched paths | exit 0 |

## Audit of similar paths (same session)

Product / product-adjacent ACP `*SideConnection::new` sites checked; all
now wrap with `RetryTransient*`:

| Site | Transport | Status |
| --- | --- | --- |
| `aster-acp` main stdio | OS stdin/stdout | wrapped |
| `aster-acp` `startup_error` | OS stdin/stdout | wrapped |
| pager `aster_spawn` | child pipes | wrapped |
| pager `leader_bridge` | simplex halves | wrapped (defense in depth) |
| shell `run_stdio_agent` / `spawn_agent_local` | OS stdout + simplex | wrapped |
| shell `run_headless` / `run_leader` agent IO | simplex | wrapped |
| shell `agent/server::setup_acp_connection` | simplex | wrapped |
| shell `leader/in_process` | simplex | wrapped |
| shell `agent/testkit/e2e` | duplex | wrapped |
| `aster-test-support` ACP child client | child pipes | wrapped |

Reviewed and **not** the same fatal class:

- Studio `agent_plane/acp.rs`: custom NDJSON over `ChildStdin` /
  `ChildStdout` via Tokio `AsyncWriteExt` (returns `Pending`, not
  `Ready(Err(WouldBlock))`); does not use `agent-client-protocol`'s
  `into_internal_error` sink mapping.
- Tokio `simplex` / `duplex` backpressure: documented as `Poll::Pending`
  at the buffer limit, not `WouldBlock` as `Err`.
- Config/`flock` `WouldBlock` handlers elsewhere: lock contention retries,
  not ACP transport.
- Unit/integration tests that still bare-wire duplex/`compat_write`
  (`aster-acp` unit tests, shell `tests/acp_harness`, etc.): in-memory
  duplex; residual only if a fixture injects raw `WouldBlock` errors.

## Explicitly not claimed

- Not a live re-run of the inkstone workspace session under indexing storm.
- Not a change to retrieval index byte budget (~64 MiB) or `BudgetExceeded`
  catalog behavior; that pressure can still exist, but it must no longer be
  able to turn pipe EAGAIN into session death via ACP stdio.
- Not a CLI/ACP version bump or publish; product still reports shipped
  0.3.7 / 9.2.5 until a separate release.
- Not a claim that every non-transient `io::Error` (BrokenPipe, reset) keeps
  the session alive — those remain fatal by design.
- Not that every test harness duplex site is wrapped; product + shared
  harnesses above are.
