# CLI installer PATH setup

The Unix installer registers the installed directory in zsh or Bash after the
release checks and file installation succeed. zsh reads the entry from
`.zshenv` under `ZDOTDIR` or `HOME`. Bash reads it from `.bashrc` or the
first applicable login profile. Reinstalling the same directory preserves the
startup files. `--no-modify-path` installs the release without writing them.

## Verification

The tests ran on macOS arm64 with Bash 3.2.57, zsh 5.9, Python 3.9.6, and Rust
1.97.1 for the existing source-stamp harness.

| Command | Result |
| --- | --- |
| `python3 tests/cli_pair_delivery.py -v PairDelivery.test_default_install_works_in_zsh_and_reinstall_preserves_startup_file PairDelivery.test_bash_install_loads_in_login_and_nonlogin_shells` | Both regressions reproduced before the fix. The fixture installed successfully and the fresh shells failed to resolve `aster`. |
| `python3 tests/cli_pair_delivery.py -v` | 23 passed. Coverage includes fresh zsh and Bash sessions, an inherited but temporary PATH, repeated installation, relative and quoted paths with non-ASCII characters, failed installation, and opt-out. |
| `python3 tests/aster_cli_linux.py` | 28 passed using local fixtures for Linux channel selection and packaging. |
| `python3 tests/release_governance.py` | 18 passed. |
| `python3 tests/cli_release_workflow.py` | 21 passed. |
| `/bin/bash -n scripts/install.sh` and `git diff --check` | Both passed. |
| `bash apps/aster/tests/install_release.sh` | The older smoke script stops at its existing `0.1.2` version assertion. The checkout reports `0.4.0`. |

## Explicitly not claimed

- Native Linux or Windows runtime verification, downloads from the live
  release channel, or a published installer update.
- Changes to the calling shell's environment. An already-open Bash or zsh
  session can use the export command printed by the installer.
