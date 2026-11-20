# Hermetic pack → 27 suites (web_search discard grader)

Date: 2026-11-16.
Branch: `main` @ dirty.

## Change

`hg2_web_search_discard` → `aster-core` filter `hg2_web_search_discarded_chars_freeze`.
Pack **26 → 27**. Prior full pack **26/257/0** reconfirmed.

≠ HG2 Pass / named YOLO Done.

## Commands / counts

```text
python3 scripts/verify-hermetic-perf-e2e.py --suite hg2_web_search_discard
# → 1 passed
python3 scripts/verify-hermetic-perf-e2e.py
# → 26 suites, 257 passed (pre-add reconfirm)
# → 27 suites, 258 passed; 0 failed; 13 ignored
```

## Explicitly not claimed

- Named YOLO Done / headed-live / E4 complete.
