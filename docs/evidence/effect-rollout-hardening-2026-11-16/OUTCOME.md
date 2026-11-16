# effect-rollout-hardening-2026-11-16 (P0-2)

## Task

Deepen `aster-effect` file-log hardening with Codex-inspired mechanisms (bounded record, refuse bad lines, fenced writers, byte freeze), not Codex layout. Wiki DoD: `.kstudio/wiki/Codex-Aster-Absorption.md` §P0-2.

## Aster contract (choice: reject, never skip)

- Corrupt line or truncated tail → `FileLog::read` / `append` / `truncate_after` / `freeze` return `ActorError::Schema`; file bytes unchanged, no quarantine or rewrite.
- Single record longer than `MAX_RECORD_BYTES` (12 MiB) → refused before `parse_fact_json`; a valid record after it is **not** read (no mid-file skip). Bound raised from an initial 4 MiB review finding so common core tool/attachment-sized facts are less likely to be refused while staying below the 16 MiB file cap. `append` applies the same bound (`encode_facts`) so no Aster-written record is later unreadable. The 16 MiB file cap and 100 000 fact cap are unchanged.
- Writers: `try_writer_fence` / `ActorError::LogBusy` unchanged (existing fencing tests below).
- `FileLog::freeze(thread)` → `LogFreeze { cut: LogCut, byte_len }`. `LogCut` shape is unchanged, so `crates/code/core` cut equality is untouched.

## DoD checklist

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Truncated/corrupt JSONL → documented reject | `incomplete_tail_refuses_without_quarantine_or_rewrite`; `file_reopen::a_corrupt_jsonl_line_makes_resume_return_schema_without_appending`; `harness::a_corrupt_log_line_is_a_schema_error`; README section "A damaged log is refused, not repaired" |
| 2 | Oversized single record bounded before parse | `MAX_RECORD_BYTES` in `crates/effect/src/log.rs`; `oversized_single_record_is_refused_without_misparse`, `oversized_record_append_is_refused_before_it_becomes_unreadable` |
| 3 | Write concurrency fence documented + cited | `log::fencing::tests::{writer_fence_is_exact_reentrant_and_survives_until_the_last_borrow, real_child_process_observes_writer_owner_and_release_boundaries, a_child_parked_before_exec_does_not_extend_parent_fences, ...}` (existing, unchanged) |
| 4 | This OUTCOME | yes |
| 5 | `.kstudio` pointer OUTCOME | `.kstudio/evidence/T2026-11-16-p0-2-effect-rollout/OUTCOME.md` |
| + | Byte freeze | `log_cut_or_freeze_exposes_committed_byte_len` |

## Commands and results

Branch: `main` · machine: mac-dev `/Users/roylin/code/aster` · darwin arm64 host toolchain from `rust-toolchain.toml`

```bash
cargo test --locked -p aster-effect --lib oversized_single_record -- --nocapture
# exit 0 · 1 passed; 0 failed
cargo test --locked -p aster-effect --lib log_cut_or_freeze -- --nocapture
# exit 0 · 1 passed; 0 failed
cargo test --locked -p aster-effect --lib incomplete_tail -- --nocapture
# exit 0 · 1 passed; 0 failed
cargo test --locked -p aster-effect --lib writer_fence -- --nocapture
# exit 0 · 1 passed; 0 failed (filter matches writer_fence_is_exact_reentrant_…)
cargo test --locked -p aster-effect --test file_reopen -- --nocapture
# exit 0 · 6 passed; 0 failed
cargo test --locked -p aster-effect
# exit 0 · lib 99 passed, 1 ignored (child-process probe); integration binaries 4+2+15+6+18+6+14+1+7 passed; 0 failed
cargo clippy --locked -p aster-effect --all-targets --no-deps
# exit 0 · no warnings
rustfmt --check --edition 2021 crates/effect/src/log.rs crates/effect/src/lib.rs
# exit 0
```

## Test change note

`exact_byte_limit_is_readable_but_growth_is_refused_without_rewriting` previously stored one 16 MiB record, which the new per-record bound correctly refuses. It now fills the 16 MiB file cap exactly with several records under `MAX_RECORD_BYTES`; every original assertion (exact-size read, idempotent re-append, growth refused with bytes unchanged, `truncate_after` to empty) is kept.

## Code landing

- `crates/effect/src/log.rs` — `MAX_RECORD_BYTES`, read/write bound, `LogFreeze`, `FileLog::freeze`
- `crates/effect/src/lib.rs` — exports
- `crates/effect/src/log/security_tests.rs` — new tests; adjusted exact-limit fixture
- `crates/effect/README.md`, `README.zh-CN.md` — contract section

## Explicitly not claimed

- Product Pass / daily-stable use
- Codex rollout filenames, directories, `state_db`, or reverse JSONL scanner (no reverse scan built)
- Skipping or repairing bad mid-file lines (Aster refuses)
- In-process counters / write-lock metrics (not built)
- `crates/code/core` `session_folder.rs` / `fact_control/` changes; no core callers of `freeze` yet
- Whether any `crates/code/core` flow writes a single record over 12 MiB (core tests not run in this task; porcelain `OBSERVATION_BYTE_CAP` is 64 MiB and may still need product-side truncation before effect append)
- Cross-platform runtime: only macOS (darwin) native run; Linux / Windows not run
- P0-3 / P0-4 mechanisms; `cargo test --workspace`; repo-wide `cargo fmt --all -- --check` (pre-existing diff in `crates/use/tool-acquire`, unrelated)
