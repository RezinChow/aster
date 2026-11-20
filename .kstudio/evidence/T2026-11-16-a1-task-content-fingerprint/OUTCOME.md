# A1 — `task` in-flight content fingerprint

Date: 2026-11-16.  
Branch: `main`.  
Goal knife: Meta Harness **高效** + **可信** (defect catalog A1).

## Change

Identical in-flight `(agent, description, prompt, workspace)` can no longer
spawn a second child under a fresh `task-{uuid}`:

- Shared `in_flight_task_content` map on `TaskExecutor` (survives
  `scoped_for_invocation` clones).
- Lease held for the scoped / background run lifetime; Drop releases the slot.
- Empty/whitespace `prompt` refused before launch.
- In-call fan-out rejects duplicate rows before spawn.

## Verification

```text
cargo test --locked -p aster-core --lib \
  tools::task::tests::task_tool_rejects_duplicate_in_flight_content_fingerprint
→ ok (1 passed)
```

## Explicitly not claimed

- Product Pass / Meta Harness Done.
- Coalescing into one child (refuse-only, not merge).
- Cross-process / cross-host dedup; completed tasks may be retried.
- E3 observation byte caps, Studio H2, gitlink land.
