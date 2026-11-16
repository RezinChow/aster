# k-review · P0-1 + P0-2 local (YOLO)

Scope: uncommitted `main` — permissions self-test (P0-1) + effect rollout hardening (P0-2).
Receipt: `checks_passed` (skill-sync, ai-engineering L3). `review_status=pending` → source review below.
≠产品 Pass.

## Verification boundary

- Re-ran: `permissions::self_test_examples_tests` 5 ok; example exit 0/2; aster-effect oversized/freeze/incomplete_tail/writer_fence/file_reopen + clippy.
- Declared review checks only cover .kstudio tooling, not aster-core/effect product suites.
- Core callers of `FileLog::append` with >12 MiB single records: **unrun**.

## Findings

### F1 · medium · MAX_RECORD_BYTES vs core payload paths

- **Trigger**: P0-2 initially set `MAX_RECORD_BYTES=4MiB`; core has attachment/observation caps up to 16–64 MiB that may become one JSONL fact.
- **Impact**: large tool/observation append could fail closed after this change, blocking resume.
- **Evidence**: `crates/effect/src/log.rs` `MAX_RECORD_BYTES`; `crates/code/core/src/porcelain.rs` `OBSERVATION_BYTE_CAP`; OUTCOME Explicitly not claimed.
- **Action taken in-session**: raised bound to **12 MiB** (still < 16 MiB file cap); tests re-green.
- **Prevention**: keep product-side truncation before effect append; optional hermetic core test that a near-bound payload still appends; do not lower bound without core proof.

### F2 · low · STATUS lagged evidence (process)

- Empty dispatch while P0-1 already had OUTCOME/Tasks.
- **Prevention**: close lineage when evidence lands (applied this wave).

## Semantic conclusion

P0-1 DoD met on observed commands. P0-2 DoD met after 12 MiB bound adjustment; reverse-scan / core `freeze` wiring / daily-stable use **not** claimed.
