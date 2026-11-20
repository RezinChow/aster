# Code/ACP provider retry chrome

Updated: 2026-11-18 · macOS 26.6.2 ARM64 · Rust 1.97.1 · aster-core/ACP 9.3.0 source

## Observed failure

Aster TUI 0.3.9 / ACP 9.2.7 accepted the simple prompt `hi`, then showed only
`Working…` with zero tokens. The ACP log recorded nine consecutive HTTP 429
responses from 16:34:41 through 16:36:52, followed by the user's cancellation
at 16:37:07. The terminal was not deadlocked and the request was not stuck in
kburn/session assembly. See `retry-evidence.log`.

Core already performed bounded exponential-backoff retries, and pager already
had `Rate limited (429) | Retrying…` presentation. The Code/Core ACP path only
logged each retry; it never emitted the existing `retry_state` update, so the
pager incorrectly appeared to make no progress.

## Change

- `aster-core::retry` emits a typed `RetryNotice` before each scheduled backoff.
  A task-local observer isolates concurrent sessions and does not change retry
  budgets, delays, cancellation, or terminal errors. Provider diagnostic bodies
  are bounded before notification.
- ACP scopes ordinary interactive `stream_turn` with that observer and forwards
  notices through the existing `aster/session_notification` transport as
  `sessionUpdate=retry_state`, `type=retrying`.
- Pager is unchanged: its existing retry activity renders the HTTP 429 headline
  and attempt count instead of generic `Working…`.

## Commands and results

```text
cargo test --locked -p aster-core --lib retry_observer_reports_rate_limit_before_successful_retry
→ 1 passed / 0 failed

cargo test --locked -p aster-acp --lib provider_retry_update_uses_existing_pager_retry_state_contract
→ 1 passed / 0 failed

cargo test --locked -p aster-pager --lib retry_activity_label_uses_request_failure_headline
→ 1 passed / 0 failed

cargo test --locked -p aster-core --lib retry::
→ 29 passed / 0 failed

cargo test --locked -p aster-acp --lib agent::emit::tests
→ 5 passed / 0 failed

cargo clippy --locked -p aster-core --all-targets --no-deps
→ exit 0; existing workspace warnings; no finding referenced the changed retry files

git diff --check -- <the five changed Rust files>
→ exit 0
```

`cargo fmt --all -- --check` exits 1 only on the pre-existing modified
`crates/code/core/examples/terminal_bench_runner.rs`; none of this task's five
Rust files appears in its diff output. That unrelated file was not reformatted.

`cargo clippy --locked -p aster-acp --all-targets --no-deps` did not complete:
two dependency `clippy-driver` processes made no CPU progress for about ten
minutes and blocked the build directory, so the check was stopped. A later
focused test rerun likewise did not execute: `sample` showed the test binary
waiting at macOS `_dyld_start`, before Rust `main` (see `test-sample.txt`).
These environment-blocked reruns are not counted as passes or failures.

## Explicitly not claimed

- A real headed TUI run against a live slow/rate-limited provider.
- A fix for provider-side HTTP 429 capacity; this change makes retries visible.
- Installation or replacement of the running `~/.local/bin/aster` and
  `aster-acp` pair. The observed installation remains 0.3.9 / 9.2.7.
- ACP all-target Clippy success, full-workspace rustfmt success, or a successful
  final post-change rerun after the host dynamic-loader stall.
- Commit, push, release, Meta Harness completion, or product-wide Pass.
