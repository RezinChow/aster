# Meta Harness (Aster)

Authority for overall goal wording: `.kstudio/workflow/GOALS.md` (locked 2026-11-16).

## Kernel and hosts

| Layer | Role |
| --- | --- |
| **Core / ACP** | Meta Harness **kernel** — agent loop, tools, permissions, effect, capability projection |
| **CLI (`aster`)** | First-party host / composition surface over the same kernel |
| **Studio** | First-party desktop host / composition surface over the same kernel |

Do **not** invent a second Harness product. Hosts compose the kernel; they do not fork policy.

## Three properties (near-term hard goals)

1. **可组合** — embed/host contract narratable + reproducible (PROTOCOL, capability digest, evidence).
2. **高效** — measurable (latency/token/duplicate fan-out); closing A1-class waste is in scope.
3. **可信** — daily install/use + fail-closed HITL/sandbox/hooks; %/gate green ≠ Pass.

## Wire entry

- ACP entities and queue: `crates/code/acp/PROTOCOL.md`
- Feature-stage digest on `initialize` (inventory; stage enforcement still a gap — defect P7)
- Defect catalog feeding 可信/高效 knives: `docs/evidence/code/2026-11-16-defect-mechanisms-audit/OUTCOME.md`
- Index: `.kstudio/wiki/Defect-Mechanisms.md`

## Kernel contract (narratable · HG1 slice)

Hosts (CLI · Studio) compose **one** kernel surface:

| Concern | Kernel authority | Host must not |
| --- | --- | --- |
| Agent loop / tools / task fan-out | Core (`aster-core`) | Reimplement parallel spawn policy |
| Permissions / elicitation / ask_user | ACP + Core HITL | Ignore `begin` Err / dual-ask |
| Hooks (gating) | Core HookEngine + trusted command hooks | Fail-open on gating infra errors |
| Effect / observation budgets | `aster-effect` + porcelain caps | Hash past `MAX_RECORD_BYTES` |
| Subagent identity | `task-{uuid}` + **in-flight content fingerprint** | Assume uuid-only uniqueness forever |

## Closed high knives (2026-11-16 · ≠Pass)

| ID | Evidence |
| --- | --- |
| P1 elicitation begin fail-closed | `.kstudio/evidence/T2026-11-16-p1-elicitation-begin/` |
| H5/H6 Studio toolUseId + taskType map | `.kstudio/evidence/T2026-11-17-h6-tooluseid-plumb/` |
| TUI first-token Thinking chrome | `.kstudio/evidence/T2026-11-17-tui-first-token-chrome/` |
| Hermetic +3 chrome graders (31→34) | `.kstudio/evidence/T2026-11-17-hermetic-34-tui-chrome/` |
| A5 nested task scoped deny | `.kstudio/evidence/T2026-11-17-a5-nested-task-deny/` |
| ACP streamHeadersTimeoutMs stamp | `.kstudio/evidence/T2026-11-17-headers-timeout-meta/` |
| A4 skill override report | `.kstudio/evidence/T2026-11-17-a4-skill-override-report/` |
| H7 cancel-bg honesty toast | `.kstudio/evidence/T2026-11-17-h7-cancel-bg-toast/` |
| P2 command-hook gating fail-closed | `.kstudio/evidence/T2026-11-16-p2-command-hook-gating/` |
| A1 task in-flight content fingerprint | `.kstudio/evidence/T2026-11-16-a1-task-content-fingerprint/` |
| E3 observation ≤ effect record | `.kstudio/evidence/T2026-11-16-e3-observation-byte-cap/` |
| A6 canceller keep-first / no Running zombie | `.kstudio/evidence/T2026-11-16-a6-canceller-fail-closed/` |
| P3 register_registration admission | `.kstudio/evidence/T2026-11-16-p3-hook-registration-admission/` |
| P5 inside_root canonicalize fail-closed | `.kstudio/evidence/T2026-11-16-p5-inside-root-fail-closed/` |
| H2 Studio ACP write ≠ false exit | `.kstudio/evidence/T2026-11-16-h2-studio-acp-write/` (**Studio land pending**) |
| P4 skill dir trust order | `.kstudio/evidence/T2026-11-16-p4-skill-dir-trust-order/` |
| P6 Ask without HITL provider | `.kstudio/evidence/T2026-11-16-p6-ask-without-provider/` |
| A9 BG workspace_child reserve/settle | `.kstudio/evidence/T2026-11-16-a9-bg-workspace-child-settle/` |
| E5 concurrent session/load exclusive | `.kstudio/evidence/T2026-11-16-e5-session-load-exclusive/` |
| E6 checkpoint poison recover | `.kstudio/evidence/T2026-11-16-e6-checkpoint-poison-recover/` |
| Hermetic CLI/ACP E2E pack | `.kstudio/evidence/T2026-11-16-meta-harness-hermetic-e2e/` |
| E9 bash rawOutput truncation | `.kstudio/evidence/T2026-11-16-e9-bash-rawoutput-truncated/` |
| Perf pack (emit-move · equal-meta · bash-slim · TUI widths · read_freeze) | `.kstudio/evidence/T2026-11-16-perf-e2e-pack/` |
| E4 `FileLog::read_freeze` on settle | `.kstudio/evidence/T2026-11-16-e4-filelog-read-freeze/` |
| P6 BG1 twin allow after Ask fail-closed | `.kstudio/evidence/T2026-11-16-p6-bg-settlement-twin/` |
| HG2 token + latency freeze graders | `.kstudio/evidence/T2026-11-16-hg2-token-latency-freeze/` (**≠ HG2 Pass**) |
| HG2 discard freeze grader | `.kstudio/evidence/T2026-11-16-hg2-discard-freeze/` (**≠ HG2 Pass**) |
| `json_update_sha256` Result + digest fan-out | `.kstudio/evidence/T2026-11-16-json-update-sha256/` · `.kstudio/evidence/T2026-11-16-digest-stream-fanout/` |
| Hermetic perf e2e runner (`just hermetic-perf-e2e` **260/0** · 20 ACP + **9 HG2 lib** = **29**) | `.kstudio/evidence/T2026-11-16-hermetic-perf-e2e-runner/` · `.kstudio/evidence/T2026-11-16-json-serialized-len/` |
| **HG6 kburn→Core closed (Q13)** | `.kstudio/evidence/T2026-11-17-hg6-close/` |
| E8 compaction Failed phase | `.kstudio/evidence/T2026-11-17-e8-compaction-failed-phase/` |
| E2 empty mid-file fact-log line | `.kstudio/evidence/T2026-11-17-e2-empty-line-refuse/` |
| P8 permission.denied code | `.kstudio/evidence/T2026-11-17-p8-permission-denial-code/` |
| `.aster` eng gitignore unlock | `.kstudio/evidence/T2026-11-17-aster-eng-gitignore/` |

| BlockContext Appearance Arc (HG2 hot path) | `.kstudio/evidence/T2026-11-17-blockcontext-appearance-arc/` (**≠ HG2 Pass**) |
| AppView Appearance Arc (session boundary) | `.kstudio/evidence/T2026-11-17-appview-appearance-arc/` (**≠ HG2 Pass**) |
| C1 verify stub fail-closed | `.kstudio/evidence/T2026-11-17-c1-verify-stub-fail-closed/` (**≠ OS enforcement Pass**) |
| P7 featureSwitchStages + Stable promote | `.kstudio/evidence/T2026-11-17-p7-feature-switch-stages/` |
| E4 update_plan discarded_chars | `.kstudio/evidence/T2026-11-17-e4-update-plan-discarded/` (**≠ E4 Pass**) |
| E4 BM25 query discarded_chars | `.kstudio/evidence/T2026-11-17-e4-bm25-query-discarded/` (**≠ E4 Pass**) |
| E4 generate_object stream discard | `.kstudio/evidence/T2026-11-17-e4-generate-object-stream/` (**≠ E4 Pass**) |
| unattended_e2e YOLO reconfirm | `.kstudio/evidence/T2026-11-17-unattended-e2e-yolo-reconfirm/` (33/33 · **≠ daily-use Pass**) |
| tui_913 hermetic reconfirm | `.kstudio/evidence/T2026-11-17-tui913-hermetic-reconfirm/` (11/11 · **≠ headed Pass**) |

Still open toward Meta Harness Done: Studio H2 land/push/gitlink (dirty tip already has write≠exit; needs commit/push auth), live-provider / GUI daily-use E2E; C1 still non-authority stub (verify honesty closed); headed pack expansion. Remaining catalog leftovers (A7/B1/D1/D2/F*) are intentional or host-coordinated.

≠Pass.
