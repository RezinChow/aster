# Defect mechanisms (Aster)

Audit catalog (2026-11-16 named YOLO). Full evidence:
`docs/evidence/code/2026-11-16-defect-mechanisms-audit/OUTCOME.md`.

## Headline

Runtime often keys on **identity** (uuid / tool_id / plan step id), not **semantic
content**. That is why splitting work can show **duplicate tasks**.

## Index

| ID | One-liner | Sev |
| --- | --- | --- |
| A1 | `task` in-flight content fingerprint (**closed** · T2026-11-16-a1-task-content-fingerprint) | high |
| A2 | `update_plan` content+id dedup; ≤1 in_progress (**closed** · T2026-11-16-a2-plan-content-dedup) | med |
| A3 | `batch` rejects duplicate ids (good contrast) | low |
| A4 | Skill same-name override enumerable on load report (**closed honesty** · T2026-11-17-a4-skill-override-report; later-wins unchanged) | med |
| A5 | Nested `task` via scoped_tools hard-deny (**closed** · T2026-11-17-a5-nested-task-deny) | med |
| A6 | Canceller keep-first + demote Running on rehydrate (**closed** · T2026-11-16-a6-canceller-fail-closed) | high |
| A7 | FG `task` skips **global** scheduler lease (**by design** · inherits parent run lease; host FG uses `schedule_foreground` · T2026-11-17-a7-fg-lease-honesty) | med |
| A9 | BG raw launch reserve/settle (**closed** · T2026-11-16-a9-bg-workspace-child-settle; yield contract untouched) | high |
| A10 | ACP post-turn subagent drain TTL 30s (**closed** · T2026-11-16-a10-drain-ttl) | med |
| B1 | Parallel write fast path = path race check only (**documented contract** · T2026-11-17-b1-b2-write-parallel-honesty) | med |
| B2 | Distinct-path concurrent edits (**by design** · T2026-11-17-b1-b2-write-parallel-honesty) | med |
| B3 | Elicitation pending-id fail-closed; terminal reopen OK | med |
| C1 | `aster-confine` stub (intentional non-authority; `verify_*` now **fail-closed** · T2026-11-17-c1-verify-stub-fail-closed; still ≠ OS enforcement Pass) | high |
| D1 | `__aster/execution/observe` seam (**known** · T2026-11-17-d1-d2-f2-honesty; rename needs Studio) | med |
| D2 | `cancelSubagents` default true, host can disable (**intentional** · T2026-11-17-d1-d2-f2-honesty) | med |
| F1 | `parallel_task` removed; fan-out via `task` (feeds A1) | med |
| F2 | Child omits nested `task`; parent still fans out (**intentional** · T2026-11-17-d1-d2-f2-honesty) | med |
| H2 | Studio ACP write ≠ false exit (**code** · T2026-11-16-h2-studio-acp-write; land pending) | high |
| H5/H6 | Studio board↔tool dedupe via `toolUseId` (**closed** · T2026-11-17-h6-tooluseid-plumb; H5 board hide relies on H6) | med |
| H7 | Stop may leave shared background tasks (**honesty toast** · T2026-11-17-h7-cancel-bg-toast; policy unchanged) | med |
| E2 | Empty mid-file fact-log line fail-closed (**closed** · T2026-11-17-e2-empty-line-refuse) | med |
| E3 | Observation cap ≤ effect record (**closed** · T2026-11-16-e3-observation-byte-cap) | high |
| E4 | `byte_budget` / `freeze` (**partial** · bash · git · web_fetch · **web_search** · **grep** · bg · task · batch · program · page · artifact · search · read/read-batch · snippet · bm25(+query echo) · `read_freeze` · **update_plan** · **generate_object** stream · T2026-11-16-*-discarded · T2026-11-17-e4-update-plan-discarded · T2026-11-17-e4-bm25-query-discarded · T2026-11-17-e4-generate-object-stream) | med |
| E5 | Concurrent `session/load` exclusive begin (**closed** · T2026-11-16-e5-session-load-exclusive) | high |
| E6 | Checkpoint poison recover (**closed** · T2026-11-16-e6-checkpoint-poison-recover) | high |
| E8 | Compaction ledger Failed phase (**closed** · T2026-11-17-e8-compaction-failed-phase) | med |
| E9 | Bash rawOutput carries truncation (**closed** · T2026-11-16-e9-bash-rawoutput-truncated) | med |
| P1 | ACP elicitation `begin` fail-closed (**closed** · T2026-11-16-p1-elicitation-begin) | high |
| P2 | Command-hook gating fail-closed (**closed** · T2026-11-16-p2-command-hook-gating) | high |
| P3 | `register_registration` admits source (**closed** · T2026-11-16-p3-hook-registration-admission) | high |
| P4 | Skill dirs trust order home→configured→project (**closed** · T2026-11-16-p4-skill-dir-trust-order) | high |
| P5 | `inside_root` fail-closed on canonicalize Err (**closed** · T2026-11-16-p5-inside-root-fail-closed) | high |
| P6 | Ask without HITL provider → confirmation_required (**closed** · T2026-11-16-p6-ask-without-provider) | high |
| P7 | Feature-switch `Removed` fail-closed + stage map + Experimental call-site refuse (**closed** · T2026-11-17-p7-feature-switch-enabled · T2026-11-17-p7-feature-switch-stages · T2026-11-17-p7-experimental-call-site) | med |
| P8 | Permission denial stable `permission.denied` code (**closed** · T2026-11-17-p8-permission-denial-code) | med |

Host + effect/ACP + policy/HITL passes folded in. ≠Pass. Fixing is a separate knife.