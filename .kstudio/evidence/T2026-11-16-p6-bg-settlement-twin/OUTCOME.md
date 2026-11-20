# P6 follow-up — WC-BG1 twin allow policy after Ask fail-closed

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Cause

P6 made Ask-without-HITL `confirmation_required`. The hermetic
`the_run_receives_background_output_and_settles_the_task` twin had no
`PermissionPolicy::allow("*")`, so `background` start/tail were denied and no
`background.output` facts were written. Scripted answer still contained the
mark, masking the miss. Also used `path` instead of `file_path` on `read`.

## Fix

- `.with_permission_policy(PermissionPolicy::new().allow("*"))`
- `"path"` → `"file_path"`

## Verification

```text
cargo test --locked -p aster-core --lib the_run_receives_background_output_and_settles_the_task → ok
```

## Explicitly not claimed

- Product Pass / named YOLO Done.
- Live background containment qualification.
