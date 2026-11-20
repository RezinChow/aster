# A6 — canceller fail-closed (no Running zombie)

Date: 2026-11-16.  
Branch: `main`.  
Goal knife: Meta Harness **可信** (defect catalog A6).

## Change

- `register_canceller` keeps the first **live** token; refuses silent
  last-write-wins overwrite (BG plan→child double-register).
- `replace_snapshots` demotes checkpoint `Running` → `Cancelled` because live
  handles cannot be restored — no uncancelable Running zombies after rehydrate.

## Verification

```text
cargo test --locked -p aster-core --lib register_canceller_keeps_first
→ ok

cargo test --locked -p aster-core --lib replace_snapshots_demotes
→ ok

cargo test --locked -p aster-core --lib prefix_fork_rejects_the_closed
→ ok

cargo test --locked -p aster-core --lib background_task_is_promoted_out_of_the_turn
→ ok
```

## Explicitly not claimed

- Product Pass / Meta Harness Done.
- ACP drain TTL (A10), Studio H2, P3 hook Allow admission.
