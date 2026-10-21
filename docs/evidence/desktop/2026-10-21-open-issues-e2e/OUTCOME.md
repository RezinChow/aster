# End-to-end check of the session API and the Kylin launcher

Date: 2026-10-21. This run drives the routes the desktop host posts, and the Kylin launcher script the package execs. It does not click a window.

## Result

On one loopback agent plane with a scripted ACP peer:

- `POST /api/agent-sessions/reuse-or-create` created an empty session.
- `POST /api/agent-sessions/{id}/turns` with `ALPHA-SECRET` finished `hello`. One process launch. The recorded prompt was `ALPHA-SECRET`.
- The next unmarked turn `继续问` stayed on that process. Its reply was `ALPHA-SECRET` plus the new question. The recorded prompt was only `继续问`.
- The next turn whose text contains `【新任务，独立处理，不要参考前文】` and `第二题` finished `hello`. That reply does not contain `ALPHA-SECRET`. The recorded prompt contains the marker and `第二题`, and does not contain `ALPHA-SECRET`. Launches became 2.
- A following `reuse-or-create` for the same agent returned `created: true`, a different session id, and an empty message list. Its first prompt was exactly `BETA-ONLY`. The reply was `hello` and does not contain `ALPHA-SECRET`. Launches became 3.

The Kylin launcher script, sourced and executed under a clean environment, still selects `GTK_IM_MODULE=xim`, `QT_IM_MODULE=xim`, and `XMODIFIERS=@im=fcitx` when the only bus is fcitx4 and the fcitx4 module file is absent. Wayland leaves those unset. The delivery checks for that module choice and for Wayland passed.

#10 stays open. This host did not produce a glibc 2.31 CLI pair, and no Linux binary was executed.

## Validation

| Command | Result |
| --- | --- |
| `cargo test -p a3s-studio --lib -- http_marked_turn_drops_warm_history_and_the_next_session_is_empty -- --test-threads=1` | 1 passed, 0 failed, 908 filtered out, 0.81s. Compile finished in 10.79s. |
| `python3 tests/kylin_input_method.py -v` | 11 tests, 2 skipped, exit 0, 4.976s. |
| `python3 apps/studio/scripts/kylin-flatpak/test_delivery.py -v DeliveryTests.test_native_daemon_identity_selects_only_its_own_module DeliveryTests.test_wayland_does_not_force_an_x11_module` | 2 tests, exit 0, 0.116s. |

The two skipped launcher tests are the real session-bus case (no `dbus-run-session` or `python3-gi`) and the native GDK case (no Xvfb).

An earlier launcher run on a saturated compiler hit the 10 second subprocess timeout on 6 tests. The same command rerun above exited 0. That timeout was not a launcher assertion failure.

## Explicitly not claimed

- No desktop window was clicked, and no real model answered.
- No Kylin machine and no Sogou session were driven.
- #10 was not rebuilt. No glibc 2.31 CLI pair was produced, and no Linux binary was executed on this Mac.
