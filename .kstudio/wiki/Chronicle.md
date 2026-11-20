## 2026-11-17 · YOLO：B1/B2/D1/D2/F2 诚实关闭 + tui913 11/11

## 2026-11-18 · YOLO：TB4.0 task2 biped 评测
- 题：`biped-contact-dynamics`；Harbor 无 reward（verifier Untrusted `/logs/verifier`）
- Agent 早退缺 npz；计划：artifact 门闩 + 修 verifier 挂载
- 证据 `T2026-11-18-tb40-task2-biped`；≠Pass

## 2026-11-17 · YOLO：TB4.0 task1 根因优化后重评
- 修：8h 默认预算；工具后 pregate nudge≤2；result 记 maxExecutionTimeMs
- 重评 `batched-eval-parity` + kimi-01/k3.1-pro → **reward 1.0** / 5/5
- ≠ Meta Harness Pass；证据 `T2026-11-17-tb40-task1-rerun-optimized`

## 2026-11-17 · /go：如何优化 Aster
- 产出 [Optimize-Aster.md](Optimize-Aster.md)：按可组合/高效/可信排 P0–P3
- 教训：TB 840s 默认二次浪费；H2 Studio dirty 仍是可信主阻塞
- ≠产品 Pass；下一刀建议 H2 land（需授权）或 A1 指纹

- 缺陷目录多条 by-design/known；tui_913 11/11；H2/headed 仍 park
- 证据 `T2026-11-17-b1-b2-write-parallel-honesty` · `T2026-11-17-d1-d2-f2-honesty` · `T2026-11-17-tui913-hermetic-reconfirm2`

## 2026-11-17 · YOLO：A7 FG lease 诚实关闭 + unattended 33/33

- A7 by-design（继承父 lease）；unattended_e2e 33/33
- 证据 `T2026-11-17-a7-fg-lease-honesty` · `T2026-11-17-unattended-e2e-yolo-reconfirm2`；≠ Meta Done

## 2026-11-17 · YOLO：app_view 280（slash-gate + tip）

- slash-gate `/init` + tip 分歧断言；`app_view` 280/280
- 证据 `T2026-11-17-appview-280-slash-tip`；≠ Meta Done

## 2026-11-17 · YOLO：P7 Experimental 调用点硬拒

- `feature_switch_call_site_allowed`；动态注册拒 Experimental；hermetic p7×3
- 证据 `T2026-11-17-p7-experimental-call-site`；≠ Meta Done

## 2026-11-17 · YOLO：slash-gate `/init` 对齐

- `ASTER_EFFECTIVE_COMMANDS` +`init`；gate 测试 4/4
- 证据 `T2026-11-17-slash-gate-init`；≠ Meta Done；H2/headed 仍 park

## 2026-11-17 · YOLO：真实 DSH Plugin E2E（安装/使用/卸载）

- 真实 `dsh` 0.2.2-rc.1；hermetic `$DSH_HOME`；fixture `dsh-aster-e2e-hello`
- 证据 `T2026-11-17-dsh-plugin-e2e`；`run.sh` PASS；命名 YOLO 范围关闭；≠ Meta Done；symlink 残留已记

## 2026-11-17 · YOLO：AppView Appearance Arc（HG2）

- `AppView`/`ScrollbackState` 会话路径共享 Arc；接 BlockContext Arc
- 证据 `T2026-11-17-appview-appearance-arc`；slash-gate `/init` 正交失败未修；≠高效关；总体仍开

## 2026-11-17 · YOLO：headed daily-use park

- headed/GUI Pass park（需 Studio land 或显式脏树 headed 授权）；hermetic≠headed
- 证据 `T2026-11-17-headed-daily-use-park`；总体仍开

## 2026-11-17 · YOLO：E4 generate_object stream discard

- 流式省略可计量 `discarded_bytes`；hermetic `hg2_e4_generate_object_stream` 1/1
- 证据 `T2026-11-17-e4-generate-object-stream`；≠ E4 全关；总体仍开

## 2026-11-17 · YOLO：tui_913 hermetic 11/11

- `aster-acp` `--test tui_913_hermetic` **11/11**；证据 `T2026-11-17-tui913-hermetic-reconfirm`
- ≠ headed Pass；总体仍开

## 2026-11-17 · YOLO：hermetic 高效包 7/7

- latency/discard/json/Arc/update_plan/bm25/confine；证据 `T2026-11-17-efficient-e4-c1-pack`
- ≠Pass；总体仍开

## 2026-11-17 · YOLO：E1 doc drift 12 MiB

- audit OUTCOME 对齐 wiki/code `MAX_RECORD_BYTES=12MiB`；证据 `T2026-11-17-e1-doc-drift-12mib`
- ≠ E1 Pass；总体仍开

## 2026-11-17 · YOLO：PROTOCOL featureSwitchStages

- ACP PROTOCOL 文档化 initialize 开关/阶段投影；证据 `T2026-11-17-p7-protocol-feature-switch-stages`
- ≠ Experimental 闸；总体仍开

## 2026-11-17 · YOLO：E4 BM25 query_discarded_chars

- BM25 回显查询预算可计量；hermetic `hg2_e4_bm25_query_discarded` 1/1
- 证据 `T2026-11-17-e4-bm25-query-discarded`；≠ E4 全关；总体仍开

## 2026-11-17 · YOLO：unattended_e2e 33/33 复跑

- hermetic `unattended_e2e` **33/33**；证据 `T2026-11-17-unattended-e2e-yolo-reconfirm`
- ≠ headed/daily-use Pass；总体仍开

## 2026-11-17 · YOLO：hermetic +3（Arc/E4/C1）

- 注册 `hg2_blockcontext_appearance_arc` / `hg2_e4_update_plan_discarded` / `hg2_c1_confine_verify_stub` **3/3**
- 证据 `T2026-11-17-hermetic-arc-e4-c1`；总体仍开

## 2026-11-17 · YOLO：E4 update_plan discarded_chars

- `update_plan` 步骤字预算截断写入 metadata；证据 `T2026-11-17-e4-update-plan-discarded`
- ≠ E4 全关；总体仍开

## 2026-11-17 · YOLO：P7 featureSwitchStages + Stable 晋升

- ACP initialize 投影 `featureSwitchStages`；permission_profile / compaction.ledger → Stable
- 证据 `T2026-11-17-p7-feature-switch-stages`；≠全量 Experimental 闸；总体仍开

## 2026-11-17 · YOLO：C1 verify stub fail-closed

- `aster-confine` `verify_*` 不再假绿；`STUB_NOT_ENFORCEMENT` + `is_enforcement_authority=false`
- 证据 `T2026-11-17-c1-verify-stub-fail-closed`；≠ OS 隔离 Pass；总体仍开

## 2026-11-17 · YOLO：BlockContext Appearance Arc（HG2）

- `BlockContext`/`ScrollbackState` 共享 `Arc<AppearanceConfig>`；热路径 `Arc::clone` 替代深拷贝
- `context_with_mode_arc_shares_appearance_pointer` + thinking/entry/preamble 绿
- 证据 `T2026-11-17-blockcontext-appearance-arc`；≠高效关；H2 仍 park；总体仍开

## 2026-11-17 · YOLO：hermetic +4（E2/E8/P7/P8）

- `verify-hermetic-perf-e2e.py` 注册四级 grader **4/4**
- 证据 `T2026-11-17-hermetic-e2-e8-p7-p8`；总体仍开

## 2026-11-17 · YOLO：P7 feature_switch_enabled

- `Removed` fail-closed API；`tools.parallel_task` 入册 Removed
- 证据 `T2026-11-17-p7-feature-switch-enabled`；≠全量 Experimental 闸；总体仍开

## 2026-11-17 · YOLO：P8 permission.denied 码

- ACP PermissionDenied → structured `permission.denied` rawOutput
- 证据 `T2026-11-17-p8-permission-denial-code`；≠Pass；总体仍开

## 2026-11-17 · YOLO：E2 空行 fail-closed

- effect `FileLog` 中途空行拒绝整读；证据 `T2026-11-17-e2-empty-line-refuse`
- ≠Pass；总体仍开

## 2026-11-17 · YOLO：`.aster` eng gitignore 解锁

- 工程标记可跟踪；`config.acl`/sessions/memory 仍忽略
- 证据 `T2026-11-17-aster-eng-gitignore`；≠本仓 migrate；总体仍开

## 2026-11-17 · YOLO：E8 compaction Failed 相

- ledger `Failed` + ACP `auto_compact_failed`；attach 中途失败不卡 Started
- 证据 `T2026-11-17-e8-compaction-failed-phase`；≠Pass；总体仍开

## 2026-11-17 · YOLO：**HG6 关**（Q13）

- hermetic `hg2_kburn_*` **11 suites / 18 passed**；`verify-ai-eng.py --level L3` **PASS**
- 证据 `T2026-11-17-hg6-close`；本仓现网仍 `.kstudio/`（产品 `.aster/` 运行时 gitignore）
- launch_resume 复跑 1/1（先前写 marker 失败 = flake，非 `/yolo` 撞名）
- park：H2/headed/C1；**总体 Meta Harness 仍开**；%≠Pass

## 2026-11-17 · YOLO：L3 裸技能闸门 + helpers/高效

- `verify-ai-eng.py` 认裸名 → **L3 PASS**（≠产品 Pass）
- workflow helpers 进 factory；高效 hermetic 4/4；live helpers dual-root
- （当时）park H2/headed；总体 / HG6 仍开 — 后由 HG6 关条关闭

## 2026-11-17 · YOLO：workflow helpers 进 factory

- sitrep/progress-scan/sync-k-skills/print-paste 可移植进 Core materialize
- `/kburn` 覆盖 helpers 计数；证据 `T2026-11-17-kburn-workflow-helpers`
- park H2/headed/HG3/C1；总体 / HG6 仍开

## 2026-11-17 · YOLO：conductor E2E 用例 + hermetic

- 命名范围：规划测试用例并完成端到端测试 → **Done（该范围）**
- TESTPLAN C1–C10；hermetic `hg2_kburn_*` **10 suites / 17 passed / 0 failed**
- 证据 `T2026-11-17-conductor-e2e`；总体 Meta Harness / HG6 **仍开**

## 2026-11-17 · 工程 ACL + 技能去 k-

- `.kcl` → `project.acl`（避产品 `config.acl`）；12 技能 `init`…`yolo`；slash `/init`…
- Core `KBURN_SKILL_NAMES` + sync/activate/init/clean 名录；规则 `skills.mdc`
- 证据 `T2026-11-17-conductor-acl-bare-skills`；≠ HG6 关

## 2026-11-17 · Q14 更正：工程树直落 `.aster/`

- 规范根 **`.aster/`**（非 `.aster/kstudio`）；遗留 `.kstudio/` 兼容
- bare `.aster/config.acl` **不** auto-arm；skill later-wins 末位 `.aster/skills`
- 证据 `T2026-11-17-kburn-aster-root`（supersedes nest）；≠ HG6 关；本仓现网仍 `.kstudio/`

## 2026-11-17 · YOLO：kburn→Core P0 窄刀

- GOALS HG6 locked（Q10–Q12）；清单 [Kburn-Aster-Absorption.md](Kburn-Aster-Absorption.md)；D-2026-11-17-kburn-core-absorb
- P0-1：`.kstudio/skills` → `agent_skill_roots` 末位 + ACP watch/load
- P0-2：`KstudioCoreDirs` + vendored layout JSON + `resolve`/MANIFEST
- P0-3：`KBURN_SKILL_NAMES` + 名录限定 `load_kburn_skills` + coverage；本仓 **12/12** 可载
- README 非候选（整树 `.kstudio/skills` 无假 Parse）
- hermetic graders +5 → pack 声明 **42**；证据 `T2026-11-17-kburn-p0-*` · `T2026-11-17-kburn-p1-slash`
- ACP `/kburn` [`status`|`materialize`] 宿主组合 Core coverage + factory seeds
- Core 内嵌 factory 子集（contracts/skeleton/rules）+ `materialize_kstudio_factory_seeds`
- park：H2/headed/HG3/C1；**HG6 ≠关**（12×SKILL 正文未嵌二进制；Studio 未接）；总体 ≠Done

## 2026-11-17 · YOLO 续：chrome/A4/A5/H7 + hermetic graders

- TUI chrome lock-in；A5 nested-task deny；A4 override report；H7 cancel-bg toast；headers meta
- conformance：chrome 须在 `queue/changed` 之后
- hermetic pack graders **31→37**（含 a4/a5/h7/chrome×3）
- park：H2/headed/HG3/C1；总体 ≠Done

## 2026-11-17 · TUI 简单任务首包静默 chrome

- `/go`：`start_turn` 预创建 Thinking；首个 `streamStartMs` 预创建；ACP meta + `emit_turn_started_chrome`
- 证据：`T2026-11-17-tui-first-token-chrome`（3 单测绿）
- park：headed/live 慢模型墙钟；headers 120s 默认未砍；总体 ≠Done

## 2026-11-17 · H5/H6 用户可感去重 + hermetic 30

- H6：ACP `task`/`background` spawn parent → wire `toolCallId`；Studio `toolUseId`；`subagent_type` 正确映射 `taskType`/`subagentType`（修 board 永不命中 dedupe）
- 证据：`T2026-11-17-h6-tooluseid-plumb`；hermetic **30/261/0**（`T2026-11-17-hermetic-30-reconfirm`，含 shell-merge）
- park：H2 Studio push/gitlink；headed/live；BlockContext Arc；C1；总体 Meta Harness ≠Done

## 2026-11-16 · Core/ACP/TUI 性能刀（named YOLO）

- A10 drain TTL 30s；fact key uuid 免全量 JSONL；ACP emit alloc/门控；bash `discarded_bytes`；delta 省略 title/kind；A2 plan content+单 in_progress；bash delta 4KiB/50ms coalesce
- 续：S1–S3；TUI line-widths；ACP emit **move**；shell **equal-meta**；bash **slim**；E4 `read_freeze`；`merge_stream_text` owned snapshot move
- 端到端：`tui_913_hermetic` **11/11**；long_horizon 75/68；unattended 33；acp_conformance 15
- 证据：`T2026-11-16-{…,perf-e2e-pack,acp-emit-move,shell-equal-meta-merge,bash-delta-slim,e4-filelog-read-freeze}`
- ACP tool delta **move** + `ToolCallId` 免 `to_string`（`T2026-11-16-acp-delta-move-toolcallid`）
- TUI execute streaming line-widths（`T2026-11-16-tui-execute-line-widths`）
- P6 后续：WC-BG1 twin 补 `allow("*")` + `file_path`（`T2026-11-16-p6-bg-settlement-twin`）
- 续刀：`turn.yielded`+compaction `read_freeze`（`T2026-11-16-e4-yielded-compaction-freeze`）；ACP id `&str`→`Arc<str>`（`T2026-11-16-acp-id-arcstr`）；TUI single-field estimate borrow（`T2026-11-16-tui-single-field-widths`）；hermetic 复绿同上
- 再续：TUI tool-body widths；checkpoint `read_freeze`；SSE **hold blank trailing CR**（`T2026-11-16-sse-hold-blank-cr`，修 HEAD 既有 `streaming_split_cr` 红）；OpenAI ToolUseStart id move；receipt `deserialize(&Value)` 免 clone；tool-end output **take**；stream finalize **take**
- 教训：stream tool-args `take(entry.2)` **回退**（掏空 finalize args → tui_913 multi-turn 红）；见 `T2026-11-16-stream-tool-args-take`
- 再续：ACP end_text 条件 clone（`T2026-11-16-end-text-conditional-clone`）
- HG2：**token + latency freeze graders**（`T2026-11-16-hg2-token-latency-freeze`）；TUI Subagent/Btw/SessionEvent/MemoryCapture estimate borrow；fact deserialize-borrow-2；stream Done meta **take**
- hermetic 复跑：tui_913 **11/11** · conformance **15** · LH **75/68** · unattended **33**（串行）
- 冻结包 runner：`just hermetic-perf-e2e` **20 套 251/0**（+memory_management · consumer_deny · startup_error · plugin · codex …；boundary/v912 park）
- TUI SentMessage + SessionEvent estimate 静态臂（含 DiskFull/MemoryCommand）；ACP meta deserialize + SessionId Arc；discard 族（bg/task/batch/program/page/artifact/search/porcelain）
- HG2：**discard freeze grader**（补 token/latency）
- 续：task/transcript/observation `deserialize(&Value)` 免 clone；A1 并行测例 prompt 去重
- 再续：migration/document/plugin/snapshot/event/inspection deserialize；**read/read-batch E4 discard**；prepared_raw_input identity skip；hermetic **251/0** 复绿
- 再续：read-batch fit-len；plan replay running fail-closed 测例对齐；transcript prepared_raw_input
- hermetic pack → **24 套 255/0**（20 ACP + 4 HG2 lib）
- TUI cancel `banner_line`；search-snippet `discarded_chars`；BM25 `discarded_items`
- hermetic → **25 套 256/0**（+cancel banner）；stream toolcall **get_mut**；web_search **discarded_chars/items**
- **`json_serialized_len`**：web_search/ACP/batch/porcelain/gemini/generate_object/task/structured；hermetic → **26 套 257/0**
- hermetic → **29 套 260/0**（+`hg2_json_update_sha256`；digest stream fan-out）
- hermetic → **28 套 259/0**（+web_search discard · stream snapshot graders）；gemini transport/state 亦改 json_len
- ACP `subagent_finished` progress **move**；durable_memory / retrieval `collection::json_size` → json_len
- effect log diagnostic json_len；tool registry schema **fingerprint+len** 一次 `to_writer`
- grep search `discarded_items`（完整=0 / 截断=null）
- batch `$ref` **borrow-walk** 仅叶 clone
- porcelain stamp/entry digest **流式 Sha256**（免 to_vec）
- 仍开：BlockContext Arc park、H2 Studio land、headed/live E2E；总体 Meta Harness ≠Pass；HG2 graders ≠ HG2 Pass

## 2026-11-16 · 长程复杂多轮 agent-desktop E2E 复跑

- L0–L4 PASS on kimi-01/k3.1-pro @ dirty HEAD `291c2afaf`；H3 首败后修 `drive_lh_retrieval` welcome(kimi)+fail dump 再绿
- 证据：`docs/evidence/code/2026-11-16-long-horizon-complex-e2e/OUTCOME.md`
- HG3 仍 park；总体 ≠Pass

## 2026-11-16 · YOLO 日常可观测/首跑

- ACP Permission elicitation 跨 `session/request_permission` HITL；sandbox.violation 上 ACP bash rawOutput；首跑 placeholder 可开 session（generation 仍拒）
- 证据：`docs/evidence/acp-permission-elicitation-2026-11-16/` · `docs/evidence/sandbox-violation-acp-wire-2026-11-16/` · `docs/evidence/first-run-session-open-2026-11-16/`
- HG3 仍 park；≠产品 Pass

## 2026-11-16 · 日常可用生产接线（YOLO 续推）

- B：HookEngine managed-only · forced_layer digest 进 admit · elicitation↔ask_user/form
- 证据：`docs/evidence/daily-use-production-wiring-2026-11-16/`
- HG3 仍 park；≠产品 Pass

## 2026-11-16 · P2-10 elicitation + 吸收清单收口（YOLO）

- S：`D-2026-11-16-p2-10-wave-lock`；清单 P0–P2 均已落地
- B：`elicitation` 三通道 + 并发/cancel hermetic；证据 `docs/evidence/elicitation-state-2026-11-16/`
- **战役 park**：HG3 需用户授权 commit/推送/发布；≠产品 Pass

## 2026-11-16 · P2-9 hooks managed-only（YOLO）

- S：`D-2026-11-16-p2-9-wave-lock`
- B：`hooks/policy` + hermetic；证据 `docs/evidence/hooks-managed-only-2026-11-16/`
- 清单余 P2-10；HG3 仍 park；≠产品 Pass

## 2026-11-16 · P2-12 共享字节预算（YOLO）

- S：`D-2026-11-16-p2-12-wave-lock`
- B：`byte_budget` + discard oracle；证据 `docs/evidence/shared-byte-budget-2026-11-16/`
- HG3 仍 park；P2-9/10 待开；≠产品 Pass

## 2026-11-16 · P2-11 skills 部分成功加载（YOLO）

- S：`D-2026-11-16-p2-11-wave-lock`
- B：`SkillLoadReport` + hermetic；证据 `docs/evidence/skills-partial-load-2026-11-16/`
- HG3 仍 park；P2-9/10/12 待开；≠产品 Pass

## 2026-11-16 · P1-6 forced layer 桥（YOLO · P1 收口）

- S：`D-2026-11-16-p1-6-wave-lock`；P1-5…P1-8 均已落地
- B：`config/forced_layer.rs` + provenance digest；证据 `docs/evidence/forced-layer-bridge-2026-11-16/`
- HG3 仍 park；P2 未开；≠产品 Pass

## 2026-11-16 · P1-8 Feature Stage 注册表（YOLO 续推）

- S：`D-2026-11-16-p1-8-wave-lock`
- B：`capability/feature_stage.rs` + digest/alias hermetic；证据 `docs/evidence/feature-stage-capability-2026-11-16/`
- HG3 仍 park；下一候选 P1-6；≠产品 Pass

## 2026-11-16 · P1-7 verified patch/edit codes（YOLO 续推）

- S：`D-2026-11-16-p1-7-wave-lock`
- B：稳定 `metadata.patch.code` / `metadata.edit.code`；patch 26 + edit 2 绿；证据 `docs/evidence/verified-patch-codes-2026-11-16/`
- HG3 仍 park；≠产品 Pass

# 演进记录

## 2026-11-16 · P1-5 Compaction ledger（YOLO 续推）

- HG3 commit/发布仍 park；S 另决授权 P1-5（`D-2026-11-16-p1-5-wave-lock`）
- B：`CompactionLedger` + SessionCompact 接线 + hermetic 3 绿；证据 `docs/evidence/compaction-ledger-2026-11-16/`
- ≠产品 Pass；下一候选 P1-7（需另派）或用户授权入库

## 2026-11-16 · P0-4 ACP 实体/golden + 首批 P0 收口

- B：`PROTOCOL.md` + `acp_wire_surface_v1.json` + conformance 15/15；证据 `docs/evidence/acp-protocol-entities-2026-11-16/`。≠产品 Pass
- 首批 P0-1…P0-4 均复验绿、**未 commit**；硬目标③待发布授权

## 2026-11-16 · P0-3 PermissionProfile + YOLO 续推 P0-4

- B：`PermissionProfile` 交集 fail-closed + `sandbox.violation.*` 稳定码（tool metadata）+ confine stub 非权威文档；证据 `docs/evidence/sandbox-permission-profile-2026-11-16/`。≠产品 Pass
- 残余：native ksandbox 尚未 typed 违规；intersect 未挂 session/ACP

## 2026-11-16 · P0-2 effect rollout 硬化 + YOLO 续推 P0-3

- B：`aster-effect` 单行 `MAX_RECORD_BYTES`（12 MiB）+ 拒绝契约文档 + `LogFreeze`；证据 `docs/evidence/effect-rollout-hardening-2026-11-16/`；审查抬高 4→12 MiB。≠产品 Pass
- 编排：P0-1/P0-2 复验绿（未 commit）；下一刀曾为 P0-3

## 2026-11-16 · 吸收清单 wave-lock + P0-1 开做

- S：审定 [Codex-Aster-Absorption.md](Codex-Aster-Absorption.md) → **wave-locked**；首批 P0-1…P0-4；[Decisions](Decisions.md) `D-2026-11-16-absorption-wave-lock`
- B：按清单落地 P0-1（permissions `match`/`not_match`）；≠产品 Pass

## 2026-11-16 · bootstrap 机制扫描与吸收清单

- B：只读扫描 `openai/codex`（临时 clone `/tmp/openai-codex` @ `5cb38e7`）→ `.kstudio/evidence/T2026-11-16-codex-scan/`
- D：合成排序吸收清单 → [Codex-Aster-Absorption.md](Codex-Aster-Absorption.md) + `.kstudio/evidence/T2026-11-16-codex-absorb/`
- 未记产品 Pass
- 2026-11-16 · published aster-cli 0.3.9 / aster-acp 9.2.7 @ 22856ef33; aster-cli-stable→0.3.9 (named YOLO wrap+release).
- 2026-11-16 · defect-mechanisms audit (named YOLO): A1 task no content-dedup; C1 confine stub false confidence; catalog OUTCOME + wiki Defect-Mechanisms.md.
