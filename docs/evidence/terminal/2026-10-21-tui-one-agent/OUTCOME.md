# TUI one-agent connect

A default interactive `aster` session and a `--leader` session both spawn one `a3s-code-acp` child. The prompt model is the ACL `default_model`. TOML theme and key settings are not passed as `--model`. The command tool name on both of those sessions is `bash`. Neither session constructs the in-process shell agent. `aster agent serve` still constructs that agent after an authenticated WebSocket client connects. A missing `a3s-code-acp` sibling, with `A3S_ACP_AGENT_BIN` unset, fails startup and names `a3s-code-acp`. `should_check_for_updates` still returns false.

`aster agent leader` still constructs the in-process shell agent. The shell crate stays linked because config, login, sessions, and serve still use it.

## Commands and counts

Rust 1.97.1, macOS, debug test profile. The hermetic command was:

```
cargo test -p aster --test tui_one_agent --offline --locked -- --nocapture --test-threads=1
```

The first invocation exited 101 at compile time with `E0502` in `apps/aster/tests/tui_one_agent.rs` and did not run the shipped binary. The borrow was fixed without changing the product path. The same command then passed twice. Each log contains:

```
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 40.45s
```

and

```
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 25.17s
```

The recorded exits are `RUN 1 exit=0` and `RUN 2 exit=0`. Both runs printed:

- `CAPTURE auto-update off autoUpdate=false updateAvailable=false`
- `CAPTURE missing companion failed closed and named a3s-code-acp while A3S_ACP_AGENT_BIN was unset`
- `CAPTURE default spawned the ACP companion command_tool=bash model=fixture/from-acl and did not construct the in-process shell agent`
- `CAPTURE prompt model from ACL fixture/from-acl; TOML theme and vim_mode did not select toml/not-this`
- `CAPTURE leader spawned the ACP companion command_tool=bash model=fixture/from-acl and did not construct the in-process shell agent`
- `CAPTURE serve constructed in-process shell agent`

The macOS native-refusal text no longer tells the model to skip the process tool while the reason remains. A later request may invoke that tool once. The same refusal is returned and the command does not start. The hermetic check, with `rustc 1.97.1 (8bab26f4f 2026-07-14)`, was:

```
cargo test -p a3s-code-core --lib guest_discovery_detail_reaches_both_native_apis_without_changing_policy --offline --locked -- --test-threads=1 --nocapture
```

```
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 5274 filtered out; finished in 0.01s
```

The live pin is `boyue/deepseek-v4-flash`. `./.a3s/config.acl` and `~/.a3s/config.acl` both keep `default_model = "gateway/prism-27b"`. The runs used a mode-600 temporary copy of `./.a3s/config.acl` that changed only `default_model` to `boyue/deepseek-v4-flash`. The copy was deleted after the runs. Neither source file was modified. The provider was not stubbed.

The live gate, with `rustc 1.97.1 (8bab26f4f 2026-07-14)`, was:

```
cargo test -p a3s-code-acp --test tui_913_real_llm --offline --locked -- --ignored --test-threads=1 --nocapture
```

The log quotes:

```
test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 13 filtered out; finished in 293.53s
```

```
REAL_LLM_EXIT=0
```

`real_llm_tui_turn_shows_assistant_text` printed `ORACLE case=real-llm assistant=I'm ready to help with your coding task.` The ten-turn refusal recovery printed `ORACLE case=tui-ten-turn-refusal-recovery turns=10 distinct_runs=10 bash_denied=5 reads_succeeded=5 unknown=0 prompt_tokens=345442`.

The one-turn test was run again:

```
cargo test -p a3s-code-acp --test tui_913_real_llm --offline --locked -- --ignored --test-threads=1 --nocapture --exact real_llm_tui_turn_shows_assistant_text
```

The second log quotes:

```
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 22 filtered out; finished in 12.57s
```

```
TURN2_EXIT=0
```

That run printed `ORACLE case=real-llm assistant=Acknowledged; no tools called.` Both live logs had zero occurrences of `api_key`, `base_url`, `sk-`, and `Bearer `.

## Explicitly not claimed

`aster agent serve` and `aster agent leader` still use the in-process shell agent. The shell crate is still linked. Background auto-update stays off. No `/update` slash command was added. No ACL or TOML key was added. `apps/cloud` was not edited, including its copy of the native-refusal text. No release was published. `shipped_bound_goal_real_llm` and the core real-LLM suites were not this gate. The unfiltered workspace `cargo test --offline --locked` was not run. The recorded cargo commands used a fresh target directory because `target/debug/deps` stalls `rustc`, and another `just code` held `target/debug/.cargo-lock`. `./.a3s/config.acl` and the operator ACL were not edited. The live driver set `A3S_ACP_AGENT_BIN`, so that run did not execute the unset-env pair-identity check. The provider was not stubbed, and the pin was not switched to `deepseek/deepseek-flash` or `gateway/prism-27b`.
