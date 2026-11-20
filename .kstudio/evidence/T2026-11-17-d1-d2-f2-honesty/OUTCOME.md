# T2026-11-17-d1-d2-f2-honesty

Updated: 2026-11-17 · `/yolo` · D1/D2/F2 honesty · ≠ Meta Done

## Findings

| ID | Status | Note |
| --- | --- | --- |
| D1 | known seam | ACP `__aster/execution/observe` double-underscore wire; Studio accepts both; rename needs coordinated host |
| D2 | intentional | `cancelSubagents` defaults true; host may opt out |
| F2 | intentional | Implementer child omits nested `task`; parent still fans out |

No behavior change in this tip.

## Explicitly not claimed

- Renaming the observe seam without Studio coordination
- Forcing cancelSubagents=true on every host
- Meta Harness Done
