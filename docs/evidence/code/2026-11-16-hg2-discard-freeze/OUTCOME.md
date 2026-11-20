# HG2 discard freeze grader

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

Added `hg2_discard_freeze_grader_total_minus_retained` in `byte_budget` tests:
fixed total/retained pairs (including bash-style 4096/8→4088) freeze the
shared `discarded_bytes` oracle. Complements token + latency HG2 graders.

## Commands / counts

```text
cargo test --locked -p aster-core --lib hg2_discard_freeze_grader -- --test-threads=1
# → 1 ok
```

Hermetic pack oracle: **20 suites / 251 / 0**.

## Explicitly not claimed

- HG2 Pass / named YOLO Done / Meta Harness Pass.
- Headed Studio / live LLM.
