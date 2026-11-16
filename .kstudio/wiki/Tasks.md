# 任务与产物

此模板尚无完成记录。仅登记本项目真实交付，不复制模板来源项目的历史。

每个任务以 H2 标题记录稳定的 `T日期-slug` ID，正文写明完成日期、具体结果、可打开的实际产物及验证依据/限制。新完成项置前，历史保留；未知日期、产物或验证不得补造。

单人任务可自行登记；并行工作由指定的 D/O 或台账写入者汇总真实短报后，再发布最终完成报告。证据不足时保持部分完成/未验证，不列为完成。

每个任务的验收证据分路径保存，不覆盖旧报告。当前源码链接可更新，历史结论以回执或快照为准；`/k-wiki` 刷新本页入口并打包实际引用的产物。

## T2026-11-16-first-run-session-open

- **完成日期**: 2026-11-16
- **结果**: 首跑 placeholder ACL 下 `session/new` 可开（拒绝型 LLM）；generation 仍 fail closed。≠产品 Pass。
- **产物**: `unconfigured_model.rs`；`session_open.rs`；`docs/evidence/first-run-session-open-2026-11-16/OUTCOME.md`
- **验证**: `startup_error` 3 绿；见 OUTCOME
- **限制**: HG3 未授权；非 first-run 缺 key 未扩面

## T2026-11-16-acp-permission-elicitation

- **完成日期**: 2026-11-16
- **结果**: Permission elicitation ledger 跨 ACP `request_tool_permission` HITL；hook 不再提前结账。≠产品 Pass。
- **产物**: `elicitation.rs`；`permission_ask.rs`；`hook_runtime.rs`；`docs/evidence/acp-permission-elicitation-2026-11-16/OUTCOME.md`
- **验证**: elicitation 4 绿 + HITL hermetic 1 绿
- **限制**: HG3 未授权；question 通道未改标 Permission

## T2026-11-16-sandbox-violation-acp-wire

- **完成日期**: 2026-11-16
- **结果**: Core `sandbox_violation.code` 进入 ACP bash `rawOutput`。≠产品 Pass。
- **产物**: `tool_render.rs`；`emit.rs`；`docs/evidence/sandbox-violation-acp-wire-2026-11-16/OUTCOME.md`
- **验证**: `tool_cards_use_pager_kind_and_raw_input` 绿
- **限制**: HG3 未授权；effect 日志未扩；Studio UI 未展示

## T2026-11-16-daily-use-wiring

- **完成日期**: 2026-11-16
- **结果**: 将 P2-9/P1-6/P2-10 接到生产路径：HookEngine managed-only、admit 强制层 digest、ask_user/form elicitation 通道。≠产品 Pass。
- **产物**: `hooks/engine.rs`；`config/workspace_trust.rs`；`ask_user.rs`；`ask_user_form.rs`；`docs/evidence/daily-use-production-wiring-2026-11-16/OUTCOME.md`
- **验证**: 相关 hermetic 10 绿；见 OUTCOME
- **限制**: HG3 未授权；ACP 9 项失败未修；Permission 通道未接 ACP wire

## T2026-11-16-p2-10-elicitation

- **完成日期**: 2026-11-16
- **结果**: B 落地 P2-10：`elicitation` 统一 Permission/AskUser/Form 通道类型 + 并发不串 + cancel；未统一 UI。≠产品 Pass。
- **产物**: `crates/code/core/src/elicitation.rs`；`docs/evidence/elicitation-state-2026-11-16/OUTCOME.md`
- **验证**: `elicitation::` 3 绿；见 OUTCOME
- **限制**: 未跑 ACP cancel conformance；未替换既有 ask_user 运行时；未 commit/发布

## T2026-11-16-p2-9-hooks-policy

- **完成日期**: 2026-11-16
- **结果**: B 落地 P2-9：`MANDATORY_HOOK_GATES` + `HookAdmissionPolicy::managed_only`（用户钩子被忽略）；未扩大事件枚举。≠产品 Pass。
- **产物**: `crates/code/core/src/hooks/policy.rs`；`docs/evidence/hooks-managed-only-2026-11-16/OUTCOME.md`
- **验证**: `hooks::policy` 2 绿；见 OUTCOME
- **限制**: 未接线全 HookEngine 发现失败路径；未做 P2-10；未 commit/发布

## T2026-11-16-p2-12-byte-budget

- **完成日期**: 2026-11-16
- **结果**: B 落地 P2-12：`byte_budget` 共享命名天花板（tool output + effect record）+ `discarded_bytes` 可计量。≠产品 Pass。
- **产物**: `crates/code/core/src/byte_budget.rs`；`docs/evidence/shared-byte-budget-2026-11-16/OUTCOME.md`
- **验证**: `byte_budget` 单测绿；见 OUTCOME
- **限制**: 未改遥测/模型 API；未做 P2-9/10；未 commit/发布

## T2026-11-16-p2-11-skills-partial

- **完成日期**: 2026-11-16
- **结果**: B 落地 P2-11：`load_from_dir_report` 可枚举 Parse/Validation 失败；坏 skill 不阻断同目录好 skill。≠产品 Pass。
- **产物**: `crates/code/core/src/skills/registry.rs`；`docs/evidence/skills-partial-load-2026-11-16/OUTCOME.md`
- **验证**: `bad_skill_does_not_block_good_sibling_and_errors_are_enumerable` 绿；见 OUTCOME
- **限制**: 未做 P2-9/10/12；未 commit/发布；未宣称日常稳定使用

## T2026-11-16-p1-6-forced-layer

- **完成日期**: 2026-11-16
- **结果**: B 落地 P1-6：`forced_layer` 文档化强制层覆盖 trust strip；非法强制 sandbox 值加载失败；`ForcedLayerProvenance` digest 可查询；无 JSON sidecar。≠产品 Pass。
- **产物**: `crates/code/core/src/config/forced_layer.rs`；`docs/evidence/forced-layer-bridge-2026-11-16/OUTCOME.md`
- **验证**: `config::forced_layer` 2 绿；见 OUTCOME
- **限制**: 未做 MDM；未 commit/发布；未宣称日常稳定使用；P2 未开

## T2026-11-16-p1-8-feature-stage

- **完成日期**: 2026-11-16
- **结果**: B 落地 P1-8：`FeatureStage` + 静态 `FEATURE_SWITCHES`（Aster 已吸收机制 id）+ legacy 别名解析 + `feature_switch_registry_digest` 稳定可测。≠产品 Pass。
- **产物**: `crates/code/core/src/capability/feature_stage.rs`；`docs/evidence/feature-stage-capability-2026-11-16/OUTCOME.md`
- **验证**: `capability::feature_stage` 2 绿；见 OUTCOME
- **限制**: 未改 CapabilityDescriptor/ACP 投影布局；无远程放量；未做 P1-6/P2；未 commit/发布；未宣称日常稳定使用

## T2026-11-16-p1-7-verified-patch

- **完成日期**: 2026-11-16
- **结果**: B 落地 P1-7：`patch` 稳定 `metadata.patch.code`（parse/context_mismatch/line_ending/batch_* 等）；`edit` 稳定 `metadata.edit.code`（not_found/ambiguous/line_ending）；hermetic 覆盖坏 hunk、混合 CRLF、批上限与歧义替换。≠产品 Pass。
- **产物**: `crates/code/core/src/tools/builtin/{patch,edit}.rs`；`docs/evidence/verified-patch-codes-2026-11-16/OUTCOME.md`
- **验证**: patch 套件 26 绿；`test_edit_not_unique`/`test_edit_not_found` 绿；见 OUTCOME
- **限制**: 未换 Codex patch 语法；码未进 ACP/effect wire；未 commit/发布；未做 P1-6/P1-8；未宣称日常稳定使用

## T2026-11-16-p1-5-compaction-ledger

- **完成日期**: 2026-11-16
- **结果**: B 落地 P1-5：`CompactionLedger` 命名生命周期（Open/Started/Completed）+ 可断言 pre/post 预算字段；`SessionCompact` 经 ledger 发 `AutoCompact` 并记录 `carried_standing_lines`；hermetic 证明超预算触发与 standing carry 保留。≠产品 Pass。
- **产物**: `crates/code/core/src/compaction/ledger.rs`；`compaction.rs`（`trigger_threshold`）；`fact_control/compaction.rs`；`docs/evidence/compaction-ledger-2026-11-16/OUTCOME.md`
- **验证**: `cargo test --locked -p aster-core --lib compaction::ledger` 3 绿；`fixed_context_does_not_force_*` 绿；clippy lib 对本刀无新诊断；见 OUTCOME
- **限制**: 未改 provider 精确 token 账本；无 soak；无 ACP wire 新字段；未 commit/发布；未做 P1-6+；未宣称日常稳定使用

## T2026-11-16-p0-4-acp-protocol

- **完成日期**: 2026-11-16
- **结果**: B 落地 P0-4：`crates/code/acp/PROTOCOL.md` 钉死 Session/Prompt/Turn/Run/Model turn/Subagent task 与队列语义（会话 turn 队列 vs Core `SessionLane` 非线上）；golden `acp_wire_surface_v1.json` + host method 单测 + `acp_conformance_stdio` 新增 `queue-running-identity`/`turn-queue-order`；两次负向篡改均使门失败。未换 Codex Op、未加总线。≠产品 Pass。
- **产物**: `crates/code/acp/{PROTOCOL.md,tests/fixtures/acp_wire_surface_v1.json}`；`tests/acp_conformance_stdio.rs`；`src/agent/host_methods_tests.rs`；`src/lib.rs`（文档指针）；`docs/evidence/acp-protocol-entities-2026-11-16/OUTCOME.md`
- **验证**: conformance 15/15 exit 0；lib host_method/execution_observe 16 绿；clippy `-p aster-acp --all-targets --no-deps` exit 0；见 OUTCOME
- **限制**: 全量 `aster-acp` 套件 9 项失败（环境/陈旧产物/未诊断，非本刀改动）；golden 仅覆盖 host method 名、queue/changed 键集与队列行为，非完整 JSON Schema；`__aster/execution/observe` 双下划线缝仅文档化未修；未宣称日常稳定使用

## T2026-11-16-p0-3-sandbox-profile

- **完成日期**: 2026-11-16
- **结果**: B 落地 P0-3：`PermissionProfile` 交集 API（fail-closed，`ProfileIntersectError` 封闭集）+ 稳定 `sandbox.violation.*` 码（`bash` 预启动拒绝写入 `metadata.sandbox_violation.code`）；`aster-confine` 文档声明非执行权威，ksandbox 仍是唯一后端。≠产品 Pass。
- **产物**: `crates/code/core/src/sandbox/permission_profile.rs`（+`permission_profile/tests.rs`）；`sandbox.rs`；`tools/builtin/bash.rs`；`aster-confine/src/lib.rs`；`docs/evidence/sandbox-permission-profile-2026-11-16/OUTCOME.md`
- **验证**: permission_profile 10 绿；bash typed_/violation_code 3 绿，bash::tests 77 绿；clippy core/confine exit 0；见 OUTCOME
- **限制**: ksandbox 原生适配器尚未返回 typed filesystem/network 违规；交集 API 未接入 grant 应用；码未扩散到 effect/ACP wire；未宣称日常稳定使用

## T2026-11-16-p0-2-effect-rollout

- **完成日期**: 2026-11-16
- **结果**: B 落地 P0-2：`FileLog` 单条记录 `MAX_RECORD_BYTES`（4 MiB）读写有界，超限整体拒绝、不跳行；损坏/截断 JSONL 沿用整体拒绝并写入 README 契约；新增 `FileLog::freeze` 暴露已提交 `byte_len`（`LogCut` 形状不变）；writer fence 沿用。`aster-effect` 全量测试 exit 0（lib 99 passed）。≠产品 Pass。
- **产物**: `crates/effect/src/{log.rs,lib.rs,log/security_tests.rs}`；`crates/effect/README{,.zh-CN}.md`；`docs/evidence/effect-rollout-hardening-2026-11-16/OUTCOME.md`
- **验证**: 见该 OUTCOME 命令与退出码；clippy `-p aster-effect --all-targets --no-deps` exit 0
- **限制**: 无 reverse-scan / 计数器；未跑 core 测试；仅 macOS 原生；未做 P0-3+；未宣称日常稳定使用；未拷 Codex；`exact_byte_limit_*` 夹具改为多条记录填满 16 MiB

## T2026-11-16-p0-1-permissions-self-test

- **完成日期**: 2026-11-16
- **结果**: B 落地 P0-1：`PermissionRule` 嵌入 `match`/`not_match`，坏例加载失败；hermetic 5 绿；example 好例 exit 0 / 坏例 exit 2。≠产品 Pass。
- **产物**: `crates/code/core/src/permissions/{rule,policy,self_test_examples_tests,fixtures/*}`；`examples/permission_policy_self_test.rs`；`docs/evidence/permissions-self-test-2026-11-16/OUTCOME.md`
- **验证**: 见该 OUTCOME 命令与退出码；clippy `-p aster-core --lib --examples --no-deps` exit 0
- **限制**: 未做 P0-2+；未宣称日常稳定使用；未拷 Codex

## T2026-11-16-codex-absorb

- **完成日期**: 2026-11-16
- **结果**: D 产出 Codex→Aster 机制吸收清单（排序 P0–P2 · Aster 路径映射 · 可验证完成定义 · 非目标）；衔接 B scan；≠产品 Pass。
- **产物**: [Codex-Aster-Absorption.md](Codex-Aster-Absorption.md)；证据 `.kstudio/evidence/T2026-11-16-codex-absorb/OUTCOME.md`
- **验证**: 清单字段齐全；引用 B `CANDIDATES.md` 与本仓 `crates/effect` / `crates/code/core` / `crates/code/acp` / `crates/acl` 路径存在性抽检
- **限制**: 未改 `apps/`/`crates/`；未宣称机制已落地或日常可用；口头「像 Codex」不计 Pass

## T2026-11-16-codex-scan

- **完成日期**: 2026-11-16
- **结果**: B 只读扫描 `/tmp/openai-codex`（`openai/codex` HEAD `5cb38e7…`）；提炼 Top12 + 5 荣誉提名机制候选；≠Pass。
- **产物**: `.kstudio/evidence/T2026-11-16-codex-scan/{OUTCOME.md,CANDIDATES.md}`
- **验证**: 源钉扎与路径存在；未把 Codex 源码拷进本仓
- **限制**: 非功能对等清单；未改业务源码；未开 branch/worktree

## T2026-11-16-k-init

- **完成日期**: 2026-11-16
- **结果**: 在 `/Users/roylin/code/aster` 以 create-missing 方式完成 KStudio 工程根初始化；`AGENTS.md` 保留；冲突 0；创建 84 个路径。
- **产物**: `.kstudio/`（含 skills / workflow / wiki / evidence）、`.cursor/skills/`、`.cursor/commands/`、`.cursor/rules/{git-branch-discipline,k-skills}.mdc`
- **验证**: `sync-k-skills.py --check` exit 0；`verify-ai-eng.py --level L3` exit 0 → `PASS (L3) aster HEAD=bootstrap`
- **限制**: 产品目标仍为 unknown；未跑应用测试；未 commit；未观察到原生技能选择器刷新。证据：`.kstudio/evidence/T2026-11-16-k-init/OUTCOME.md`
