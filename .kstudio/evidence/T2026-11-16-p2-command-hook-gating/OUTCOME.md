# P2 — command-hook gating fail-closed

Date: 2026-11-16.  
Branch: `main`.  
Goal knife: Meta Harness **可信** (defect catalog P2).

## Change

Trusted command hooks on gating events (`PreToolUse`, `PermissionRequest`,
`PreCompact`, `PrePrompt`, `PrePlanning`, `PreRunControl`) now **Block** on
infrastructure failure (spawn fail, wait fail, timeout, missing exit status,
non-exit-2 failure). Non-gating events still Continue. Aligns with in-process
`HookEngine` gating contract.

- `command_event_is_gating` / `command_hook_infra_failure` in
  `crates/code/core/src/hooks/command.rs`

## Verification

```text
cargo test --locked -p aster-core --lib \
  hooks::command::tests::gating_command_hook_spawn_failure_blocks_instead_of_continuing
→ ok (1 passed)
```

## Explicitly not claimed

- Product Pass / Meta Harness Done.
- A1 task content fingerprint, E3 byte caps, Studio H2 / gitlink land.
- Full hooks suite green beyond the focused gating spawn-failure test.
