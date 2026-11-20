# T2026-11-17-hermetic-arc-e4-c1

Updated: 2026-11-17 · hermetic pack +3 · ≠ Meta Done

## Change

Registered three lib graders in `scripts/verify-hermetic-perf-e2e.py`:

| Suite | Package | Filter |
| --- | --- | --- |
| `hg2_blockcontext_appearance_arc` | aster-pager | `context_with_mode_arc_shares_appearance_pointer` |
| `hg2_e4_update_plan_discarded` | aster-core | `update_plan_reports_discarded_chars_when_steps_truncate` |
| `hg2_c1_confine_verify_stub` | aster-confine | `verify_entry_points_fail_closed_with_stable_stub_message` |

## Verification

```text
python3 scripts/verify-hermetic-perf-e2e.py \
  --suite hg2_blockcontext_appearance_arc \
  --suite hg2_e4_update_plan_discarded \
  --suite hg2_c1_confine_verify_stub
→ 3 suites / 3 passed / 0 failed
```

## Explicitly not claimed

- Full default pack re-run
- Meta Harness Done / HG2 / E4 / C1 product Pass
