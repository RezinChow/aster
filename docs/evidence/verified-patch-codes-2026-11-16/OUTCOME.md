# verified-patch-codes-2026-11-16 (P1-7)

## Task

B · implement · P1-7 Verified edit/patch pipeline deepening: stable failure codes for bad hunk / ambiguous context / line endings / batch limits; hermetic coverage. Wiki DoD: `.kstudio/wiki/Codex-Aster-Absorption.md` §P1-7. Decision: `D-2026-11-16-p1-7-wave-lock`.

## Changes

- `crates/code/core/src/tools/builtin/patch.rs`: typed `PatchFailure` / `PatchFailureCode`; parse/apply return codes; tool errors expose `metadata.patch.code` (`patch.parse`, `patch.context_mismatch`, `patch.range_invalid`, `patch.line_ending`, `patch.batch_limit`, `patch.batch_bytes`, `patch.argument`, `patch.io`, `patch.version_conflict`); hermetic tool test for mismatch / mixed CRLF / batch cap.
- `crates/code/core/src/tools/builtin/edit.rs`: `metadata.edit.code` for `edit.not_found` / `edit.ambiguous` / `edit.line_ending`.

## DoD checklist

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Bad hunk / ambiguous context have stable error codes | `patch.context_mismatch`; `edit.ambiguous` / `edit.not_found` |
| 2 | Hermetic CRLF / uniqueness / batch limit | CRLF preserve + mixed refuse; edit uniqueness; `patch.batch_limit` |
| 3 | Do not shove test-suite runs into the patch parser | unchanged; codes are typed at failure sites |
| 4 | OUTCOME with oracle | this file |

## Commands and results

Branch `main` · mac-dev `/Users/roylin/code/aster` · darwin aarch64

```bash
cargo test --locked -p aster-core --lib -- tools::builtin::patch:: -- --nocapture
# exit 0 · 26 passed; 0 failed

cargo test --locked -p aster-core --lib -- test_edit_not_unique test_edit_not_found -- --nocapture
# exit 0 · 2 passed; 0 failed

rustfmt --check --edition 2021 \
  crates/code/core/src/tools/builtin/patch.rs \
  crates/code/core/src/tools/builtin/edit.rs
# exit 0
```

## Explicitly not claimed

- 产品 Pass / 日常稳定使用
- commit / 推送 / 发布（HG3）
- Codex apply-patch 语法替换
- ACP/effect 传播 patch/edit 码
- P1-6 / P1-8 / P2
