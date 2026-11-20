# T2026-11-17-kburn-workflow-helpers

Updated: 2026-11-17 · ≠产品 Pass · ≠ HG6 关 · ≠ Meta Harness Done

## Slice

Vendor eng-root-portable workflow helpers into Core factory skeleton and materialize seeds:

- `workflow/sitrep.py`
- `workflow/progress-scan.py`
- `workflow/sync-k-skills.py`
- `workflow/print-paste.sh`

Helpers resolve `ENG = parents[1]` (`.aster` or `.kstudio`). ACP `/kburn` coverage lists helper count. Smoke: sitrep under temp `.aster/` prints HEAD.

## Commands

```bash
cargo test --locked -p aster-core --lib materialize_seeds_workflow_helpers_under_aster -- --nocapture
cargo test --locked -p aster-core --lib materialize_factory_seeds_creates_missing_only -- --nocapture
cargo test --locked -p aster-acp --lib format_kburn_coverage_reports -- --nocapture
```

## Counts

| Check | Result |
| --- | --- |
| `materialize_factory_seeds_creates_missing_only` | **1 passed** |
| `materialize_seeds_workflow_helpers_under_aster` | **1 passed** |
| sitrep smoke under `.aster/` | **exit 0** |
| `format_kburn_coverage_reports_…` | **1 passed** |

## Explicitly not claimed

- HG6 / Meta Harness Done
- Headed / Studio H2
- Replacing this repo's live `.kstudio/workflow/*` with factory copies
