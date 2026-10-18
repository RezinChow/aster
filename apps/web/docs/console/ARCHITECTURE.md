# Kense OS — 技术架构与功能架构

| 字段 | 值 |
| --- | --- |
| 地位 | **权威**（Architecture Canon · 产品分层与功能架构） |
| 范围 | Kense OS 平台（控制面 + 运行时）；不含行业业务方案实现 |
| 对照 | [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md) · [INTERFACE-FULL-LINK.md](./INTERFACE-FULL-LINK.md) · [PRINCIPLES.md](./PRINCIPLES.md) · [prd/00-master.md](./prd/00-master.md) · 官方 `a3s-os` 文档 |
| 状态 | Design target v1（随决策修订） |
| 冲突 | **控制面所有权 / 管理面≠数据面** → [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md)；其余产品分层与 Console 功能 → 本文 + PRINCIPLES |

---

## 0. 第一性原理

1. **OS 是控制面与耐久运行时，不是业务系统。**  
   行业闭环（产前预测、态势研判 UI、交易执行等）由 **解决方案（如 Kense Monitor）** 或 **OEM** 实现；OS 只提供可编排、可授权、可计量、可审计的原语。

2. **模型 / Provider 可替换；契约不可碎。**  
   产品真相是 Scope、Grant、Route、Flow、Workload、Listing Entitlement；不是某一个 LLM 或某一个上游 API。

3. **一切昂贵调用过同一咽喉（Gateway）——仅指数据面。**  
   模型、工具（MCP）、Agent↔Agent、市场 Listing 调用均经 Gateway；策略在执行点强制。  
   **管理面**（Console / CLI / Management MCP）走控制面 API（**a3s-cloud** 为主，a3s-api 仅扩展域），**不是**经 Gateway 做 CRUD。详见 [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md)。

4. **一把 Capability Key 接入全部 OS 能力；客户端不限 Work。**  
   任意兼容客户端（**Kense Work**，以及 Claude Code、Cursor、自研/第三方智能体等）只配置 **一个** API Key + Gateway baseURL，即可调用已开通的模型、检索、解析、方案 API 与市场 Listing。Work 是一等参考客户端，**不是**唯一消费者。禁止「每 Provider 一把 Key」或客户端内嵌多上游凭证。Key 的可调用集合 = Entitlement ∩ Grants ∩ InferenceAccess（由 **a3s-cloud** 编译，Gateway 执行）。

5. **期望状态与执行分离；单一控制面所有者。**  
   Console / CLI / MCP 提交意图；**a3s-cloud** 持久化平台期望态；Fleet / Runtime / Box 收敛；Audit / Operation 留证。浏览器与 **a3s-api** 不实现重试、调度、授权判定，也不复制 Route/Workload/Grant 权威。

6. **规模 ≠ 常驻。**  
   Agent / Listing 目录可极大；活跃集由订阅、配额、优先级与开通集合收敛。

7. **Work 完成本地工作；OS 沉淀组织能力。**  
   只改本机文件 → Work 足够；跨会话一致性、审批、定时器、团队发布、私有化机群、统一能力调用 → OS。

---

## 1. 产品分层（功能边界）

```text
┌─────────────────────────────────────────────────────────────┐
│  OEM / 客户应用                                              │
│  （行业工作台、白标门户、业务对象与 KPI）                      │
├─────────────────────────────────────────────────────────────┤
│  Kense 解决方案（官方）                                       │
│  Monitor · Finance · Science · Insight · …                  │
│  ※ 消费 OS；可登记为 Marketplace Provider                     │
├─────────────────────────────────────────────────────────────┤
│  Kense Work          │  Kense OS（本架构文档主体）            │
│  local-first 入口    │  控制面 · 耐久编排 · Gateway · Fleet   │
├─────────────────────────────────────────────────────────────┤
│  基础设施：计算 · 存储 · 网络 · GPU / Box · 私有化安装         │
└─────────────────────────────────────────────────────────────┘
```

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| **Kense OS** | Identity、Flow、Agent、Inference、Marketplace、Supply、Fleet、Usage、OEM 渠道运营面；编译 Key 可调用集合 | 行业本体、地图研判、下单交易、业务审批字段语义 |
| **Kense Work** | 一等使用客户端：一把 Capability Key 经 Gateway 使用全部已开通能力 | 安装级机群治理；逐家上游开户；排他占用 Gateway |
| **其它智能体 / IDE** | 同契约消费者：同一把 Key + Gateway，调用同一开通集合 | 改写授权/计量；绕过 Gateway |
| **解决方案** | 场景数据包、垂直 Agent 配置、方案 UI | 第二套控制面 |
| **OEM** | 客户交付、白标、行业集成 | 改写 OS 授权引擎 |

**已定决策摘要：**

| 决策 | 结论 |
| --- | --- |
| 渠道 | **仅 OEM**；不做省/市地理代理 |
| 推理商业壳 | **无** Token Hub / Token Plan；outcomes 落入 Inference + Usage |
| 能力聚合 | **Marketplace**：World Monitor、Polymarket、AIsa 等均为 Provider |
| Monitor | **解决方案**，不是 OS 内核模块 |
| **使用入口** | **Gateway + 一把 Capability Key**；**Work 与其它智能体**均可接入同一开通集合 |

---

## 2. 技术架构

### 2.1 控制面主路径（管理面 ≠ 数据面）

所有权总表与迁移护栏见 [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md)。  
请求路径与本地 Gateway 开发咽喉见 [INTERFACE-FULL-LINK.md](./INTERFACE-FULL-LINK.md)。摘要：

```text
Management plane
  Console · CLI · Management MCP
        │
        ├─► A3S Cloud API     ← OS 期望态权威（唯一控制面）
        └─► a3s-api         ← 仅通讯录 / Member / 安装配置 / 过渡供给便利
        │
        ▼ 编译 Grant · Route · Entitlement · Workload 期望态
Data plane
  Work / IDE / Agent  ── Capability Key ──►  Kense Gateway
        │  限流 · 策略强制 · Usage 归因
        └── Model / Tool / A2A / Market Listing（不代理管理面 CRUD）
Runtime plane
  Workloads ──► Fleet Claims ──► Runtime / Box · 回执
        ▲
        └── Edge 快照（意图 vs 已应用）由 Cloud 编译、Gateway 安装
```

### 2.2 平面职责

| 平面 | 技术职责 | 权威存储（概念） | 所有者 |
| --- | --- | --- | --- |
| **Management API** | 期望态提交与查询（Org 资源、Deploy、Route 修订…） | PostgreSQL 聚合 + Outbox | **a3s-cloud** |
| **Directory / Member API** | 通讯录 · 前台账户 | a3s-api 表 | **a3s-api**（扩展） |
| **Gateway（数据面）** | 昂贵调用咽喉；Model / Tool / A2A / Market | 已应用路由快照 · 限流 · ledger 写入点 | Gateway + Cloud 编译输入 |
| **Identity（资源）** | Principal · Membership · Grant · Credential | 授权判定真相 | **a3s-cloud** |
| **Identity（人）** | Department · 通讯录 User · Member | 人的组织 | **a3s-api** → SubjectLink |
| **Operations / Flow** | 耐久工作流、定时器、审批、取消与重放 | journal / 期望状态 | **a3s-cloud** |
| **Product runtimes** | Agent loop、Function 调用、Cell fence | Run / Checkpoint | **a3s-cloud**（车道可延期） |
| **Inference** | 路由修订、护栏、用量账本；serving 协作 Box/Power | 不可变 policy revision | **a3s-cloud** |
| **Marketplace adapters** | 上游同步；开通编译进 Cloud | Provider · Listing | 体验可在 Kense；编译在 Cloud |
| **Supply** | Source → Artifact → 晋级 | digest · 签名 | **a3s-cloud**（kense 拉取仅为过渡） |
| **Fleet / Runtime** | 节点、Claim、排水、Box | 期望副本 + 观测 | **a3s-cloud** |
| **Ops** | Audit、Usage showback、Notification | 证据与计量投影 | **a3s-cloud** |
| **Console** | IA · Dashboard 聚合 | 无业务权威 | Kense `apps/web` |

### 2.3 调用与计量（Capability Plane）

**产品不变量：** Work（及其它智能体）用户感知为「配一次 Key」；实现上该 Key 是 Identity 凭证，经 Gateway 访问 **全部** 已开通能力（model · search · parse · 方案 API · 其他 Listing）。

```text
Kense Work（一等客户端）
其它智能体 / IDE / SDK（同契约）
  仅持有：Gateway baseURL + 一把 Capability Key
        │
Capability Key
    │  可调用集合 = Entitled Listings ∩ Grants ∩ Inference Access
    ▼
Gateway ──┬── kind=model  → Inference Route → Provider
          └── POST /v1/services/{kind}/invoke/{sku} → Adapter / Provider
                sku = 不透明 listing id；后端按 sku 转发
                input = snake_case；上游字段仅在 Runtime 映射（见 [SERVICE-INVOKE.md](./SERVICE-INVOKE.md) · [SERVICE-DEV.md](./SERVICE-DEV.md)）
          └── kind=skill → Registry 安装物 + 运行时绑定
    │
    └── Usage ledger（Provider × Listing × Principal × Scope）
```

- **禁止：** Work/客户端保存多把上游 Provider Key；「每模型一家控制台」。  
- **标价**：目录展示 + Gateway 计量；**无** Console 钱包/充值。  
- **硬顶**：Key/Env spend cap；触顶拒绝并应能取消 in-flight Flow/Run。  
- **AIsa**：作为 Provider（目录代理或 SKU allowlist），用户仍只持 **Kense** Key。
- **商品规范：** 调用面 [SERVICE-INVOKE.md](./SERVICE-INVOKE.md)；上架/adapter [SERVICE-DEV.md](./SERVICE-DEV.md)。

### 2.4 部署形态

| 形态 | 说明 |
| --- | --- |
| Managed | 平台托管控制面 + Gateway |
| BYOC / 私有化 | 同契约；Fleet 落客户机群；数据面可不出境 |
| Work 对齐 | 本地会话与 OS 共享身份与对象语义（非第二授权引擎） |

---

## 3. 功能架构（Console / 管理面模块）

管理面按 ActivityBar 组织。现行四域是运营、研发、平台、设置，实现以 `destinations.ts` 为准。历史「八域」「五域」文案已退出。**域切割不改变控制面所有权**（见 [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md)）。

对齐控制面分层（这是所有权分层，不是侧栏轨道）：

```text
Scope → Identity → Product(编排) → Capability(市场+推理) → Supply → Runtime → Ops
                                                              └─ Commercial
```

| Activity 域 | 侧栏模块 | 功能摘要 | PRD |
| --- | --- | --- | --- |
| 运营 | 概览；客户 · 渠道商 · 供应商；商品 · 订单 · 订阅 · 工单 | 总览与商务、业务 | 00 · 05 · 07 |
| 研发 | 代码仓库 · 资源仓库 · 包/镜像/模型仓库 | 构建与制品目录 | 02 · 03 |
| 平台 | 平台仪表盘；工作流 · 函数 · 智能体 · 耐久单元 · 推理；网关 · 集群；拓扑 · 总线 · 队列 · 日志 · 用量；成员 · 职位 · 角色 | 运行、观察、企业目录 | 01 · 02 · 04 · 05 · 06 |
| 设置 | 通用 · 行政 · 分类 · 配置 · 开发者 | 本次启动与安装侧配置 | 00 |

**Registry vs Marketplace：**

| | Registry | Marketplace |
| --- | --- | --- |
| 对象 | 可安装制品（Skill 包、Connector…） | 可调用要约（Listing） |
| 动作 | 安装到 Env | Entitlement 开通 |
| 计量 | 间接（运行时） | 直接（按次/token 归因） |

---

## 4. 与解决方案 / 外部 Provider 的关系

```text
World Monitor ──┐
Polymarket    ──┼── Provider 适配器 ──► Marketplace Catalog
AIsa          ──┤                         │
模型商 / MCP  ──┘                         ▼
                                   Entitlement → Gateway
```

- **Kense Monitor（方案）** 可同时：提供方案 UI + 作为 Market Provider 输出 MCP/REST。  
- **OS 不内嵌** Monitor 地图、情报 Brief、Polymarket 交易台。  
- **OEM** 经 Channels 白标；目录可按渠道过滤。

一等平台服务（模型网关 · 联网检索 · 文档解析）与方案 API 的**运营差距**见 [PLATFORM-SERVICES-GAPS.md](./PLATFORM-SERVICES-GAPS.md)。  
与 **a3s-use** 对齐的统一网关 / 双轨市场 / 计量·计费拆分见 [USE-GATEWAY-MARKET-BILLING.md](./USE-GATEWAY-MARKET-BILLING.md)。  
**平台仪表盘（CTO）应具备的视图**见 [PLATFORM-DASHBOARD-VIEWS.md](./PLATFORM-DASHBOARD-VIEWS.md)。

---

## 5. 文档权威与过时清理

### 5.1 读什么（权威序）

1. [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md) — **控制面所有权** · 管理面≠数据面 · a3s-api vs A3S Cloud  
2. [ROADMAP.md](./ROADMAP.md) — **研发交付波次**（R0–R8 / Rx）；旧 PRD M0–M5 仅作映射  
3. **本文** — 产品分层 + Console 功能架构  
4. [PRINCIPLES.md](./PRINCIPLES.md) — Console 设计不变量与 ActivityBar IA  
4b. [IDENTITY.md](./IDENTITY.md) — **Member / User**；**用户与组织**（部门树 · 用户挂靠 · 管理员角色）  
5. [SIDEBAR.md](./SIDEBAR.md) — 侧栏叶子晋升/拒绝  
6. [USE-GATEWAY-MARKET-BILLING.md](./USE-GATEWAY-MARKET-BILLING.md) — Gateway · 双轨市场 · L1/L2 计费  
7. [PLATFORM-SERVICES-GAPS.md](./PLATFORM-SERVICES-GAPS.md) — Work/市场/方案 API 运营缺口  
7b. [PLATFORM-DASHBOARD-VIEWS.md](./PLATFORM-DASHBOARD-VIEWS.md) — **平台仪表盘（CTO）视图规范**  
8. [prd/00-master.md](./prd/00-master.md) + 分册 `01`–`08` + `wireframes/`（**屏幕规格**；开工顺序见 ROADMAP）  
9. 官方 MDX — 对外叙述；细节以 1–8 为准  
10. Cloud 对偶声明 — `apps/cloud/docs/a3s-os-boundary.md` · 闸门只读 `apps/cloud/ROADMAP.md`

**双轴：** P0–P4 / 06–08 = **交付切片**；ActivityBar 域 = **导航**（`destinations.ts` 的四域）。勿把交付编号当侧栏一级结构（见 [README.md](./README.md)）。导航域切割**不得**覆盖控制面所有权裁定。

### 5.2 已废弃 / 勿再扩展

| 文档 / 表述 | 处理 |
| --- | --- |
| `apps/web/WIREFRAMES.md`（旧 W0–W12：`/identity`、`/policies`、无市场/渠道） | **指针 stub**；勿再写正文 |
| 「Kense Word」产品名 | **禁止**；客户端产品仅为 **Kense Work**（+ 其它智能体同契约） |
| Token Hub / Token Plan 产品壳 | **禁止**；仅保留 outcomes 映射（PRINCIPLES §7） |
| 省/市地理代理渠道 | **禁止**（prd/07） |
| 行业业务模块写入 OS PRD / 侧栏 | **禁止**；属方案/OEM |
| 市场页内「已开通」Tab **与** 侧栏 `/marketplace/entitled` 双权威 | **禁止双入口**；已开通 = **仅侧栏叶子** |
| Agent 审批另栏 + Flow HumanTask 另栏 | **禁止**；统一 `/tasks` |

### 5.3 设计目标 vs 代码缺口（已知）

| 设计已有 | 代码/导航待对齐 |
| --- | --- |
| Marketplace IA + PRD 08 | 导航已挂 `/marketplace` · `/marketplace/entitled`；页按 PRD 深化 |
| 智能体商品 × 模型商品分轨 | 规划见 [AGENT-MODEL-PRODUCT-PATH.md](./AGENT-MODEL-PRODUCT-PATH.md)；Harness `models[]` 仍空、Ops agent 仍 fixture |
| Channels OEM | 已有 List/Detail/向导（以仓库为准） |
| Inference 深化 06 | 页存在程度以实现为准；交互以 PRD 验收 |
| 统一 `/tasks` | 导航已有；Agent/Flow 双 inbox UX 不得回流 |

缺口跟踪以实现任务为准；**不以已退役的 `apps/web/WIREFRAMES.md` backlog 为准。**

---

## 6. 非目标（架构级）

- OS 内实现垂直业务系统（预测引擎业务公式、态势作战室、交易执行台等）  
- **第二控制面**（含把 a3s-api 做成与 A3S Cloud 并列的 Route/Workload/Grant 权威）或浏览器侧权威配额/授权  
- 充值钱包、供应商结算台、Token Hub 品牌导航  
- Console 代理上游请求体或私自重试计费  
- 用 Gateway 替代管理面 API，或用管理面 API 转发昂贵调用 body  

---

## 7. 修订规则

- 新增一等模块：先改本文 §3 与 PRINCIPLES IA，再补 PRD/线框，最后改 `destinations.ts`。  
- 与官方营销文案冲突：改 MDX 对齐本文，不在营销页发明控制面实体。  
- 解决方案新增 Provider：只增 Marketplace 模板与适配器说明，不增 OS 业务导航。
