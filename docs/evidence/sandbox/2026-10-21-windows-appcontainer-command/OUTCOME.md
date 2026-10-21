# Windows AppContainer command on this machine

Status: hermetic package tests and one live sandbox command passed on 2026-10-21.
This is not a `just code` session and not a model launch.

## Machine

- PowerShell 7.6.6 at `C:\Program Files\PowerShell\7\pwsh.exe`.
- `A3S_SANDBOX_PWSH` was unset, so the sandbox launcher used that file.
- Windows PowerShell 5.1 is also installed. This command did not use it.

## Hermetic commands

Binary: `C:\Users\admin\.cargo\bin\cargo.exe`. Working directory: `D:\code\aster`.
`PROTOC` was `C:\Users\admin\AppData\Local\protoc\bin\protoc.exe`. Every command
exited 0.

| Command | Passed |
| --- | ---: |
| `cargo test --locked -p a3s-code-acp --lib config::tests -- --test-threads=8` | 23 |
| `cargo test --locked -p a3s-code-acp --lib launch_model -- --test-threads=8` | 2 |
| `cargo test --locked -p a3s-code-pager --lib user_home_uses_userprofile -- --test-threads=8` | 1 |
| `cargo test --locked -p a3s-code-pager --lib config_path_prefers_explicit_file -- --test-threads=8` | 1 |
| `cargo test --locked -p a3s-code-core --lib host_powershell_env -- --test-threads=8` | 3 |
| `cargo test --locked -p a3s-code-core --lib git_install -- --test-threads=8` | 4 |
| `cargo test --locked -p a3s-code-core --lib non_blank_model_without_a_slash -- --test-threads=8` | 1 |
| `cargo test --locked -p a3s-sandbox --lib missing_program_files_pwsh_names_winget -- --test-threads=8` | 1 |

36 passed, 0 failed. Those runs cover user-home ACL resolution and empty-file
replacement, the pager `/config` path, blank-model session creation and prompt,
the existing non-blank `provider/model` check, host PowerShell `PATHEXT` /
`PYTHONUTF8` / `PYTHONIOENCODING` defaults, fixed Git install fallback
including a real reparse point, and the fail-closed refusal to use Windows
PowerShell 5.1 inside the AppContainer.

## AppContainer command

```text
C:\Users\admin\.cargo\bin\cargo.exe test --locked -p a3s-sandbox --lib windows_appcontainer_named_pipe_connect_allow_deny_and_blocks_raw_egress -- --test-threads=1
```

The test finished in 11.09s with exit 0. 1 passed, 0 failed. It starts
PowerShell 7 inside an AppContainer, allows one CONNECT through the named-pipe
mediator (`pong`), refuses a CONNECT that is not on the allow list, and blocks
a raw TCP connect from the guest.

## Explicitly not claimed

- An interactive `just code` session was not created.
- No real model call succeeded.
- Windows PowerShell 5.1 was not placed inside the AppContainer.
- No Git distribution was downloaded and the user PATH was not modified.
- This run did not write an API key. `D:\code\aster\.a3s\config.acl` is absent.
  `C:\Users\admin\.a3s\config.acl` is unchanged (length 717, sha256
  `9C1439FB2FC45DB0D5133B5FB0ADD0416248264A163E9263EDDDA0EA3DD5DBB6`) and is
  byte-for-byte the first-run placeholder template.
