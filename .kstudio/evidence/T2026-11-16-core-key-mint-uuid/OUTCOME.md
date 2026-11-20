# Core fact key mint without full JSONL read

Date: 2026-11-16.  
Branch: `main`.  
Named YOLO scope: aster-core 性能 / 效率.

## Change

`FactControl::{user_text,confirm,answer}` mint `m-` / `c-` / `a-` keys with
`uuid::Uuid::new_v4()` instead of `log.read(...).len()`. That removed a full
effect JSONL parse on every user/confirm/answer append (ingest still reads for
settlement).

`confirm_if_pending` reuses `resume_limit(0)` settlement log length instead of
an extra `read_facts()?.len()` before `confirm`.

## Verification

```text
cargo test --locked -p aster-core --lib fact_log_steer_is_a_user_message_fact
→ ok. 1 passed (asserts uuid-backed `m-<uuid>` keys)
cargo test --locked -p aster-core --lib fact_log_confirm_is_true_only_for_the_pending_tool
→ ok. 1 passed
```

## Explicitly not claimed

- Catalog E4 (`byte_budget` / `FileLog::freeze` wiring) — separate gap.
- Product Pass / overall GOALS Done.
