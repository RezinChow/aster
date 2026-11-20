# Hermetic pack → 25 suites (cancel banner grader)

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

`scripts/verify-hermetic-perf-e2e.py` includes `hg2_cancel_banner_line`
(`aster-pager` · `banner_line_is_phrase_with_period`). Pack **24 → 25**.

## Commands / counts

```text
python3 scripts/verify-hermetic-perf-e2e.py --suite hg2_cancel_banner_line
# → 1 suite, 1 passed; 0 failed

python3 scripts/verify-hermetic-perf-e2e.py
# → 25 suites, 256 passed; 0 failed; 13 ignored; ~347s
```

## Explicitly not claimed

- HG2 Pass / named YOLO Done / Meta Harness Pass.
- Headed / live / e_bash / v912.
