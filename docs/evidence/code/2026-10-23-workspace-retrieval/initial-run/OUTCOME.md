# Reliable workspace retrieval — work in progress

## Result

Implementation and qualification are in progress. This is not a completion claim.

Baseline before the retrieval implementation changes:

- `cargo test --locked -p a3s-code-core --lib workspace::retrieval -- --test-threads=4`: **138 passed**, 0 failed, 223.22s (Core compilation 32.20s). Includes the pre-existing wiki index tests.
- Studio submodule was already initialized at `e04197651c397a7987b14f5f304d592d9c7f1cd5`; existing gitlink/worktree changes were preserved.
- `a3s-test capabilities --json`: failed Web adapter admission (`0.3.2`, expected `>=0.4.0,<0.5.0`). TUI qualification uses its independent driver; this does not establish a TUI failure.
- Root formatting check found changes in pre-existing, concurrently edited unrelated files as well as this epic's edits. Only this epic's files are formatted; the final check will retain the exact remaining paths.

## What landed

Pending final audit; see `specs/011-workspace-retrieval/tasks.md`.

## Explicitly not claimed

- No completion, real-model quality, Semble parity, multi-platform result, commit, or deployment is claimed while qualification is incomplete.
