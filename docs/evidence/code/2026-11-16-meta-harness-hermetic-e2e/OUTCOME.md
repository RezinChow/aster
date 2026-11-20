# Meta Harness hermetic E2E pack (CLI · ACP)

Date: 2026-11-16.  
Branch: `main`.  
Goal knife: Meta Harness **可信（日常 + 证据）** — hermetic wire/long-horizon foundation (no Studio GUI).

## Commands and results

| Suite | Filter / note | Result |
| --- | --- | --- |
| `aster-acp` `tui_913_hermetic` | `three_turns_fix_the_bug_they_diagnosed` | **ok** (~4.0s) |
| `aster-acp` `tui_913_hermetic` | `long_task_repairs_the_check_after_a_failure` | **ok** (~2.9s) |
| `aster-acp` `acp_conformance_stdio` | `fragmented_utf8_session_new_survives_outbound_interleave` | **ok** (~5.3s) |
| `aster-acp` `long_horizon_contracts` | full | **75 passed**, 3 ignored |
| `aster-acp` `long_horizon_preflight` | full | **3 passed**, 3 ignored (provider probes) |
| `aster-acp` `long_horizon_rust_stdio` | full | **68 passed**, 7 ignored |
| `aster-acp` `unattended_e2e` | `convergence` | **2 passed** |

Also closed same wave (optimization): E5 exclusive `session/load`, E6 checkpoint poison recover — evidence under `.kstudio/evidence/T2026-11-16-e5-*` / `e6-*`.

## Explicitly not claimed

- Product Pass / Meta Harness Done / “日常稳定使用” solely from hermetic suites.
- Studio GUI / agent-desktop E2E; Studio H2 land/push/gitlink.
- Ignored real-provider probes (`live_interactive`, preflight health).
- macOS PTY `shipped_tui_e2e` soak (not run in this pack).
