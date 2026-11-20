# Hermetic pack → 28 suites (stream toolcall snapshot grader)

Date: 2026-11-16.
Branch: `main` @ dirty.

## Change

`hg2_stream_toolcall_snapshot` freezes get_mut preserve-bound-args behavior.
Pack **27 → 28**.

≠ HG2 Pass / named YOLO Done.

## Commands / counts

```text
python3 scripts/verify-hermetic-perf-e2e.py --suite hg2_stream_toolcall_snapshot
# → 1 passed
```

`python3 scripts/verify-hermetic-perf-e2e.py` → **28 suites, 259 passed; 0 failed; 13 ignored**.

## Explicitly not claimed

- Named YOLO Done / headed-live.
