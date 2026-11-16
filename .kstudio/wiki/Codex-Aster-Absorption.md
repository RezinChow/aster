# Codex → Aster 机制吸收清单

Updated: 2026-11-16 · by: S · status: **wave-locked** · ≠产品 Pass

依据：B 扫描 `.kstudio/evidence/T2026-11-16-codex-scan/`（Codex HEAD `5cb38e7…`）+ Aster 本仓事实 + D 草稿；S 审定锁定。  
硬约束：机制落地 + 可复跑证据；**不以功能对等 / 口头「像 Codex」为 Pass**；不扩产品面。

权威总体目标：`.kstudio/workflow/GOALS.md`。  
**首批锁定（本波实现顺序）：P0-1 → P0-2 → P0-3 → P0-4（已落地 · 未 commit）。**  
**本波续刀（另决）：P0–P2 清单项均已落地（未 commit）。**

---

## 排序原则

1. 与既有 Aster 权威路径对齐（effect / core / acp / acl），避免第二套真理源。  
2. 优先可独立验收的机制（策略自测、预算、协议卫生），而非外观。  
3. 已有强底座的项 = **加深**；双路径/缺口项 = **收敛或补机制层**。  
4. 完成定义必须可复跑；门禁绿 alone ≠ 日常稳定使用（后者属后续硬目标）。

---

## 吸收清单（排序）

### P0-1 · Execpolicy 式「规则自测」加深权限策略

| | |
| --- | --- |
| **机制** | 策略文件内嵌 `match` / `not_match`（或等价 fixture），加载失败即拒绝坏规则 |
| **Codex** | `codex-rs/execpolicy/`（`rule.rs` validate_* · `examples/example.codexpolicy`） |
| **Aster 落点** | `crates/code/core/src/permissions/`（必要时抽出纯评估 crate，仍由 core 消费）；CLI 检查可挂 `apps/aster` 子命令或既有 test binary |
| **现状** | typed `PermissionPolicy` + YAML/JSON；**P0-1 已落地**：规则级 `match`/`not_match` 加载期校验 + hermetic + example 非 0 退出。证据：`docs/evidence/permissions-self-test-2026-11-16/OUTCOME.md`（≠产品 Pass） |
| **可验证完成定义** | (1) 至少 1 份策略样例含必须匹配 / 必须不匹配用例；(2) 故意写坏的 `not_match` 使加载/校验 **非 0 退出**；(3) hermetic 单测覆盖 allow/ask/deny 合并；(4) `docs/evidence/<slug>/OUTCOME.md` 记录命令与退出码 |
| **非目标** | 复刻 Starlark DSL；换皮 Codex 规则集；网络策略产品化 |

### P0-2 · Rollout 质量属性加深 effect / session 持久化

| | |
| --- | --- |
| **机制** | 追加写事实日志的边界能力：反向扫描、坏行拒绝、超大记录跳过、冻结字节偏移、写锁/持久化指标 |
| **Codex** | `codex-rs/rollout/`（`reverse_jsonl_scanner.rs` · `recorder.rs` · `policy.rs` · `writer_lock.rs`） |
| **Aster 落点** | `crates/effect`（log/resume 原语）+ `crates/code/core/src/session_folder.rs` / `fact_control/`（产品会话布局） |
| **现状** | Effect 已是不可变事实日志 + resume；session 目录与 fork 已有。**P0-2 已落地**：损坏/截断 JSONL 整体拒绝（不跳行）；单条记录 `MAX_RECORD_BYTES`（4 MiB）读写有界；writer fence/`LogBusy` 沿用并引用测试；`FileLog::freeze` 暴露已提交 `byte_len`。未做 reverse-scan 与计数器。证据：`docs/evidence/effect-rollout-hardening-2026-11-16/OUTCOME.md`（≠产品 Pass） |
| **可验证完成定义** | (1) hermetic：截断/损坏行后 resume 或扫描行为符合文档（拒绝或跳过，不静默错解析）；(2) 超大记录有界；(3) 写并发有锁或等价 fence；(4) OUTCOME 含命令与「Explicitly not claimed」 |
| **非目标** | 引入 Codex rollout 文件名/目录布局；旁路 effect 另起 session blob |

### P0-3 · PermissionProfile 层 + violation 事件（保留 ksandbox）

| | |
| --- | --- |
| **机制** | 统一权限配置对象 → 后端变换；违规为一等事件；多源交集 fail-closed |
| **Codex** | `codex-rs/sandboxing/` · `linux-sandbox/` · `protocol/.../permission_profile_intersection.rs` |
| **Aster 落点** | `crates/code/core/src/sandbox/`（唯一执行权威）；**不**复活 `aster-confine` 为执行后端 |
| **现状** | ksandbox 执行路径 + fail-closed 文档；**P0-3 已落地**：`sandbox::permission_profile` 单一交集 API（Deny∩Mediated→Deny，空 Mediated 交集拒绝）+ 稳定 `sandbox.violation.*` 码，`bash` 预启动拒绝写 `metadata.sandbox_violation.code`；`aster-confine` 文档声明非执行权威。ACP bash rawOutput 已传 `sandbox_violation.code`（`docs/evidence/sandbox-violation-acp-wire-2026-11-16/`）。未做：ksandbox 原生 typed 违规、交集接入 grant 应用、effect 事实日志传播。证据：`docs/evidence/sandbox-permission-profile-2026-11-16/OUTCOME.md`（≠产品 Pass） |
| **可验证完成定义** | (1) 单一 profile/请求交集 API，失败不发明授权；(2) sandbox 违规可在 effect/ACP 观测到稳定事件码；(3) hermetic 或限定平台用例证明 deny；(4) 文档声明 confine stub 非执行权威 |
| **非目标** | 捆绑 Codex bwrap 二进制；CLI 内再引入 MicroVM/kbox |

### P0-4 · ACP / Core 协议实体与 schema 门禁

| | |
| --- | --- |
| **机制** | 清晰 Session/Task/Turn（或 Aster 等价）词汇；宿主协议与实现 crate 分离；schema/fixture 回归 |
| **Codex** | `codex-rs/docs/protocol_v1.md` · `protocol/` · `app-server-protocol/`（schema fixtures） |
| **Aster 落点** | `crates/code/acp`（wire）+ `crates/code/core/src/queue.rs`（lane）；可选独立 protocol types 模块，避免 UI 依赖 core 实现 |
| **现状** | ACP 已是 Core↔UI 边界；stdio conformance 强。非双邮箱 SQ/EQ；扩展方法命名有双缝。**P0-4 已落地**：`crates/code/acp/PROTOCOL.md` 钉死 Session/Prompt/Turn/Run 词汇与会话 turn 队列语义（Core `SessionLane` 不上线）；golden `tests/fixtures/acp_wire_surface_v1.json` 门住 28 个 host method 名、`_aster/queue/changed` 键集；conformance 增 `queue-running-identity`/`turn-queue-order`（15/15）。双缝（`__aster/execution/observe`）仅文档化未修；golden 非完整 JSON Schema；全量 acp 套件另有 9 项环境/未诊断失败。证据：`docs/evidence/acp-protocol-entities-2026-11-16/OUTCOME.md`（≠产品 Pass） |
| **可验证完成定义** | (1) 短文档钉死实体与队列语义（以 Aster 名为准）；(2) 至少一组 schema 或 golden fixture 防静默破线；(3) `acp_conformance_stdio`（或继任）绿且记入 evidence；(4) 不新增平行总线 |
| **非目标** | 把 ACP 换成 Codex Op 枚举；Studio 换皮 |

### P1-5 · Compaction 预算闭环（ledger）

| | |
| --- | --- |
| **机制** | 命名生命周期 + token/字节预算 + retained 输出 + pre/post hook 可观测 |
| **Codex** | `core/src/compact*.rs` · `context_manager/` |
| **Aster 落点** | `crates/code/core/src/compaction/` · `fact_control/compaction.rs` · `crates/effect` compose |
| **现状** | 已有 budget compact、standing AGENTS carry、ACP compact 路径。**P1-5 已落地**：`CompactionLedger` 命名生命周期（Open/Started/Completed）+ 可断言 pre/post 字段；`SessionCompact` 经 ledger 发 `AutoCompact` 并记 `carried_standing_lines`。证据：`docs/evidence/compaction-ledger-2026-11-16/OUTCOME.md`（≠产品 Pass） |
| **可验证完成定义** | (1) 单一 ledger API：compact 前后预算字段可断言；(2) soak 或 hermetic 证明超预算触发且 carry 保留；(3) OUTCOME 记 oracle，不写「看起来变短」 |
| **非目标** | 强制远程 summarizer 产品行为 |

### P1-6 · 分层 requirements / Constrained 配置桥

| | |
| --- | --- |
| **机制** | 用户偏好 vs 强制策略分层；键来源可追溯；非法值拒绝 |
| **Codex** | `codex-rs/config/` constraints · requirements layers |
| **Aster 落点** | `crates/acl` + `crates/code/core/src/config/loader.rs` · `workspace_trust.rs` |
| **现状** | ACL 分层与 trust strip 已强。**P1-6 已落地**：`config/forced_layer` 文档化强制覆盖 + 非法强制值失败 + provenance digest。证据：`docs/evidence/forced-layer-bridge-2026-11-16/OUTCOME.md`（≠产品 Pass） |
| **可验证完成定义** | (1) 文档化「强制层」如何覆盖用户层（含 trust）；(2) 非法强制值加载失败用例；(3) digest/来源可查询或可测；(4) 不引入第二套 JSON sidecar 配置真源 |
| **非目标** | 复制 requirements.toml 文件名；企业 MDM 产品面 |

### P1-7 · Verified edit/patch 管道加深

| | |
| --- | --- |
| **机制** | 解析 → 校验调用/上下文 → 应用；失败分型；dry-run/oracle 可测 |
| **Codex** | `codex-rs/apply-patch/` |
| **Aster 落点** | `crates/code/core/src/tools/builtin/{edit,write,patch}.rs`；与 `verification.rs` 职责分离 |
| **现状** | edit 精确替换 + patch unified-diff + CAS/`VersionConflict` 已有 |
| **可验证完成定义** | (1) 坏 hunk / 歧义上下文有稳定错误码；(2) hermetic 覆盖 CRLF/唯一性/批上限；(3) 不把「跑测试套件」塞进 patch 解析器 |
| **非目标** | 换成 Codex patch 语法作为唯一工具面 |

### P1-8 · Feature Stage（机制开关治理）映射到 capability

| | |
| --- | --- |
| **机制** | 枚举阶段（开发/实验/稳定/弃用）+ legacy 别名，避免散落 bool |
| **Codex** | `codex-rs/features/` |
| **Aster 落点** | `crates/code/core/src/capability/` + ACP `agentCapabilities` 投影 |
| **现状** | capability 投影强于裸 flag。**P1-8 已落地**：`capability/feature_stage` 静态 Stage 表 + legacy 别名 + 稳定 digest。证据：`docs/evidence/feature-stage-capability-2026-11-16/OUTCOME.md`（≠产品 Pass） |
| **可验证完成定义** | (1) 机制开关有 Stage 字段或等价表；(2) 弃用键有别名迁移测试；(3) 投影 digest 稳定可测 |
| **非目标** | 百分比远程放量平台；镜像 Codex 功能名单 |

### P2-9 · Hooks：收敛权威门点 + managed-only

| | |
| --- | --- |
| **机制** | 少量强制门点；管理钩子可要求；发现失败策略明确（fail closed where policy） |
| **Codex** | `codex-rs/hooks/` · `allow_managed_hooks_only` |
| **Aster 落点** | `crates/code/core/src/hooks/` |
| **现状** | 事件面很大。**P2-9 已落地**：`MANDATORY_HOOK_GATES` + managed-only 准入（用户钩子可忽略）。证据：`docs/evidence/hooks-managed-only-2026-11-16/OUTCOME.md`（≠产品 Pass）。发现失败全路径接线仍开。 |
| **可验证完成定义** | (1) 文档列出强制门点集合；(2) managed-only（或等价）下用户钩子被忽略的测试；(3) 不扩大事件枚举作为本项完成条件 |
| **非目标** | 钩子市场；事件枚举膨胀 |

### P2-10 · Elicitation 统一状态机

| | |
| --- | --- |
| **机制** | 协议优先的 pause/resume；并发 elicitation 不竞态投递 tool result |
| **Codex** | `core/src/elicitation.rs` · protocol approvals / request_user_input |
| **Aster 落点** | Core `permissions/interactive` + `ask_user*` + ACP `session/request_permission` / `aster/form/request`；pending → `crates/effect` |
| **现状** | **P2-10 已落地**：`elicitation` 统一三通道类型 + 并发不串 + cancel。证据：`docs/evidence/elicitation-state-2026-11-16/OUTCOME.md`；ACP `request_tool_permission` HITL 已挂 Permission ledger：`docs/evidence/acp-permission-elicitation-2026-11-16/`（≠产品 Pass）。 |
| **可验证完成定义** | (1) 一张状态图/类型覆盖上述通道；(2) 并发两请求 hermetic 不丢/不串；(3) cancel 路径 conformance 绿 |
| **非目标** | 统一成单一 UI 皮肤；审批记忆产品化（可另刀） |

### P2-11 · Skills 部分成功加载

| | |
| --- | --- |
| **机制** | 单 skill 失败不拖垮目录；根快照可缓存 |
| **Codex** | `codex-rs/skills/loading.rs` |
| **Aster 落点** | `crates/code/core/src/skills/` |
| **现状** | SKILL.md 注册/校验已有。**P2-11 已落地**：`load_from_dir_report` 枚举失败；坏+好同目录好 skill 仍可用。证据：`docs/evidence/skills-partial-load-2026-11-16/OUTCOME.md`（≠产品 Pass） |
| **可验证完成定义** | (1) 坏 skill + 好 skill 同目录时好 skill 仍可用；(2) 错误可列举；(3) 与 standing digest「技能树不进 digest」契约一致并写明 |
| **非目标** | 冻结技能树与现网「直播安装」设计对着干；合并 `.kstudio` 技能进 Core |

### P2-12 · 输出/持久化字节预算共享策略

| | |
| --- | --- |
| **机制** | 模型上下文与磁盘日志共用截断策略 + 可计量丢弃 |
| **Codex** | `utils/output-truncation/` · `rollout/src/policy.rs` |
| **Aster 落点** | effect 写入边界 + core tool output 路径（具体模块在实现刀选定） |
| **现状** | **P2-12 已落地**：`byte_budget` 共享 tool/effect 天花板 + `discarded_bytes` 可计量。证据：`docs/evidence/shared-byte-budget-2026-11-16/OUTCOME.md`（≠产品 Pass） |
| **可验证完成定义** | (1) 超限输出截断可测；(2) 持久化体积有上界断言；(3) OUTCOME 记丢弃计数或等价指标 |
| **非目标** | 遥测产品；改模型 API |

---

## 首批（已锁定 · 仍 ≠ Pass）

**已确认实现顺序：P0-1 → P0-2 → P0-3 → P0-4。**  
**续刀授权：P0–P2 全清单**（见 Decisions）。随后仅 HG3 发布水位（需用户授权）。  
每刀必须：落点路径单写、hermetic/限定平台证据、`docs/evidence/<slug>/OUTCOME.md`、禁止口头「像 Codex」。  
P0-1 完成 ≠ 产品 Pass；仅该机制 DoD 可勾。

---

## 权威对照（防双源）

| Prefer | Avoid |
| --- | --- |
| `crates/effect` 事实日志 | 旁路 session JSON 当真源 |
| `crates/code/core/src/sandbox` + ksandbox | `aster-confine` 执行、第二沙箱 |
| `crates/code/acp` wire | Core 内平行 SQ/EQ 总线 |
| `crates/acl` + config loader | 同键 JSON sidecar |
| `capability` 投影 | 散落 bool 第二总线 |
| `docs/evidence` + ACP/effect hermetic | 屏幕关键字 / 门禁绿 alone |

---

## 证据与扫描衔接

| 产物 | 路径 |
| --- | --- |
| B 扫描回执 | `.kstudio/evidence/T2026-11-16-codex-scan/OUTCOME.md` |
| B 候选详表 | `.kstudio/evidence/T2026-11-16-codex-scan/CANDIDATES.md` |
| D 本清单 evidence | `.kstudio/evidence/T2026-11-16-codex-absorb/OUTCOME.md` |
| 本 wiki 页 | `.kstudio/wiki/Codex-Aster-Absorption.md` |

---

## Explicitly not claimed

- 产品 Pass / 日常稳定使用水位  
- 与 Codex 功能对等  
- wave-locked 清单本身 ≠ 机制已落地（落地以各 P0 DoD + evidence 为准）  
