# TUI bottom row and stash-safe active session

Date: 2026-11-17.  
Branch: `main` @ dirty.  
Host: Darwin arm64; `rustc 1.97.1 (8bab26f4f 2026-07-14)`, `aarch64-apple-darwin`.

## Changes

1. `AgentViewLayout` no longer reserves a bottom padding row after the shortcuts bar. The existing gap before the bar remains when no status line is shown.
2. Session creation/resume adds `/.aster/` to the repository's `.git/info/exclude` when state lives at `<workspace>/.aster`. This protects the live fact log from both the built-in stash tool and shell `git stash -u` without editing the project's `.gitignore` or moving session data.
3. A real Git regression test stashes ordinary untracked content, then verifies that the active session JSONL remains present and accepts another fact. Layout and frame-render tests assert that the shortcuts occupy the terminal's final row.

The new stash regression initially failed because the session JSONL had been removed by `git stash --include-untracked`; it passed after the exclusion was added.

## Verification

```text
cargo test --locked -p aster-core session_folder::tests
→ 8 passed; 0 failed

cargo test --locked -p aster-pager --lib views::agent::tests
→ 55 passed; 0 failed

cargo test --locked -p aster-pager --lib followup_composer_pads_arrow_inside_fill_with_status_on_page
→ 1 passed; 0 failed

rustfmt --edition 2021 --check crates/code/core/src/git.rs crates/code/core/src/session_folder.rs
rustfmt --edition 2024 --check crates/terminal/crates/codegen/aster-pager/src/views/agent.rs crates/terminal/crates/codegen/aster-pager/src/app/agent_view/composer_layout_tests.rs
→ both passed

cargo clippy --locked -p aster-core --all-targets --no-deps
→ passed; existing warnings retained

cargo clippy --locked -p aster-pager --all-targets --no-deps
→ passed; existing warnings retained

cargo build --locked -p aster -p aster-acp
→ passed; target/debug/aster and target/debug/aster-acp produced

git diff --check -- <the four source/test files above>
→ passed
```

`cargo fmt --all -- --check` was also attempted, but the dirty workspace contains unrelated formatting drift in other files. The four files touched by this fix pass their edition-specific `rustfmt --check` checks.

## Explicitly not claimed

- No live PTY/manual TUI session was run after the final build; visual verification is the real AgentView Buffer render plus layout tests.
- Only the observed `git stash -u` failure mode is covered. `git stash --all`, external deletion of `.aster`, and arbitrary filesystem failures are not claimed to be recoverable.
- Windows and Linux runtime behavior was not tested; no cross-platform runtime claim is made.
- No commit, push, release, or installation was performed.
