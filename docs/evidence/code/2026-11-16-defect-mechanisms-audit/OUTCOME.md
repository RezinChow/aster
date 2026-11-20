# Aster defect-mechanism audit (named YOLO)

Date: 2026-11-16.  
Scope: named `/k-yolo` — **全面审计 aster 代码，分析各种缺陷机制**（例：拆分子任务不按内容去重）.  
Tip audited: workspace `main` at audit time (post CLI 0.3.9 / ACP 9.2.7 land).  
Method: source-grounded mechanism catalog (not a full line-by-line review of every crate; not product Pass).

## Taxonomy

| Class | Meaning |
| --- | --- |
| **A · Identity / dedup** | Runtime keys on id, not semantic content → duplicate work possible |
| **B · Concurrency / race** | Parallel paths omit or narrow a gate; TOCTOU / lifecycle races |
| **C · Authority / stub** | Compat surface looks like enforcement but is no-op / non-authoritative |
| **D · Wire / host seam** | Protocol dual names, optional cancel flags, host/Core mismatch risk |
| **E · Persistence / budget** | Log/session/budget boundaries (mostly fail-closed; residual gaps noted) |
| **F · Model-facing contract** | Tools removed/aliased; plan vs spawn semantics diverge |
| **H · Host surface** | CLI / terminal ACP bridge / Studio agent-plane UI & cancel |
| **P · Policy / HITL / hooks** | Permissions, elicitation wiring, sandbox posture, trust strip, hooks, skills |

Severity is **daily-use reliability** impact if the mechanism is exercised, not CVSS.

Host-surface pass: [Audit CLI/Studio host defects](9d34e324-a296-4157-bd13-8012bf42a00e) (2026-11-16).  
Effect/ACP/persist pass: [Audit effect/ACP/stdio defects](ba136c27-2a2c-41b6-9903-ad9ab82bea30) (2026-11-16).  
Policy/HITL pass: [Audit permission/sandbox defects](673f6b61-e658-4de9-be3a-976c5b934708) (2026-11-16).  
Task/subagent/schedule pass: [Audit task/subagent defects](6802c57f-a79c-41db-a437-089eb952e5b7) (2026-11-16). Citations spot-checked into this catalog.

## Findings

### A1 — Subagent / `task` spawn: no content dedup · **high** · **contract gap**

- **Mechanism:** Every `task` execution allocates `task-{uuid}`. Identical `(agent, description, prompt)` can run concurrently with no hash gate. Local `max_parallel_tasks` / fan-out ≤32 caps concurrency, not uniqueness. Auto-delegation dedups by **agent name** only (`auto_delegation.rs` ~168), then same UUID fan-out path.
- **Evidence:** `crates/code/core/src/tools/task.rs` (~617, ~1412, ~1889); `parallel_execution.rs`; host `HOST_PARALLEL_TASKS = 8`.
- **Effect:** Retries / fan-out / auto-delegation → “重复任务”; conflicting edits.
- **Contrast:** Child executors **omit** nested `task` (~961–962) — depth soft-limited; no hard nesting counter; projected/dynamic tools can reintroduce a `task`-named tool (A5).

### A2 — `update_plan`: duplicate **ids** refused; duplicate **step text** / multi-`in_progress` allowed · **med** · **partial**

- **Mechanism:** `seen_ids` rejects same `id`; content not fingerprinted; zero/many `in_progress` unconstrained. Plan exec keys by step content → duplicate prose can drive duplicate delegated work.
- **Evidence:** `update_plan.rs` ~129–153; `plan_execution.rs` uses `step.content`.

### A3 — `batch`: duplicate step ids fail closed before side effects · **low** (control) · **intentional harden**

- **Evidence:** `crates/code/core/src/tools/builtin/batch.rs` test `test_execute_rejects_duplicate_ids_before_side_effects`.
- **Note:** Shows id-dedup exists elsewhere; **not** applied to `task` descriptions.

### A4 — Skills: same name later load overrides · **med** · **intentional**

- **Mechanism:** Duplicate skill name in a directory tree: later definition wins (partial-load still loads good siblings).
- **Evidence:** `crates/code/core/src/skills/registry.rs` `load_from_dir_report`; test `test_load_from_dir_duplicate_name_overrides_previous_definition`.
- **Effect:** Silent shadowing of an earlier skill definition.

### A5 — Soft recursion stop (omit `task`); no depth counter · **med** · **intentional + gap**

- Child `ToolExecutor` omits `TaskTool`. Bypass: host `scoped_tools` / `register_dynamic_tool_if_absent` projecting a `task`-named tool onto the child.

### A6 — Cancel: canceller last-write-wins / Running without handle · **high** · **gap**

- **Mechanism:** `register_canceller` is plain `HashMap::insert`. BG may register twice (plan then child). `cancel` returns false if no token while snapshot still `Running` — ACP reports handle unavailable. `replace_snapshots` restores Running and **clears all cancellers** (documented rehydrate hazard).
- **Evidence:** `subagent_task_tracker.rs` ~120–125, ~136+, ~398–416; ACP `host_methods` cancel mapping.

### A7 — FG tasks bypass global scheduler lease · **med** · **intentional**

- **Mechanism:** Production `schedule_foreground=false`; only `background=true` (or FG with flag) takes scheduler/`for_scope` quota. FG fan-out uses local `parallel_permits` only. Single-item `task` does not take that semaphore (asymmetry vs `tasks[]`).
- **Evidence:** `task.rs` ~353/401 defaults, ~788–888; `parallel_execution.rs` permit acquire on fan-out path.

### A8 — Promoted BG ignores parent-cancelled gate · **med** · **intentional**

- If `admitted_capability_subtask` set, early `parent_cancellation` bail skipped (`task.rs` ~677–680). Aligns with D2/H7 host cancel policy.

### A9 — BG workspace_child / deferred completion hole · **high** · **mixed**

- Completion may Allow while deferred BG writers live; unreserved `execute_background` / abandon paths can leave unsettled slots. Fan-out timeout: 500ms grace then `abort_all` while children still aborting.

### A10 — ACP post-turn subagent drain can spin · **med** · **gap**

- Polls `subagent_started_ms` every 100ms until finished or session close; zombie Running (A6) keeps drain alive (`emit.rs` ~435–461). Empty prompts accepted (low).

### B1 — Parallel write fast path: data-race only; governance per-branch · **med** · **documented contract**

- **Mechanism:** `can_run_parallel_write_batch` only checks distinct `file_path` among `write`/`edit`. Comment: governance applied per branch by `ToolInvoker`; predicate must not be mistaken for a permission gate. Historical drift to unregistered names (`write_file`) silently disabled the path.
- **Evidence:** `crates/code/core/src/agent/parallel_tool_runtime.rs` ~98–135; regression narrative `crates/code/core/src/agent/tests.rs` ~5723–5812.
- **Effect:** Safe if invoker always gates; dangerous if a future fast path skips invoker again (prior bug class).

### B2 — Parallel `edit`/`write` on distinct paths still concurrent · **med** · **by design**

- **Mechanism:** Distinct paths ⇒ concurrent mutations; no workspace-wide serial write lock. Cross-file consistency (imports, renames) is model-responsibility.
- **Evidence:** same `parallel_tool_runtime.rs` path-set uniqueness check.

### B3 — Elicitation: pending id fail-closed; terminal id may reopen · **med** · **intentional**

- **Mechanism:** `permission:{session}:{tool_id}` — second **pending** same id → `DuplicateId`; after resolve, same id may begin again (multi-ask same tool). Concurrent **different** ids do not cross-deliver (tested).
- **Evidence:** `crates/code/core/src/elicitation.rs` ~52–78, tests ~142–179.
- **Effect:** Not content-dedup of asks; same tool can re-prompt after terminal.

### B4 — Hook `async_execution` cannot async-bypass gating events · **low** (control) · **intentional**

- **Evidence:** `crates/code/core/src/hooks/engine.rs` ~346–349 (comment + branch).

### C1 — `aster-confine` compatibility stub is not enforcement · **high** if misread · **intentional**

- **Mechanism:** Every apply/`verify_*` is no-op / success; docs forbid reading it as policy. Real isolation is Core `sandbox` + ksandbox; profiles/codes in `permission_profile.rs`.
- **Evidence:** `crates/terminal/crates/codegen/aster-confine/src/lib.rs` module docs L1–12, apply debug ~187; `verify_read_deny_enforced` ~152.
- **Host call sites still treat it as live config:** shell startup runs `verify_hook_write_deny_enforced` / `verify_read_deny_enforced` / `verify_data_write_deny_enforced` and `set_configured_profile` (`crates/terminal/crates/codegen/aster-shell/src/config/mod.rs` ~1479–1551); pager/CLI still read `requested_confinement_profile` / `profile_name` for UI and warnings (`aster-pager` agent_view/render, effects, diagnostics; `apps/aster/src/main.rs`). Hooks runner calls `aster_confine::child_net::restrict_child_network` (empty body).
- **Effect:** Startup “verification” of read/hook/data deny **always succeeds** on the stub → false confidence unless Core ksandbox path is actually enforcing.

### C2 — Permission-profile intersect fails closed on empty mediated allowlist · **low** (control)

- **Evidence:** `crates/code/core/src/sandbox/permission_profile.rs` L5, ~161–177.

### D1 — ACP `__aster/execution/observe` double-underscore seam · **med** · **known seam**

- **Mechanism:** Method already named `_aster/…` in Rust → wire `__aster/…`. Studio accepts both; change needs coordinated host.
- **Evidence:** `crates/code/acp/PROTOCOL.md` L32; release notes Known limits.

### D2 — `session/cancel` cancels subagents by default; overridable · **med** · **intentional**

- **Mechanism:** `_meta.cancelSubagents` defaults **true**. Host that sets false leaves children running after turn cancel.
- **Evidence:** `crates/code/acp/src/agent/protocol.rs` ~845–855.
- **Effect:** Orphaned background work / continuing edits if host opts out and does not cancel later.

### D3 — Session turn queue vs Core lanes · **low** (confusion risk)

- **Mechanism:** Hosts must not depend on Core `SessionLane` names; only session turn queue is on the wire.
- **Evidence:** `PROTOCOL.md` § Queue semantics.

### E1 — Effect log: mid-file oversized/corrupt refuses whole read · **high** (ops) · **intentional**

- **Mechanism:** No skip-and-continue past a bad/oversized JSONL line; resume/append blocked until repair.
- **Evidence:** `crates/effect/src/log.rs` ~261–274; `MAX_RECORD_BYTES` = 12 MiB (~159).
- **Doc drift (closed 2026-11-17):** absorption wiki §P0-2 now matches code at **12 MiB** (`MAX_RECORD_BYTES`).

### E2 — Empty-line silent skip vs “never skip” wording · **med** · **gap**

- **Mechanism:** `text.lines().filter(|line| !line.is_empty())` drops blanks; damaged logs with blank separators can still parse as contiguous seq.
- **Evidence:** `crates/effect/src/log.rs` ~261.

### E3 — Observation budget ≫ effect record budget · **high** · **gap**

- **Mechanism:** Porcelain `OBSERVATION_BYTE_CAP` = 64 MiB; effect `MAX_RECORD_BYTES` = 12 MiB. Large receipt/tool.result can be built then refused at append.
- **Evidence:** `crates/code/core/src/porcelain.rs` ~794; `crates/effect/src/log.rs` ~159; also called out in P0-2 OUTCOME.

### E4 — `byte_budget` vocabulary not on hot paths · **med** · **gap**

- **Mechanism:** `shared_byte_budgets()` / `discarded_bytes` only referenced from `byte_budget` tests; production still uses separate tool capture / effect / observation ceilings.
- **Evidence:** `crates/code/core/src/byte_budget.rs` (callers: tests only per `rg`); pairs with E3. `FileLog::freeze` similarly unwired in Core.

### E5 — Concurrent `load_session` loses load guard · **high** · **gap**

- **Mechanism:** Second `InflightSessionLoads::begin` for same id returns empty guard (`loads: None`); no wait coupling to the first load. `wait` soft-returns after 20s.
- **Evidence:** `crates/code/acp/src/agent.rs` ~177–214.

### E6 — Checkpoint mutations via `lock().ok()` · **high** · **gap**

- **Mechanism:** Contended mutex → empty default mutations into checkpoint; resume completion gate can miss landed mutations.
- **Evidence:** `crates/code/core/src/fact_control/executor_tools.rs` ~111–119 (comment acknowledges resume risk).

### E7 — Session close timeouts warn-and-continue · **med–high** · **intentional non-hang / residual gap**

- Memory/queue/original-release drains can time out with warn; close finishes while work unproved (`session_close.rs`).

### E8 — Compaction ledger: no Failed phase; soft post-target · **med** · **gap**

- Phases Open/Started/Completed only; mid-flight attach fail leaves Started without Completed. `tokens_after > target` only traced (`target_exceeded`), compact still Ok. Ledger estimates not on ACP wire.

### E9 — Bash ACP `rawOutput` hard-codes `"truncated": false` · **med** · **gap**

- **Evidence:** `crates/code/acp/src/agent/tool_render.rs` ~174, ~275. Hosts cannot see Core capture truncation via rawOutput. Sandbox/edit/patch codes stay ACP-only (not effect facts).

### E10 — Background pending cap drops arrivals · **med** · **intentional truncate**

- Beyond `BACKGROUND_PENDING_CAP`, new mid-step background lines discarded (`effect` coding).

### F1 — Model-visible `parallel_task` removed (`HARNESS-CONV4`); fan-out via `task` · **med** · **intentional**

- **Evidence:** `crates/code/core/src/tools/builtin/mod.rs` ~175, ~342–343.
- **Effect:** Models that still emit `parallel_task` fail tool lookup; correct path is multiple `task` calls → amplifies **A1** if the model retries.

### F2 — Implementer worker: no recursive task spawn; parent still fans out · **med** · **intentional**

- **Evidence:** `crates/code/core/src/subagent.rs` WorkerAgentKind::Implementer docs ~143; child ToolExecutor omits task tools (`task.rs` ~961).

### G · Release / ops residuals (not Core logic bugs, still daily-use)

| Item | Note |
| --- | --- |
| `macos-bins` 180m GHA timeout | Hit on 0.3.9 first release pass; mitigated by `rerun --failed` | `release-aster-cli.yml` timeout-minutes: 180 |
| Studio gitlink not synced to CLI tip | Desktop may lag CLI/ACP mechanisms | release OUTCOME Explicitly not claimed |
| `shipped_tui_e2e` residual flakes | Suite-level ≠ product Pass | prior campaign OUTCOMEs |
| win-gates not re-run for 0.3.9 tip | Cross-platform gate debt | RELEASE_9.2.7 Known limits |

### H1 — Terminal host: transient stdio wrapped (WouldBlock) · **high historical / mitigated** · **intentional fix**

- **Mechanism:** ACP SDK maps raw `io::Error` → fatal `-32603`. Terminal applies `RetryTransient*` wrappers on shell/pager bridges.
- **Evidence:** `crates/terminal/crates/codegen/aster-acp-lib/src/transient_io.rs`; shell/pager leader bridges.
- **Residual:** Hosts that skip the wrapper still tear down on backpressure.

### H2 — Studio ACP write error → false “process exited” · **high** · **gap vs terminal**

- **Mechanism:** Any `stdin.write_all`/`flush` failure calls `exit_message()` → `exited=true` / `ACP_PROCESS_EXITED`, even if the child may still be alive. Permission wait treats client exit as terminal (`PermissionWait::Died`).
- **Evidence:** `apps/studio/src-tauri/src/agent_plane/acp.rs` ~305–332 (`exit_message`); wait path `turns.rs` ~4006+.
- **Effect:** Transient pipe pressure or brief write fail can look like ACP death and abort the turn — Studio lacks terminal’s `RetryTransient*` classification on this custom NDJSON client.

### H3 — CLI stdio bridge drops outbound after ~300s reconnect · **med** · **intentional fail-soft**

- **Evidence:** `apps/aster/src/main.rs` ~1223–1236.
- **Effect:** Silent loss of ACP client lines under long disconnect; not whole-process suicide.

### H4 — Pair updater channel label vs install pointer · **med** · **mostly intentional**

- **Mechanism:** Install/status fetch uses `aster-cli-stable` (or pinned version); status UI may label `alpha`/`stable` from version vs cached pointer. Alpha-labeled builds still pull stable pointer.
- **Evidence:** `apps/aster/src/cli_pair_update.rs` ~230–247, ~444–455.

### H5 — Studio subagent UI duplicate rows (footer vs board) · **med** · **residual gap**

- **Mechanism:** Footer lists Agent/Task tool parts without `toolCallId` dedupe against the background board. Board hides a row only when `toolUseId` matches a tool part in the **current message scope**.
- **Evidence:** renderer `MessagePartsRenderer` / `AgentSessionBackgroundTasks`; projection merge in `agentRightPaneProjection`.
- **Feeds H6.**

### H6 — Studio `background_task_event` omits `toolUseId` · **med** · **gap**

- **Mechanism:** Maps `subagent_*` → `{taskId,status,…}` without copying a tool-call id, so board↔message dedup often cannot bind.
- **Evidence:** `apps/studio/src-tauri/src/agent_plane/stream.rs` `background_task_event` ~878–928.
- **Effect:** Same subagent can appear twice in UI (amplifies user-visible “重复任务” even when Core A1 did not double-spawn).

### H7 — Stop vs background children · **med** · **intentional policy / expectation gap**

- **Mechanism:** ACP `cancelSubagents` defaults true, but Studio/shell `kill_background_tasks` often stays false; shared background bash/tasks can survive Stop. Subagents inherit parent backends so work may continue after child session end.
- **Evidence:** shell cancel options / `CancelOptions`; Studio `runtime_client` cancel body often `{sessionId}` only. Aligns with Core **D2**.
- **Send-now** path intentionally leaves children running.

### H8 — Studio permission: abort clears approvals; unbound respond scans turns · **med**

- **Evidence:** `turns.rs` abort clears oneshots; bound HTTP requires `ApprovalBinding`; unbound `respond_approval(id)` can scan live turns.
- Auto-deny when `!mirror && stream.capture().is_none()`; 1800s wait expiry → deny + cancel (intentional fail-closed).

### H9 — TUI permission queue drain on turn end / YOLO · **low–med** · **intentional**

- Entire `permission_queue` cancelled without per-item UI (`aster-pager` dispatch/permissions).

### P1 — ACP permission `begin` error ignored · **high** · **gap**

- **Mechanism:** `elicitation::begin` fails closed on duplicate pending id, but `request_tool_permission` does `let _ = begin(...)` then still calls `client.request_permission`. Concurrent same `session`+`tool_id` asks both proceed; ledger no longer uniquely owns HITL.
- **Evidence:** `crates/code/acp/src/agent/permission_ask.rs` ~291–297; `elicitation.rs` ~57–68. Same pattern in `ask_user.rs` ~93.

### P2 — Command-hook gating failures fail open · **high** · **gap**

- **Mechanism:** Trusted command hooks on spawn fail / timeout / non-exit-2 return `Continue(None)`. In-process gating handler failure Blocks. Asymmetric vs in-process contract.
- **Evidence:** `crates/code/core/src/hooks/command.rs` ~556–612.

### P3 — Hook `Allow` / `register_registration` can skip HITL or admission · **high** · **mixed**

- **Mechanism:** On Confirm, `PermissionHookDecision::Allow` executes without host HITL (intentional for managed engines; gap if untrusted hooks admitted). `register()` forces Managed label; `register_registration` inserts **without** `admission.admits` (~147–160).
- **Evidence:** `tool_invoker.rs` / `hook_runtime.rs`; `hooks/engine.rs` ~96–160.

### P4 — Skill dirs sorted alphabetically → last-wins / trust inversion · **high** · **gap**

- **Mechanism:** `interactive_skill_dirs_under` `dirs.sort()`; duplicate names override. Home vs workspace precedence is lexicographic, not trust-ordered. Auto-loads `.claude`/`.codex` trees under workspace and `$HOME`.
- **Evidence:** `crates/code/acp/src/agent.rs` ~446–479; `skills/registry.rs` override behavior.

### P5 — Untrusted `inside_root` fail-open when canonicalize fails · **high** · **gap**

- **Mechanism:** Symlink that doesn’t resolve yet → lexical `starts_with(root)`; later swap can escape after skill/agent dir admission.
- **Evidence:** `crates/code/core/src/config/workspace_trust.rs` ~356–371.

### P6 — Fact-path Ask without confirmation provider · **high** · **gap**

- **Mechanism:** When Ask + `needs_confirmation == false` + no provider, `unconfirmed_ask` stays false so `confirmation_required` arm may not fire; tool-invoker path denies — dual-path inconsistency.
- **Evidence:** `fact_control/receipts.rs` ~273–306 vs `tool_invoker.rs` ~281–287.

### P7 — Feature-stage digest without stage enforcement · **med** · **gap**

- Registry + ACP initialize digest only; Experimental switches still live; `resolve_feature_switch` unused as runtime gate.

### P8 — Permission denials text-shaped on ACP (vs sandbox codes) · **med** · **gap**

- Sandbox gets `sandbox.violation.*` in rawOutput; permission often reason string / `metadata: None`.

### P9 — Intentional no-HITL postures · **med** · **product**

- Unattended auto-approves ACP asks; Force/YOLO collapses High risk; learned allow-always for bash; `ASTER_PERMISSION_ASK_TIMEOUT_SECS=0` → indefinite park; default hook admission `managed_only: false`.

### P10 — Process-host / unavailable sandbox + YOLO override · **med–high if opt-in** · **intentional**

- Process-host: no path/network mediation. Unavailable native sandbox still allows host override under YOLO.

## Causal map (example → class)

```
model splits work / retries
        │
        ▼
   task tool (A1) ──uuid──► N independent children (cap 8 parallel)
        │
        ├── edit/write parallel (B1/B2) on distinct paths
        ├── elicitation HITL (B3/P1) — begin error may be dropped
        ├── hooks Allow / cmd fail-open (P2/P3)
        ├── cancel turn (D2/H7) may leave bg children
        └── Studio UI (H5/H6) may double-show one child
```

## Recommended next knives (not done by this audit)

1. **Content/fingerprint admission for `task`** (optional): refuse or coalesce identical running `(agent, description_hash, workspace)` — product decision; today id-only is contract.
2. **Host UX:** surface “N tasks with same description” warning; default keep `cancelSubagents=true`.
3. **Confine stub:** audit remaining call sites that treat `aster-confine` as live policy.
4. **Raise or shard `macos-bins` timeout** to avoid 3h cancel on cold cache.
5. **Studio land** to consume 9.2.7 wire codes / elicitation / featureSwitch digest.
6. **Studio ACP client:** classify transient write errors like terminal `RetryTransient*` (H2) instead of `exit_message`.
7. **Studio subagent projection:** plumb `toolUseId` on `background_task_event` and dedupe footer vs board (H5/H6).
8. **Align observation vs effect byte caps** (E3) and wire `shared_byte_budgets` / `freeze` on hot paths (E4).
9. **Harden concurrent `session/load`** (E5) and checkpoint `lock().ok()` (E6).
10. **Propagate bash truncation + violation codes** into rawOutput/effect (E9); compaction Failed phase (E8).
11. **Fix wiki MAX_RECORD_BYTES 4→12 MiB** drift (E1 doc) — done in wiki.
12. **Honor `elicitation::begin` Err** in ACP permission/ask_user (P1) — fail closed, don’t dual-HITL.
13. **Command-hook gating fail-closed** on spawn/timeout (P2); `register_registration` must admit (P3).
14. **Skill dir load order by trust** (not `sort()` last-wins) (P4); refuse `inside_root` on canonicalize Err (P5).
15. **Align fact-path Ask** with tool-invoker confirmation_required (P6).
16. **Task content fingerprint** + refuse empty prompt (A1/A10); hard nesting deny for projected `task` (A5).
17. **Canceller generation / refuse double-register**; never rehydrate Running without token (A6); TTL on ACP subagent drain (A10).
18. **Settle/reserve workspace_child** on all BG launch paths (A9).

## Explicitly not claimed

- That every Aster crate and every Studio submodule file was line-audited.
- That fixing A1 (or any finding) is implemented in this tip.
- Product Pass / “日常稳定使用” solely from this catalog (%≠Pass).
- Completeness of security review / adversarial proof.

## Verification commands (repro pointers)

```bash
rg -n 'task-\{\}|Uuid::new_v4' crates/code/core/src/tools/task.rs
rg -n 'seen_ids|duplicated' crates/code/core/src/tools/builtin/update_plan.rs
rg -n 'can_run_parallel_write_batch|is_parallel_safe_write' crates/code/core/src/agent/parallel_tool_runtime.rs
rg -n 'not an execution authority|no-op' crates/terminal/crates/codegen/aster-confine/src/lib.rs
rg -n 'cancelSubagents|__aster/execution/observe' crates/code/acp
```

## Short report

```text
阶段：defect-mechanisms-audit
命名YOLO：全面审计缺陷机制 — Done（目录+证据，≠产品Pass）
锚点例：A1 task 不按内容去重（uuid）
类：A task（无内容去重；canceller/Running 僵尸；FG 绕过 scheduler；BG settle）+ E/H/P …
证据：docs/evidence/code/2026-11-16-defect-mechanisms-audit/OUTCOME.md
下一步刀：A1 fingerprint · A6 canceller · P1 begin · H2 Studio IO · E3 byte cap
```




