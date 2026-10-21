# Kylin fcitx4 XIM channel and glibc 2.31 CLI pair

Date: 2026-10-21. Live open issues on `aster-ai-lab/aster` at the start were #11 and #10. Closed #1–#7 were not reopened.

## Result

On an X11 session whose only input-method bus is fcitx4, and whose fcitx4 module-id file is absent, the Kylin launcher now selects `GTK_IM_MODULE=xim`, `QT_IM_MODULE=xim`, and `XMODIFIERS=@im=fcitx`. Apply replaces stale values with those three and still prints `kylin-im: missing-fcitx4-module`. A session that already has an fcitx5 module keeps that module. An ibus session stays `GTK_IM_MODULE=ibus`. Wayland does not set an X11 module. No fcitx4 GTK module was added to the bundle.

#11 is closed. The comment records the hermetic launcher run.

No glibc 2.31 x86_64 CLI archive was produced. This host is Darwin arm64. `x86_64-linux-gnu-gcc` is absent, and the probed glibc 2.31 sysroot directories are absent. `scripts/package-aster-cli.sh` packages an existing bin-dir and executes both binaries. The release workflow builds with `cargo build --locked --release -p aster -p a3s-code-acp` on ubuntu-latest. zig and cargo-zigbuild are installed and were not used. #10 stays open. The comment records that blocker.

## Validation

| Command | Result |
| --- | --- |
| `gh issue list --repo aster-ai-lab/aster --state open --json number,title,state,createdAt,updatedAt` | exit 0. Open set: #11, #10. Closed #1–#7 absent. |
| `python3 tests/kylin_input_method.py -v` | 11 tests, 2 skipped, exit 0. Passed cases include `test_four_host_sessions`, `test_fcitx4_uses_its_own_module_and_current_display_bus`, and `test_fcitx5_uses_the_bundled_module_on_x11`. |
| `python3 apps/studio/scripts/kylin-flatpak/test_delivery.py -v DeliveryTests.test_native_daemon_identity_selects_only_its_own_module DeliveryTests.test_wayland_does_not_force_an_x11_module` | 2 tests, exit 0. |
| Host probe of rustc, rustup targets, `x86_64-linux-gnu-gcc`, zig, and glibc 2.31 sysroot directories | exit 2. No archive. No `GLIBC_` symbol check, because no pair exists. |
| `gh issue comment 11`, `gh issue close 11 --reason completed`, `gh issue comment 10`, then `gh issue view` | comment and close exit 0. #11 CLOSED. #10 OPEN. Closed #1–#7 still CLOSED. |
| `cargo fmt --all -- --check` | exit 0. Empty diff. `crates/effect/src/coding/revalidation_tests.rs` was formatted so this check passes. |

The two skipped launcher tests are the real session-bus case (no `dbus-run-session` or `python3-gi`) and the native GDK case (no Xvfb).

## Abandoned alternative

Bundling an fcitx4 GTK module was not done. Calling cargo-zigbuild to invent a glibc 2.31 pair was not done. The existing packager does not call zig, and a newer-glibc binary would not be the Kylin build.

## Explicitly not claimed

- No real Kylin desktop was driven.
- No Sogou session was driven.
- No GUI catalog was run.
- No fcitx4 GTK module was bundled.
- The candidate window was not made to follow the caret.
- #10 was left open. No glibc 2.31 CLI pair was built, and no Linux binary was executed on this Mac.
