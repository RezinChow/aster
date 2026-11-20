# Perf YOLO + hermetic E2E pack (Core · ACP · TUI)

Date: 2026-11-16.  
Branch: `main` @ dirty.  
Named YOLO: 极致优化 core/acp/tui + 全面端到端测试.

## Hermetic E2E (this turn)

| Suite | Filter / note | Result |
| --- | --- | --- |
| `aster-acp` `tui_913_hermetic` | **full** (paired `ASTER_TUI_BIN`/`ASTER_ACP_BIN` after `just build`) | **11 passed; 0 failed** (~7.23s) |
| `aster-acp` `tui_913_hermetic` | `three_turns_fix_the_bug_they_diagnosed` | **ok** |
| `aster-acp` `tui_913_hermetic` | `long_task_repairs_the_check_after_a_failure` | **ok** |
| `aster-acp` `tui_913_hermetic` | `model_command_selects_the_catalog_model` | **ok** (effort-less settle) |
| `aster-acp` `tui_913_hermetic` | `core_catalog_history_reaches_the_backend_instead_of_prompt_search` | **ok** (empty-body tolerant) |
| `aster-acp` `tui_913_hermetic` | `shipped_binaries_report_current_version` | **ok** (pair BUILD_ID `86ee8f6d…`) |
| `aster-acp` `acp_conformance_stdio` | full ACP v1 suite | **15 passed** |
| `aster-acp` `long_horizon_contracts` | full | **75 passed**, 3 ignored |
| `aster-acp` `long_horizon_rust_stdio` | full | **68 passed**, 7 ignored |
| `aster-acp` `long_horizon_preflight` | full | **3 passed**, 3 ignored |
| `aster-acp` `unattended_e2e` | `convergence` | **2 passed** |
| `aster-acp` `unattended_e2e` | **full** | **33 passed; 0 failed** |
| `aster-pager` | `streaming_chunks_extend_line_widths_*` | **ok** (prior) |
| `aster-shell` | `equal_aster_generation_delta_meta_merges_consecutive_chunks` | **ok** |
| `aster-tools` | `slim_streaming_bash_delta_deserializes_with_field_defaults` | **ok** |
| `aster-acp` `boundary_e2e` | 8/9 (e_list…t_ask) | **8 passed**; `e_bash` failed (completion gate — seatbelt denial not observed on this host) |

### Residual fixes landed in harness

- `submit_model`: short effort-picker poll; skip when catalog has no `reasoningEfforts`.
- `wait_for_model_status`: settle on `Default model:` or status-line `tok/s … {model}` (confirmation may scroll away).
- `/history` mock body assert: ignore empty / non-JSON frames.
- Pair BUILD_ID: compile tests → `just build` → run with env bins (cargo test alone can rebuild ACP and break the pair).

## Perf knives closed this named YOLO

See Chronicle · `T2026-11-16-{a10,a2,acp-emit,core-key-mint,e4-discarded,bash-delta-coalesce,stream-alloc-s123,tui-stream-line-widths,acp-emit-move,shell-equal-meta-merge,bash-delta-slim,e4-filelog-read-freeze,merge-stream-owned,p6-bg-settlement-twin,acp-delta-move-toolcallid,e4-yielded-compaction-freeze,acp-id-arcstr,tui-single-field-widths}`.

### Follow-up knives this cycle (verified)

| Knife | Result |
| --- | --- |
| `turn.yielded` + compaction `read_freeze` | bg_subagent 5 · compact source_guard 4 · conformance 15 |
| ACP `ToolCallId`/`SessionId` `&str`→`Arc<str>` | permission_ask HITL ok · conformance 15 |
| TUI single-field estimate borrow | pager 3 focused ok |
| Re-paired hermetic pack after `just build` | tui_913 **11/11** · unattended **33** · LH **75/68** · conformance **15** |
| SSE blank-CR hold + recheck | `streaming_split_cr` ok (was HEAD-red); tui_913 **11/11** again; conformance **15** |
| receipt `deserialize(&Value)` | checkpoint ordinary ok; bg_subagent 5 |
| tool-end output take | tool_completion 26 |
| stream finalize take | openai tests 54; tui_913 one_turn smoke |
| TUI widths expanded (web/search/use/edit/…) | pager estimate_line_widths_borrows 2 |
| stream tool-args take | **reverted** (finalize needs entry.2); three_turns re-green |
| Post-revert hermetic | tui_913 **11/11** · conformance **15** · unattended (see log) |
| HG2 token+latency graders + TUI/SessionEvent borrow + fact deserialize-2 | see `T2026-11-16-hg2-token-latency-freeze` · `fact-deserialize-borrow-2` |
| Re-paired hermetic after that slice (`just build` + env bins) | tui_913 **11/11** · conformance **15** · LH **75/68** · unattended **33** (serial; one parallel flake on `one_external_edit…` then ok) |

## Explicitly not claimed

- Product Pass / Meta Harness Done / named YOLO Done.
- Studio headed / agent-desktop GUI E2E (needs fresh `just build-studio` + auth).
- Live-provider probes (ignored / parked).
- Full E4 Done across every tool surface.
- `boundary_e2e::e_bash` seatbelt denial on this host (file absent / exit 71 not observed; gate error instead).
