# E6 — checkpoint ledger/report poison recover

Date: 2026-11-16.  
Branch: `main`.  
Goal knife: Meta Harness **可信** (defect catalog E6).

## Change

Checkpoint save no longer uses `Mutex::lock().ok()` → empty default on poison.
Poisoned ledger/report locks recover via `into_inner()` so a durable boundary
keeps the mutations already landed.

## Verification

```text
cargo test --locked -p aster-core --lib poisoned_ledger_mutex_recovers
→ ok
```

## Explicitly not claimed

- Product Pass / Meta Harness Done.
- Skipping `save_checkpoint` entirely on poison (recover-in-place chosen).
