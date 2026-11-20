# Plan replay: checkpoint-running child fail-closes to stopped

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

`load_replay_publishes_the_resumed_typed_plan` drained only completed/cancelled
child lifecycle packets and then asserted silence. Resume now fail-closes a
checkpoint-`running` child (no live canceller) with `subagent_finished` /
`stopped`, so the suite expected one more triple for `replay-running`.

Also: transcript replay uses `prepared_raw_input` (pager remaps) instead of
bare `args.clone()`.

## Commands / counts

```text
cargo test --locked -p aster-acp --lib -- extensions::plan_replay -- --test-threads=1
# → 4 passed; 0 failed
```

## Explicitly not claimed

- Named YOLO Done / Meta Harness Pass.
- Product change to fail-closed settle (pre-existing); this is test alignment.
