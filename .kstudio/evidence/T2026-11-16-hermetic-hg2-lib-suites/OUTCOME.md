# Hermetic pack + HG2 lib graders (core/acp/pager)

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

`scripts/verify-hermetic-perf-e2e.py` gains three `--lib` suites:

| Suite | Package | Filter |
| --- | --- | --- |
| `hg2_core_discard` | aster-core | `hg2_discard_freeze_grader` |
| `hg2_acp_token` | aster-acp | `hg2_token_freeze_grader` |
| `hg2_pager_latency` | aster-pager | `hg2_estimate_line_widths_latency_freeze` |
| `hg2_read_batch_fit_len` | aster-core | `batch_response_len_matches_rendered_string` |

Pack size: **20 → 24** suites. Measurable 高效 surface in the daily hermetic matrix.
≠ HG2 Pass / named YOLO Done.

## Commands / counts

```text
python3 scripts/verify-hermetic-perf-e2e.py \
  --suite hg2_core_discard --suite hg2_acp_token --suite hg2_pager_latency
# → 3 suites, 3 passed; 0 failed
python3 scripts/verify-hermetic-perf-e2e.py --suite hg2_read_batch_fit_len
# → 1 passed
```

Full pack reconfirm (23 suites before fit-len add):

```text
python3 scripts/verify-hermetic-perf-e2e.py
# → 23 suites, 254 passed; 0 failed; 13 ignored
```

Full pack after +fit_len:

```text
python3 scripts/verify-hermetic-perf-e2e.py
# → 24 suites, 255 passed; 0 failed; 13 ignored
```

## Explicitly not claimed

- HG2 Pass / named YOLO Done / Meta Harness Pass.
- Headed / live.
