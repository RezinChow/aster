# Codex mechanism candidates（B scan · ≠ feature parity）

Source: `/tmp/openai-codex` @ `5cb38e79842a0e0a6dca5bb97874163e8ee50129`  
Criterion: engineering merit (reliability / safety / observability / recoverability / policy / protocol / harness) — **not** “Codex has feature X.”

Complexity: **S** small · **M** medium · **L** large

---

## Top 12

### 1. Append-only rollout + reverse JSONL resume — **L**

| | |
| --- | --- |
| **Codex** | `codex-rs/rollout/` — `recorder.rs`, `reverse_jsonl_scanner.rs`, `seekable_reader.rs`, `policy.rs`, `writer_lock.rs`, `state_db.rs`, `persistence_metrics.rs`, `compression/`, `lib.rs` (`decode_rollout_line`) |
| **Why excellent** | Session truth is append-only JSONL; reverse scanner rejects bad lines, skips oversized records, freezes at byte offset; writer lock + metrics. Resume/replay without mutable session blob. |
| **Parity-independent** | Durable event-log + resume indexing; no Codex UI/tools required. |

### 2. Execpolicy with load-time `match` / `not_match` — **M**

| | |
| --- | --- |
| **Codex** | `codex-rs/execpolicy/` — `README.md`, `src/parser.rs`, `src/rule.rs` (`validate_match_examples`, `validate_not_match_examples`), `src/policy.rs`, `examples/example.codexpolicy` |
| **Why excellent** | Policy files carry their own unit tests; invalid examples fail at load. Prefix rules + strictest-decision merge + CLI `check` = auditable policy harness. |
| **Parity-independent** | Pure DSL + evaluator. |

### 3. SQ/EQ Session · Task · Turn protocol model — **M** (wire migration **L**)

| | |
| --- | --- |
| **Codex** | `codex-rs/docs/protocol_v1.md`; `codex-rs/protocol/src/protocol.rs` (`Op`, `EventMsg`); `protocol/README.md` |
| **Why excellent** | Explicit entity model and dual-queue contract; UI/host drives engine without embedding business logic in transport; correlation via `sub_id`. |
| **Parity-independent** | Queue/correlation/entity discipline — not Codex op catalog. |

### 4. Sandbox: PermissionProfile → backends + violations — **L** (profile layer alone **M**)

| | |
| --- | --- |
| **Codex** | `codex-rs/sandboxing/` (`manager.rs`, `policy_transforms.rs`, `violation.rs`, `bwrap.rs`, `seatbelt.rs`); `linux-sandbox/`; `process-hardening/`; `protocol/.../permission_profile_intersection.rs` |
| **Why excellent** | One policy object transforms to OS backends; violations are first-class; profile intersection fails closed; tiny pre-main hardening for helpers. |
| **Parity-independent** | Enforcement architecture; keep Aster ksandbox, borrow profile→backend + violation telemetry. |

### 5. Managed requirements / Constrained layered config — **L**

| | |
| --- | --- |
| **Codex** | `codex-rs/config/` — `loader/`, `constraint.rs`, `config_requirements.rs`, `requirements_layers/`, `fingerprint.rs`, `merge.rs` |
| **Why excellent** | Separates user prefs from enforced policy; per-key origins; fingerprints; `Constrained` validators from requirements layers. |
| **Parity-independent** | Config governance — not Codex MDM/cloud product. |

### 6. Compaction as budgeted lifecycle — **L**

| | |
| --- | --- |
| **Codex** | `codex-rs/core/src/compact.rs`, `compact_token_budget.rs`, `compact_remote_v2*.rs`, `compact_retained_tool_outputs.rs`; `context_manager/`; hooks `hooks/src/events/compact.rs` |
| **Why excellent** | Named lifecycle with budgets, retained outputs, pre/post hooks, shared accounting — long sessions degrade predictably. |
| **Parity-independent** | Budgeting/lifecycle pattern; not remote summarization product. |

### 7. Verified apply-patch pipeline — **M**

| | |
| --- | --- |
| **Codex** | `codex-rs/apply-patch/` — `parser.rs`, `seek_sequence.rs`, `file_update.rs`, `invocation.rs` (`maybe_parse_apply_patch_verified`), `streaming_parser.rs` |
| **Why excellent** | Parse → verify invocation → seek context → apply; typed failures; hermetic tests — not opaque shell diffs. |
| **Parity-independent** | File-mutation reliability mechanism. |

### 8. External app-server-protocol + schema fixtures — **M**

| | |
| --- | --- |
| **Codex** | `codex-rs/app-server-protocol/` — `src/rpc.rs`, `src/protocol/`, `schema_fixtures.rs`, `schema/json/`; contrast in-process `protocol/` |
| **Why excellent** | Host-facing wire types in a minimal crate with JSON Schema / TS + fixture regression; clients evolve without sharing implementation crates. |
| **Parity-independent** | Multi-client protocol hygiene for ACP/Studio. |

### 9. Feature Stage registry — **S–M**

| | |
| --- | --- |
| **Codex** | `codex-rs/features/src/lib.rs` (`Feature`, `Stage`, `FeatureSpec`, `FEATURES`), `legacy.rs`, `feature_configs.rs` |
| **Why excellent** | UnderDevelopment → Experimental → Stable → Deprecated → Removed; legacy aliases; no scattered bools. |
| **Parity-independent** | Flag governance — not Codex feature set. |

### 10. Typed lifecycle hooks + managed-only mode — **L**

| | |
| --- | --- |
| **Codex** | `codex-rs/hooks/` — `engine/dispatcher.rs`, `discovery.rs`, `events/`, `schema_loader.rs`; `config/requirements_layers/hooks.rs`; `docs/config.md` (`allow_managed_hooks_only`) |
| **Why excellent** | Typed request/outcome events; managed hooks required by policy; discovery can fail closed. |
| **Parity-independent** | Extension/observability mechanism. |

### 11. Elicitation / approval pause coordination — **M**

| | |
| --- | --- |
| **Codex** | `codex-rs/core/src/elicitation.rs`; `protocol/src/request_user_input.rs`, `approvals.rs`; SQ/EQ ops in `protocol.rs` |
| **Why excellent** | Interactive gates are protocol-first; registration-counted pause so concurrent elicitations don't race tool results. |
| **Parity-independent** | Control-flow + protocol pattern; keep Aster approval UX. |

### 12. Skills partial-success load + snapshot cache — **S–M**

| | |
| --- | --- |
| **Codex** | `codex-rs/skills/` — `loading.rs` (`LoadedSkillRoot`, `SkillError`, `SkillRootSnapshotCache`), `parser.rs`, `selection.rs` |
| **Why excellent** | Per-skill errors accumulate instead of failing the catalog; root snapshots cacheable by identity. |
| **Parity-independent** | Discovery harness — not Codex skill content. |

---

## Honorable mentions

| # | Mechanism | Paths | Why | Size |
| --- | --- | --- | --- | --- |
| H1 | Rollout-trace offline reducer | `codex-rs/rollout-trace/` | Hot path appends raw evidence; interpretation offline | L |
| H2 | Permission-profile intersection | `protocol/.../permission_profile_intersection.rs` | Combining authority never invents grants | M |
| H3 | Arg0 multi-helper re-exec | `codex-rs/arg0/` | One binary dispatches helpers via argv0 | S–M |
| H4 | Critical-path turn attribution | `codex-rs/utils/critical-path/` | Latency forensics: Sampling/Tools/UserWait/Compaction | S–M |
| H5 | Output truncation + persistence byte budgets | `utils/output-truncation/`; `rollout/src/policy.rs` | Shared caps prevent silent disk/context blowups | S |

---

## Explicitly out of scope for this scan

- Feature-parity matrices (CLI commands, model providers, IDE chrome)
- Copying Codex sandbox binaries / policies wholesale
- Product Pass claims
