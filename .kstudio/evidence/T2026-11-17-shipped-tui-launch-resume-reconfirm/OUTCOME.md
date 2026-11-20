# T2026-11-17-shipped-tui-launch-resume-reconfirm

Updated: 2026-11-17 · hermetic reconfirm · ≠headed Pass · ≠产品 Pass

## Observation

Prior YOLO tip saw `shipped_tui_launch_resume_and_visible_commands` fail at
`yolo did not write the marker` after `/yolo` permission toggle. Suspected
bare-skill `/yolo` vs session-mode `/yolo` collision.

## Reconfirm

```text
cargo test --locked -p aster-acp --test shipped_tui_e2e \
  shipped_tui_launch_resume_and_visible_commands -- --nocapture --test-threads=1
→ test result: ok. 1 passed; 0 failed; finished in 91.57s
```

Oracles include `yolo-flag` and `yolo` (new side-effect.txt, no permission
prompt). Failure classified as **flake**, not skill/mode name collision.

## Explicitly not claimed

- Non-flaky forever; headed Studio Pass; Meta Harness Done.
