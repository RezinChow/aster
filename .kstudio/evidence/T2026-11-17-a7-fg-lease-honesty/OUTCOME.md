# T2026-11-17-a7-fg-lease-honesty

Updated: 2026-11-17 · `/yolo` · defect A7 honesty close · ≠ Meta Done

## Finding

Catalog A7 (“FG `task` skips global scheduler lease”) matches intentional Core design:

```text
crates/code/core/src/tools/task.rs
  /// Host-started workflow executors have no parent lease, so their
  /// foreground steps must be admitted independently. Model-invoked task
  /// tools inherit the enclosing run's lease and leave this false.
  schedule_foreground: bool,
```

- Model-invoked FG `task`: `schedule_foreground=false` → child work rides the **parent run** lease (no double global admit).
- Host/workflow FG: `schedule_foreground=true` when independent admission is required.
- Background `task`: always takes a scheduler lease when a scheduler is present.

## Verification

```text
rg -n "schedule_foreground" crates/code/core/src/tools/task.rs
→ design comment + default false + lease branch `(params.background || self.schedule_foreground)`

No behavior change in this tip.
```

## Explicitly not claimed

- Changing model-invoked FG to take an extra global lease (would double-admit under parent)
- Meta Harness Done / product Pass
- Closing B1/B2 write races
