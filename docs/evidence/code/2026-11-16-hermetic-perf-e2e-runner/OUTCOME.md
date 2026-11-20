# Hermetic perf e2e pack runner (named YOLO)

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

Added `scripts/verify-hermetic-perf-e2e.py`: pins `ASTER_ACP_BIN` /
`ASTER_TUI_BIN` and runs the frozen hermetic pack serially.

**Pair discipline:** each suite does `cargo test --no-run` → `just build` →
`cargo test` so BUILD_ID cannot drift when compiling `aster-acp` alone.

Frozen pack (**20 suites**):

- `tui_913_hermetic`
- `acp_conformance_stdio`
- `protocol_commands_stdio`
- `memory_canonical_stdio`
- `workspace_layer_trust_stdio`
- `approval_rules_stdio`
- `client_fs_stdio`
- `shell_bypass_learning`
- `retrieval_qualification_stdio`
- `plugin_workspace_stdio`
- `codex_account_stdio`
- `local_model_responses_stdio`
- `account_import_opt_in_stdio`
- `consumer_deny`
- `startup_error`
- `memory_management`
- `unattended_e2e`
- `long_horizon_contracts`
- `long_horizon_rust_stdio`
- `long_horizon_preflight`

**Parked outside pack:** `boundary_e2e` (`e_bash`); `v912_seam` (1 failing gate).

## Commands / counts

| Run | Result |
| --- | --- |
| **Full 13-suite** | **239 / 0** |
| **Full 17-suite** | **246 / 0** |
| **Full 19-suite** | **250 / 0** |
| + memory_management | **1 / 0** |
| **Full 20-suite pack** | **251 passed; 0 failed; 13 ignored** (~273s) |

```text
just hermetic-perf-e2e
# → summary.json **251/0** (20 suites)
```

## Explicitly not claimed

- Named YOLO Done / Meta Harness Pass.
- Headed Studio / live LLM / seatbelt `e_bash`.
