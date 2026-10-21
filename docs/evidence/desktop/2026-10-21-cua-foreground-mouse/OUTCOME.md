# Foreground CUA without seizing the mouse

Date: 2026-10-21. The catalog window driver attached the already-open Aster window and drove case A23 twice, after the last edit of `window.py`, with no driver edit between the two runs. `A3S_GUI_ALLOW_MOUSE` stayed unset. The Aster process was not started, replaced, or signaled.

## Result

Both live runs agree. The mouse environment is unset, delivery is background, and the pointer verdict is `pointer_same=true`.

| Run | Pointer | Delivery |
| --- | --- | --- |
| 1 | `pointer_before=1919,95`, `pointer_after=1919,95`, `pointer_delta=0,0`, `pointer_same=true` | `non_background=0`, `drive=sent` |
| 2 | `pointer_before=1919,95`, `pointer_after=1919,95`, `pointer_delta=0,0`, `pointer_same=true` | `non_background=0`, `drive=sent` |

The two stdout streams are separate jobs (`A23-xcfrbyqi` and `A23-tsu3epja`). Neither log has `POINTER_WARN` or `pointer_tool_move`. Both have `host_product=AsterDream`, `window_id=138410`, `conversation=new`, and `permission=完全访问`.

Both runs record these action lines:

```
ACTION click delivery_mode: background
ACTION click delivery_mode: background
ACTION click delivery_mode: background
ACTION press_key delivery_mode: background
ACTION press_key delivery_mode: background
ACTION type_text delivery_mode: background
ACTION click delivery_mode: background
delivery_mode: background
```

The attached process is pid 60480, bundle `dev.a3s.studio.aster`, path `~/Library/Application Support/dev.a3s.studio/studio/aster/Aster.app`. `host_product` names that process AsterDream.

An unaddressed key is refused while another on-screen window of the same process is open. The driver closes that sibling with an accessibility press of 关闭, and does not raise the window. The key stays unaddressed.

## Validation

| Command | Result |
| --- | --- |
| `python3 -m unittest cua_guard_test window_runtime_test` in `apps/studio/tests/e2e/task-catalog` | 28 tests, OK. Start with `A3S_GUI_ALLOW_MOUSE=1` raises. Missing, `foreground`, and `hid` delivery for click, press_key, type_text, and hotkey are refused with `driver_called=0`. A reported `foreground` delivery is refused. Coordinate actions and addressed keys are refused with `driver_called=0`. Background click, type_text, and hotkey reach the driver with `non_background=0`. A non-send move raises `pointer moved`. A send-step delta of 24 and 26 prints `POINTER_WARN` and does not raise. |
| `unset A3S_GUI_ALLOW_MOUSE` then `python3 -u window.py --fork-pid 60480 --case A23` in `apps/studio/tests/e2e/task-catalog`, twice | Both runs print the rows above. The Python driver was stopped once `pointer_after`, `pointer_same=true`, `non_background=0`, and `delivery_mode: background` were present. Pid 60480 stayed running. |

## Explicitly not claimed

- No model reply was waited for, and no grader score is part of this pass.
- `A3S_GUI_ALLOW_MOUSE` was not set. No coordinate, HID, drag, or scroll input was used. `raise_window` and `set_frontmost` were not called.
- A second Aster process was not started. The open window was not killed.
- Production `computer_use_runtime_registered` was not turned on.
- The export-menu suite, the send-button restyle, the Kylin launcher check, and GitHub #10 were not redone.
- User sessions created by the two sends were not deleted.
