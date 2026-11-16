# compaction-ledger-2026-11-16 (P1-5)

## Task

B · implement · P1-5 Compaction budget lifecycle ledger: single assertable pre/post API, hermetic over-budget trigger + standing carry retention. Wiki DoD: `.kstudio/wiki/Codex-Aster-Absorption.md` §P1-5. Decision: `D-2026-11-16-p1-5-wave-lock`.

## Changes

- `crates/code/core/src/compaction/ledger.rs` (new): `CompactionLedger` + `CompactionLedgerPhase` (Open / Started / Completed); `should_trigger`; `mark_started` / `mark_completed`; `auto_compact_fields` for `AgentEvent::AutoCompact`; hermetic tests (3).
- `crates/code/core/src/compaction.rs`: `mod ledger`; re-export `CompactionLedger`; `CompactionBudget::trigger_threshold()`.
- `crates/code/core/src/fact_control/compaction.rs`: `SessionCompact` opens a ledger, emits AutoCompact via ledger fields, records `carried_standing_lines` on complete, traces ledger snapshot.

## DoD checklist

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Single ledger API with assertable pre/post budget fields | `CompactionLedger` getters + lifecycle; tests assert `tokens_used` / `tokens_after` / phase |
| 2 | Hermetic: over-budget triggers and standing carry retained | `over_budget_*` + `over_budget_compact_retains_standing_carry_in_ledger` |
| 3 | OUTCOME records oracle (not “looks shorter”) | this file; reclaim asserted as `tokens_after < tokens_used` |
| 4 | No remote summarizer product behavior | handoff uses existing `seal_summary` / SessionCompact path |

## Commands and results

Branch `main` · mac-dev `/Users/roylin/code/aster` · darwin aarch64 · toolchain from `rust-toolchain.toml`

```bash
cargo test --locked -p aster-core --lib compaction::ledger -- --nocapture
# exit 0 · 3 passed; 0 failed

cargo test --locked -p aster-core --lib -- compact_retains fixed_context_does_not_force compaction::ledger
# exit 0 · 4 passed (3 ledger + fixed_context SessionCompact path)

cargo clippy --locked -p aster-core --lib --no-deps
# exit 0 · no diagnostics in compaction/ledger.rs or fact_control/compaction.rs
# (crate still emits pre-existing unrelated warnings)

rustfmt --check --edition 2021 \
  crates/code/core/src/compaction/ledger.rs \
  crates/code/core/src/compaction.rs \
  crates/code/core/src/fact_control/compaction.rs
# exit 0

git diff --check -- \
  crates/code/core/src/compaction/ledger.rs \
  crates/code/core/src/compaction.rs \
  crates/code/core/src/fact_control/compaction.rs
# exit 0
```

## Explicitly not claimed

- 产品 Pass / 日常稳定使用
- commit / 推送 / 发布通道水位（HG3 仍待用户授权）
- token 计量改为 provider 精确账本（仍为估计路径）
- soak 长会话；ACP wire 新增 compact ledger 字段
- P1-6…P1-8 / P2
- 「像 Codex」观感
