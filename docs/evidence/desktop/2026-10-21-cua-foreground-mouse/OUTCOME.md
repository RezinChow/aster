# Foreground CUA without seizing the mouse

Date: 2026-10-21. This note is taken from the two live A23 logs of this pass and from the catalog unittest log saved with them. An older pair of A23 logs is not this pass.

## Result

`A3S_GUI_ALLOW_MOUSE` stayed unset. The already-open window was Aster pid 60480, bundle `dev.a3s.studio.aster`, path `~/Library/Application Support/dev.a3s.studio/studio/aster/Aster.app`. The log names `host_product=AsterDream` and `window_id=138410` (title Aster). That process was not started again, killed, or signaled. No second Aster process was running after the two attaches.

Both runs used the shipped entry and the same pointer verdict.

| Run | Job | Pointer | Delivery |
| --- | --- | --- | --- |
| 1 | `a3s-studio-reference-A23-vfi80n34` | `pointer_before=1918,626`, `pointer_after=1918,626`, `pointer_delta=0,0`, `pointer_same=true` | `non_background=0` |
| 2 | `a3s-studio-reference-A23-76rgcgbv` | `pointer_before=1918,626`, `pointer_after=1918,626`, `pointer_delta=0,0`, `pointer_same=true` | `non_background=0` |

Each log also has `A3S_GUI_ALLOW_MOUSE=unset`, `host_product=AsterDream`, `conversation=new`, `permission=完全访问`, and `draft_cleared=new-task`. Neither log has `POINTER_WARN`, `pointer_tool_move`, `delivery_mode: foreground`, or `delivery_mode: hid`.

Action lines, the same in both logs:

```
ACTION click delivery_mode: background
ACTION click delivery_mode: background
ACTION click delivery_mode: background
ACTION click delivery_mode: background
ACTION press_key delivery_mode: background
ACTION type_text delivery_mode: background
ACTION click delivery_mode: background
```

A non-empty draft is cleared by a background click on 新建任务 when that button is present. select-all then delete remains only when the button is absent, because that delete moved the host pointer. Both live logs printed `draft_cleared=new-task` and then `pointer_delta=0,0`.

`require_pointer_still` still warns only when the tool is the send step and the span is within 2 of 24. Every other move raises `pointer moved`. A non-background reported delivery still increments `non_background` and raises.

## Commands

From `apps/studio/tests/e2e/task-catalog`, with `A3S_GUI_ALLOW_MOUSE` unset and without `--launch`:

```
python3 -u window.py --case A23 --fork-pid 60480
```

The entry ran twice, at 20:11:12 (pid 12927) and 20:12:25 (pid 14104). Each process was stopped once `pointer_after`, `non_background`, `conversation`, `permission`, and an `ACTION` line were in its log. The stop signal went to that python pid only. Pid 60480 was still alive afterward (one Aster process, mouse env unset).

Stdout is in these files:

- `/var/folders/3d/0pn3wn612t7cs79b5ml89x440000gn/T/grok-goal-33ed537b676c/implementer/cua-foreground-1.log`
- `/var/folders/3d/0pn3wn612t7cs79b5ml89x440000gn/T/grok-goal-33ed537b676c/implementer/cua-foreground-2.log`

Run 1 ends at `reply_session=new`. Run 2 also contains `reply_chars=556` and `grader_pass=true`, because that reply returned inside the stop poll. Those lines are not the pass.

## Hermetic checks

`python3 -m unittest cua_guard_test window_runtime_test` in the same directory overwrote `/var/folders/3d/0pn3wn612t7cs79b5ml89x440000gn/T/grok-goal-33ed537b676c/implementer/cua-guard.log`. The log ends with `Ran 30 tests in 0.315s` and `OK`.

| Check | Observation in that log |
| --- | --- |
| Set mouse env | `refuse_start A3S_GUI_ALLOW_MOUSE=1 driver_called=0` |
| Missing, foreground, or hid delivery | `refuse_click`, `refuse_press_key`, `refuse_type_text`, and `refuse_hotkey` each print `driver_called=0` |
| Reported foreground delivery | `refuse_reported_click delivery_mode=foreground` |
| Coordinates and addressed keys | `refuse_coordinate_action driver_called=0`, `refuse_addressed_key driver_called=0` |
| Background actions | `background_actions=3 non_background=0` |
| Non-send pointer move | `pointer_tool_move tool=press_key` and `non_send_pointer_move raises pointer moved` |
| Send-step warning | `POINTER_WARN action=send delta=24` and `POINTER_WARN action=send delta=26` |
| Send span outside that window | `pointer_tool_move tool=send before=10,10 after=58,10` |
| Draft clear | `a drafted composer prefers a new task over delete` |
| Knowledge page | `knowledge page is left through the work button` |
| Sibling close | `sibling window closes by pressing 关闭 without raising it` |

Driver hashes at the time of this note. `window.py` and `window_runtime_test.py` were last written at 19:31:26, before the two attaches:

- `window.py` `c0e727f4701b352d58ab167b652acb2d1d220df528907a6ae6d94b6924910c8a`
- `cua_guard.py` `5dd96de5221879779005d2d87455f5afd516bb66657eabb68d7c8f56052e1de9`
- `cua_guard_test.py` `e2fcd01a9a9be6abd3297d622a165f9ed4d75b6955f91a56efa5da8644338664`
- `window_runtime_test.py` `d2435747575e9a757ff445e9fbd7910d255b0dd876548d37247d9d26784c27ea`

## Explicitly not claimed

- Jobs `a3s-studio-reference-A23-xcfrbyqi` and `a3s-studio-reference-A23-tsu3epja` are not this pass.
- The partial job `a3s-studio-reference-A23-vcrj8dy0` stopped at `pointer_before` and has no delivery lines. It is not a pass.
- `cua-foreground-launch-error.log` records an earlier moment when another suite held the window. It is not the live result.
- The other suite's A23, CAT-MAIL, and A29 logs are not this pair.
- A model reply and `grader_pass` are not the result of this pass. Run 2 happens to contain both.
- `A3S_GUI_ALLOW_MOUSE` was not set. No coordinate, HID, drag, or scroll input was used. `raise_window` and `set_frontmost` were not called.
- Production `computer_use_runtime_registered` was not turned on.
- The HTML workspace preview, the task-file download, the export-menu suite, the send-button restyle, the Kylin launcher check, and GitHub #10 were not redone.
- No user session was deleted. Pid 60480 and the other suite were not signaled.

## Later attach, same day

A second pass re-ran the hermetic guard and then tried to attach again. The already-open AsterDream was pid 76915, bundle path `~/Library/Application Support/dev.a3s.studio/studio/aster/Aster.app`, onscreen `window_id=144833` title Aster. Pid 60480 was not running. This pass did not signal 76915, did not start a second AsterDream (`aster_app_count=1`), and did not pass `--launch`.

The window was first held by another catalog driver: pid 85754, `window.py --case A36 --fork-pid 76915`. That moment is `cua-foreground-launch-error.log` in this pass's scratch (`driver_started=0`, `second_asterdream_started=0`, `host_signaled=0`). A later A36 driver, pid 92029, held the same window. This pass waited until no `window.py` or `review_window.py` was running, then attached twice. It did not signal pid 85754, pid 92029, or pid 76915.

## Live attaches

Both runs used the shipped entry from `apps/studio/tests/e2e/task-catalog`, with `A3S_GUI_ALLOW_MOUSE` unset and without `--launch`:

```
python3 -u window.py --case A23 --fork-pid 76915
```

Run 1 was python pid 97799. Run 2 was python pid 99050. Each process was stopped once `pointer_same=true`, `pointer_delta=0,0`, `non_background=0`, and the `ACTION` lines were in its log. The stop signal went to that python pid and to the `cua-driver` child of that pid. Pid 76915 was still alive afterward, and `aster_app_count=1`.

| Run | Job | Pointer | Delivery |
| --- | --- | --- | --- |
| 1 | `a3s-studio-reference-A23-tb_6vqrt` | `pointer_before=1724,1079`, `pointer_after=1724,1079`, `pointer_delta=0,0`, `pointer_same=true` | `non_background=0` |
| 2 | `a3s-studio-reference-A23-_c47z0mk` | `pointer_before=1724,1079`, `pointer_after=1724,1079`, `pointer_delta=0,0`, `pointer_same=true` | `non_background=0` |

Both logs name `aster_pid=76915`, `host_bundle=dev.a3s.studio.aster`, `host_product=AsterDream`, `window_id=144833`, `conversation=new`, `permission=完全访问`, and `draft_cleared=new-task`. Neither log contains `POINTER_WARN`, `delivery_mode: foreground`, or `delivery_mode: hid`. The two action lists match:

```
ACTION click delivery_mode: background
ACTION click delivery_mode: background
ACTION click delivery_mode: background
ACTION click delivery_mode: background
ACTION press_key delivery_mode: background
ACTION type_text delivery_mode: background
ACTION click delivery_mode: background
```

Stdout is in these files:

- `/var/folders/3d/0pn3wn612t7cs79b5ml89x440000gn/T/grok-goal-aec5d9bebde9/implementer/cua-foreground-1.log`
- `/var/folders/3d/0pn3wn612t7cs79b5ml89x440000gn/T/grok-goal-aec5d9bebde9/implementer/cua-foreground-2.log`

Each log ends at `delivery_mode: background`. Neither contains `reply_chars` or `grader_pass`. `drive=sent` is not the pass.

### Hermetic checks

`python3 -m unittest cua_guard_test window_runtime_test` from `apps/studio/tests/e2e/task-catalog` wrote this pass's `cua-guard.log`. The log ends with `Ran 30 tests in 0.313s` and `OK`. No guard source change was required.

| Check | Observation in that log |
| --- | --- |
| Set mouse env | `refuse_start A3S_GUI_ALLOW_MOUSE=1 driver_called=0` |
| Missing, foreground, or hid delivery | `refuse_click`, `refuse_press_key`, `refuse_type_text`, and `refuse_hotkey` each print `driver_called=0` for `missing`, `foreground`, and `hid` |
| Reported foreground delivery | `refuse_reported_click delivery_mode=foreground` |
| Coordinates and addressed keys | `refuse_coordinate_action driver_called=0`, `refuse_addressed_key driver_called=0` |
| Background actions | `background_actions=3 non_background=0` |

Driver hashes matched the earlier note. No file in the driver set was rewritten before this capture:

- `window.py` `c0e727f4701b352d58ab167b652acb2d1d220df528907a6ae6d94b6924910c8a`
- `cua_guard.py` `5dd96de5221879779005d2d87455f5afd516bb66657eabb68d7c8f56052e1de9`
- `cua_guard_test.py` `e2fcd01a9a9be6abd3297d622a165f9ed4d75b6955f91a56efa5da8644338664`
- `window_runtime_test.py` `d2435747575e9a757ff445e9fbd7910d255b0dd876548d37247d9d26784c27ea`

### Explicitly not claimed

- The A01–A51 GUI catalog was not run and is not claimed. The two A23 attaches above are the foreground pointer check only.
- A model reply and `grader_pass` are not the pass. Both logs stop before either line.
- WorkBuddy was not connected. A computer-use runtime click was not performed.
- `A3S_GUI_ALLOW_MOUSE` was not set. Accessibility was not granted. The operator pointer stayed at `1724,1079` in both logs.
- The other suite's driver was not signaled. Pid 76915 was left running. The held-window file `cua-foreground-launch-error.log` is the earlier gap, not the live result.
