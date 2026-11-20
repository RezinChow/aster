# T2026-11-17-hermetic-e2-e8-p7-p8

Updated: 2026-11-17 · hermetic pack +4 graders · ≠产品 Pass

## Change

`scripts/verify-hermetic-perf-e2e.py` registers:

| Suite | Package | Filter |
| --- | --- | --- |
| `hg2_e8_compaction_failed` | aster-core | `mid_flight_failure_leaves_failed_not_started` |
| `hg2_e2_empty_line_refuse` | aster-effect | `empty_mid_file_line_refuses_the_whole_read` |
| `hg2_p7_feature_switch` | aster-acp | `initialize_projects_feature_switch_admission` |
| `hg2_p8_permission_denial` | aster-acp | `permission_denial_raw_output_carries_stable_code` |

## Verification

```text
python3 scripts/verify-hermetic-perf-e2e.py \
  --suite hg2_e8_compaction_failed \
  --suite hg2_e2_empty_line_refuse \
  --suite hg2_p7_feature_switch \
  --suite hg2_p8_permission_denial
→ 4 suites / 4 passed / 0 failed
```

## Explicitly not claimed

- Full pack default run recounted in this tip
- Meta Harness Done
