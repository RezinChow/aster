# 智能体商品 × 模型商品 — 第一性优化路径

| 字段 | 值 |
| --- | --- |
| 地位 | **规划**（对照 Canon；非 Verified 闸门） |
| 范围 | 智能体商品上架 → 运行时消费模型商品 |
| 上级 | [ARCHITECTURE.md](./ARCHITECTURE.md) · [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md) · [prd/08-marketplace.md](./prd/08-marketplace.md) · [apps/cloud/docs/agent-runtime-architecture.md](../../../cloud/docs/agent-runtime-architecture.md) |
| 状态 | Decision draft v1.1（2026-09-20） |
| 冲突 | 与 Canon 冲突时：**Canon > 本文**；本文不得把 Console fixture 写成生产闭环 |

---

## 0. 第一性公理（排序用）

摘自控制面 Canon + 能力市场 PRD + Agent Runtime 架构，不可颠倒：

1. **一个可变不变量一个所有者** — 商品要约、开通、Harness 绑定、Inference 路由各有唯一写者；Console 永不持真相。
2. **管理面 ≠ 数据面** — 上架/开通是期望态；模型调用只经 Gateway + Capability Key（或 Harness 经同一编译策略 egress）。
3. **可安装 ≠ 可调用** — 「智能体商品」是编排/席位/Release 意图；「模型商品」是 Gateway Listing（可计量调用要约）。不得揉成一种 MarketListingKind。
4. **期望态 ≠ 执行** — Ops 目录「已上架」≠ AgentRelease 已部署 ≠ Harness 已绑 `ModelRevision` ≠ Gateway 已放行。
5. **假绿禁止** — fixture / preview / `models: []` 不得标成「智能体已依赖模型商品」。
6. **不复制机制** — 不在 Console 做第二套授权；不在 Agent 进程直持上游 Provider Key 绕过 Inference/Gateway。

---

## 0.1 决策冻结（P0 ADR）

| 决策 | 裁定 |
| --- | --- |
| `MarketListingKind` 是否增加 `agent` | **否**。保持 `api \| tool \| model \| feed`（见 `market_listing.rs`；`skill` 已移出商品，归能力扩展）。 |
| 智能体如何「上架」 | Ops/编排商品壳或 Cloud `AgentRelease` / Application 绑定；**不是** Inference PublishMarketListing。 |
| 智能体如何「用模型」 | Harness `models[]` 钉死 `ModelRevision` + Env 开通对应 model Listing；egress 服从 Gateway/编译策略。 |
| Console fixture | 仅 preview；不得标 Verified / 不得暗示双写成功。 |

违反本表的实现 PR：**拒收**（与公理 3、5 冲突）。

---

## 1. 产品本体（必须先钉死）

```text
┌─ Ops / 编排商品（商用壳 · 席位/许可）─────────────────────┐
│  Agent SPU / Application                                  │
│  所有者目标：Cloud Assets AgentRelease · Apps              │
│  今日：Console /market/agents fixture（可 listing-only）   │
└───────────────────────────┬───────────────────────────────┘
                            │ 声明「运行时需要哪些可调用能力」
                            ▼
┌─ 能力市场 Listing（可调用 · 可计量）──────────────────────┐
│  kind = model | tool | api | feed                         │
│  所有者：Cloud Inference MarketListing + Entitlement      │
│  执行：Gateway + Capability Key / Harness egress          │
└───────────────────────────────────────────────────────────┘
```

| 概念 | 是 | 不是 |
| --- | --- | --- |
| 智能体商品 | 可售卖/可安装的编排产物（席位、Release、App） | Gateway 上的 `POST …/invoke/{sku}` Listing |
| 模型商品 | 能力市场 `kind=model` Listing | Agent 进程内的「默认模型名字段」 |
| 依赖关系 | Agent **引用** Model Listing / `ModelRevision`（精确钉死） | 把 Agent 塞进 `MarketListingKind` |
| Work / IDE 智能体 | 数据面**客户端**（一把 Key） | Ops「智能体商品」本身 |

### 1.1 现状证据锚点（可复查）

| 断言 | 权威路径 |
| --- | --- |
| Listing kind 无 `agent` | `apps/cloud/.../inference/.../market_listing.rs` → `MarketListingKind` |
| Harness 契约含 `models[]` | `apps/cloud/crates/contracts/.../invocation.rs` → `HarnessModelBindingV1` |
| Producer 仍空绑定 | `apps/cloud/.../agent_execution_flow/binding.rs` → `models: Vec::new()` |
| Console 智能体可无制品上架 | `apps/web/src/data/createProductKindSchema.ts` → `agent.sourceMode: 'optional'` |
| 能力市场 PRD 不含 agent kind | `apps/web/docs/console/prd/08-marketplace.md` |

---

## 2. 现状断层（因果链）

按严重度；每环是下一环的原因：

```text
① 两套「市场」同名异物
   Ops /market/agents（商品壳）≠ 能力 /marketplace（Listing）
        │
        ▼
② Console fixture 持智能体上架真相；Cloud 无 agent Listing
        │
        ▼
③ 买方开通集合不含 Agent；Entitlement/Key 只覆盖可调用 kind
        │
        ▼
④ Agent Runtime Harness.models 空；靠 Provider Secret 旁路调模
        │
        ▼
⑤ 「智能体运行时需要模型商品」在产品叙事成立，在控制面未闭合
```

| # | 缺陷 | 违反公理 | 今日表现 |
| --- | --- | --- | --- |
| D1 | Ops 智能体目录与能力市场混谈 | 3、5 | UI/文案易暗示「上架即可调」 |
| D2 | 智能体上架权威在浏览器 fixture | 1、4 | 刷新/换机漂移；无 Audit/Operation |
| D3 | listing-only Agent 无 Release/Workload | 4 | 可卖不可跑 |
| D4 | Harness 未生产 `ModelRevision` 绑定 | 2、6 | `models: []`；直连上游风险 |
| D5 | 两条调模故事未合并 | 2 | Work+Key vs Agent+Secret 平行 |

---

## 3. 目标闭环（证伪形状）

生产上「智能体要用模型商品」成立，当且仅当下列全部为真：

```text
Cloud AgentRelease（或 App 绑定的 Release）
  → Workload 期望态声明 required model bindings
  → HarnessInvocationProfile.models[] 非空且 digest 钉死
  → 每次模型 egress：Env 已开通对应 model Listing
       ∩ InferenceAccess / Route
       ∩（Gateway 或等价编译策略强制）
  → Usage 归因到 Listing × Principal × Scope
  → Console 只投影上述事实（失败闭合，不本地 invent）
```

**反例（不合格）：** Console 显示「已绑定模型」但 Harness.models 仍空；或 Agent 用 vault 上游 Key 调模且无 Listing/Usage。

---

## 4. 优化路径（P0 → P3）

因果链不可颠倒：**先本体与权威，再绑定生产，再开通强制，最后收敛 Console 壳。**

### P0 — 钉本体 + 去假绿（不写新业务权威）

| 做什么 | 为什么 | EXIT |
| --- | --- | --- |
| 文档/IA：Ops「智能体商品」与能力「模型 Listing」分栏叙事 | 公理 3 | 本文已挂 README + ARCHITECTURE；侧栏不混称「市场」 |
| Console：智能体创建/详情标明「编排商品 · 非 Gateway SKU」；依赖模型为「声明」非「已开通」 | 公理 5 | UI 无「一键可调模型」暗示；preview 角标保留 |
| 冻结错误方向：不把 `agent` 加进 `MarketListingKind` | 公理 3 | §0.1 决策表；PR 拒收扩 kind |

**P0 首个可执行切片（实现时改这些，不另开权威）：**

- Console 商品目录（`/admin/products`、`MarketCatalogPage`、`MarketProductPage`）已删除，不再作为这个切片的落点。

**明确不做（P0）：** 假接通 Cloud PublishMarketListing(agent)；扩大 fixture 假装多租户。

### P1 — Cloud：Harness 模型绑定生产（控制面真相）

| 做什么 | 为什么 | EXIT |
| --- | --- | --- |
| Workload / AgentRelease → 填充 `HarnessModelBindingV1`（`modelId` + `modelRevisionId` + digest） | 公理 1、4 | `binding.rs` 不再 `models: Vec::new()`；契约测试证明非空路径 |
| 依赖 Inference `ModelRevision` / I0.2a 可引用 revision | 供给真相在 Inference | 绑定失败 fail closed（无 revision 不开跑） |
| Function Tool 已落地的 binding 模式复用，不新开调度器 | Agent Runtime §2 | 无第二套 AgentRuntime 聚合 |

**阻塞：** Inference 精确 revision 供给未就绪则 P1 不可标 Verified。

### P2 — 数据面：模型 egress 服从开通

| 做什么 | 为什么 | EXIT |
| --- | --- | --- |
| Agent 调模走 Gateway Listing SKU **或** 同一 Entitlement∩InferenceAccess 编译结果 | 公理 2、6 | 无 Listing 开通 → 执行拒绝；有 Usage 行 |
| 禁止 Agent 运行时以「仅有上游 vault Key」作为唯一成功路径（ops 兜底须标注） | 公理 6 | 策略开关 + 审计；默认 fail closed |
| Env 开通模型 Listing 与 Agent 依赖声明对齐（缺依赖 = 部署/启动闸门） | 公理 4 | Operation 可见；Console 投影缺口 |

### P3 — Console 壳收敛到 Cloud 投影

| 做什么 | 为什么 | EXIT |
| --- | --- | --- |
| `/market/agents` 读 Cloud AgentRelease / App 绑定，写经 Cloud API | 公理 1 | fixture 降级为「未接线预览」或删除写路径 |
| 创建智能体商品时可选绑定已上架 **model Listing**（存为期望依赖，非本地 entitlement） | 目标闭环 | 保存产生 Cloud 期望态 + Operation |
| 研发路径 `/eng/agents`：制品 → Release → 依赖校验 → 部署 | 公理 4 | listing-only 不可进入「可运行」态除非显式草稿 |

---

## 5. 与现有车道对齐（避免另起炉灶）

| 本路径步骤 | 挂靠既有权威 | 勿做 |
| --- | --- | --- |
| P1 模型绑定 | Agents Harness + Inference ModelRevision | 新 `AgentModelService` 表 |
| P2 egress | Gateway · EntitlementCompile · InferenceAccess | Agent 进程直连 Provider HTTP 当真 |
| P3 Console | Cloud REST 投影 | a3s-api 复制 AgentRelease |
| 商用席位 | Ops 商品壳 / Customers 投影 | 能力市场 SKU 计席位 |

---

## 6. 非目标

- 把智能体做成 Gateway `kind=agent` 的 invoke SKU（与「一把 Key 调能力」正交且破坏本体）
- Console 本地 Entitlement 集合冒充 Cloud 编译
- Token Hub / 钱包 / 每 Provider 一把客户端 Key
- 在未完成 P1 前宣称「智能体运行时已使用模型商品」
- 多节点共享、完整 I0 分布式推理（不挡 P0–P2 形状，但是更后闸门）

---

## 7. 建议执行序（一季度形状）

```text
Week 0–1   P0 叙事与 UI 去假绿 + §0.1 决策冻结生效
Week 2–6   P1 Harness models producer（跟 Inference revision 供给）
Week 6–10  P2 egress 强制 + Usage；依赖闸门
Week 10+   P3 Console 写路径迁 Cloud；fixture 退役
```

每阶段 EXIT 未满足：**不进入下一阶段**；不把「文档写了」或「UI 能选模型下拉」当作 P1/P2 完成。

---

## 8. 验收清单（本规划文档）

- [x] 公理与 Canon 对齐（§0）
- [x] 决策冻结：禁止 `agent` Listing kind（§0.1）
- [x] 本体：可安装 Agent ≠ 可调用 model Listing（§1）
- [x] 现状证据锚点可复查（§1.1）
- [x] 现状断层因果链可证伪（§2）
- [x] 目标闭环反例明确（§3）
- [x] P0–P3 含 EXIT、首切片路径与非目标（§4–§6）
- [x] 挂靠既有 Cloud 车道，不另起控制面（§5）
- [ ] P0 UI 去假绿实现（属执行，非本规划交付）
- [ ] P1–P3 控制面/数据面实现（属执行，非本规划交付）
