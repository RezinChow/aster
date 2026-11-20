# T2026-11-17 H7 — cancel honesty toast for running background tasks

## Change
On `TaskResult::CancelComplete`, if the active session still has Running
`bg_tasks`, toast: “Turn cancelled; background tasks are still running.”
Soft-Stop policy unchanged (does not kill bg).

## Command
```bash
cargo test --locked -p aster-pager --lib cancel_complete_toasts_when_background_tasks_still_run
```

## Explicitly not claimed
- Auto-kill background on Stop
- Meta Harness Done / product Pass
