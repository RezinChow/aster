# Kense OS × A3S Use — 统一网关 · 能力市场 · 计费

| 字段 | 值 |
| --- | --- |
| 地位 | 架构决策附录（服从 [ARCHITECTURE.md](./ARCHITECTURE.md) · A3S `platform-capability-architecture` · `a3s-use-component-platform`） |
| 问题 | 如何在 **不复制机制** 的前提下，让 OS 同时提供：统一网关、类 AIsa 能力市场、可运营的计费/用量体系 |
| 输入 | A3S Cloud / Use：Use 包生命周期；Cloud TokenHub/OpenShift **outcomes**；Gateway 唯一入口 |

---

## 1. 第一性原理（合并 A3S 与 Kense）

来自 A3S Cloud / Use 的不可违反约束：

1. **一种能力一种权威** — 不新增第二套 Gateway、Identity、Usage ledger、调度器。  
2. **Gateway 只执行、不管理** — 请求路径执行冻结计划；管理聚合在 Inference / Identity / Market / Edge。  
3. **Use 管供给生命周期，不管计费与路由策略** — 签名包、generation、Grant 规划、snapshot lease；不拥有部署/身份/存储/账单权威。  
4. **用量账本 ≠ 商业结算** — Inference（可扩展为 Capability）ledger 是计量真相；余额/充值/开票在**外部商业服务**，只消费导出、禁止回写 ledger。  
5. **原子世代优于热改** — 包/能力以 N→N+1 发布；旧 Run 持 N 租约；新 Run 见 N+1。

Kense 已定补充：

6. **OS ≠ 业务系统**；方案 API（如 Monitor）以 **Provider** 入市。  
7. **Console 只投影**；无 Token Hub / Token Plan 壳。  
8. **接入契约 = Gateway + 一把 Capability Key**；**Kense Work** 为一等客户端，其它智能体/IDE 同契约接入。开通与限额在 Console/控制面；客户端不持有多上游密钥。

---

## 2. 三个「能力」不要捏成一个产品

业界与 A3S 里常被混称的「能力市场」，在机制上是 **两条供给轨**：

| 轨 | 类比 | 对象 | 生命周期权威 | 调用时发生什么 |
| --- | --- | --- | --- | --- |
| **A. 可安装认知包** | **a3s-use** | Tool/MCP/Skill/Flow/OKF/UI 包 | Use：resolve→lock→apply→capability generation | Host 投影进 Session；Run 持 snapshot lease |
| **B. 可调用在线要约** | **AIsa / TokenHub 目录** | Model/Tool/API/Feed Listing | Marketplace：Provider→Listing→**Entitlement** | Gateway 按 Key∩Entitlement∩策略转发并计量 |

```text
                    ┌─ A. Use 包（Registry / a3s-use）──► 安装 · 世代 · Session 投影
 「能力」需求 ──────┤
                    └─ B. Market Listing ──────────────► 开通 · Gateway 调用 · Usage
```

**禁止：** 用 Market UI 直接 `a3s-use apply` 当第二安装器；或让 Use 包声明自己的公网路由/密钥/账单。  
**允许：** Skill Listing **深链** Registry 包；开通 skill 可触发「需安装」状态机（仍走 Use/Plugin Manager 单一突变路径）。

---

## 3. 统一网关（怎么提供）

### 3.1 对齐 A3S

```text
Identity credential + Grants
  → Inference / Market 编译的不可变有效策略 + Entitlement 集合
  → Edge complete snapshot
  → Gateway：鉴权 · 协议校验 · 限额 · 冻结候选/回退 · 护栏
  → 本地 Power / 外部 Provider / MCP·Tool 适配器 / 方案 API
  → prompt-free 请求事实 → Usage ledger
```

Gateway **唯一公网入口**，覆盖：Inference 协议、Market Listing 调用、Agent/Flow/Function/MCP、方案 API 代理。

### 3.2 Kense 运营面落点

| 机制 | 权威 | Console |
| --- | --- | --- |
| 路由/回退/护栏 | Inference 修订 | 能力 → 推理 |
| Entitlement 集合 | Marketplace | 能力 → 市场 / 已开通 |
| Key 身份 | Identity | 推理密钥 ≡ Capability Key |
| 入口快照 | Edge | 运行 → 网关 |
| 执行与限流 | Gateway | 无独立「网关策略编辑器」重复 Inference |

### 3.3 与 a3s-use / Work 的衔接

- HTTP MCP / Tool Service：仅当 **Runtime + Gateway 返回 typed readiness** 才准入；缺省 fail-closed。  
- 包内 stdio MCP：本地 launcher；**不**经公网 Gateway（计量策略另议）。  
- **Work 及其它客户端：** 用户侧接入物是 **一把 Capability Key**；Connect 片段写入 `baseURL` + `api_key`（Work / Claude Code / Cursor / 自研 Agent 等同契约），不引导用户去各 Provider 开户。

---

## 4. 能力市场（怎么提供）

### 4.1 产品形态（Kense）

沿用 [prd/08-marketplace.md](./prd/08-marketplace.md)：Provider · Listing · Entitlement · Quote · Capability Key。

### 4.2 用 a3s-use 补「安装型」半边，而不是重做 Use

| Market 需求 | Use 已解决 | OS/Cloud 仍要做 |
| --- | --- | --- |
| 签名、依赖、世代、回滚 | Use 包 saga | Cloud **U0** 赋值/投影；Console Registries 运营 |
| 工具进 Agent 会话 | Host `SessionCapabilityBatch` | Work/Code Host 关闭环路 |
| 在线 API 目录与开通 | **Use 不管** | Marketplace + Gateway 适配器 |
| 一钥多资源 | Identity credential | Key 策略编译进 Gateway 快照 |

### 4.3 推荐领域模型（一张图）

```text
Installation
  ├─ Use Registry（信任根 · 包目录）          ← a3s-use 对齐
  │     └─ PackageGeneration → Host 投影
  └─ Market Provider Catalog                 ← AIsa 对齐
        └─ Listing → Org/Env Entitlement
Identity.CapabilityKey
  └─ 可调用 = Entitlement ∩ Grants ∩ InferenceAccess
Gateway
  └─ 执行 + 计量事实
UsageLedger（Capability，含 model/tool/api）
CommercialBillingService（外部）
  └─ 读导出 · 写余额/发票 · 禁止写 Ledger
```

### 4.4 Provider 类型（运营分类）

| 类型 | 例 | 供给方式 |
| --- | --- | --- |
| 模型商 | OpenAI、本地 Power | Inference Provider + 可选 model Listing |
| 平台一等 | `search.*`、`parse.document` | A3S-hosted Listing + Workload |
| 方案 API | Monitor、Polymarket | Solution Provider 同步 MCP/OpenAPI |
| 元聚合 | AIsa | `aisa-proxy` 适配器 + SKU allowlist |
| 认知包 | use 扩展 | Registry；Market 仅发现/深链 |

### 4.5 自部署 Power 与外部 Provider（同一管线）

外部 SaaS Provider 与租户自部署 Power **共用** EntitlementCompile → Edge 快照 → Gateway 强制 → L1 Usage；差异只在 Route target。

| 维度 | 外部 Provider | 自部署 Power |
| --- | --- | --- |
| Route target | Adapter → 公网/托管上游 | Env/Fleet 内 endpoint；**不出租户网络边界** |
| 上游凭证 | 平台或 Org 托管；客户端不可见 | 集群内服务身份；非用户 Provider Key |
| L1 计量 | token/次 + Listing 归因 | **仍写 L1**（产能/内部成本 showback） |
| L2 计费 | Quote/合同决定是否结算 | 由 Quote 元数据决定；**禁止**第二套账本 |
| 气隙 | 可关 Listing | 可保留；外部 Listing 可关 |

回退链（Inference 候选）可跨「外部 ↔ Power」；耗尽返回 `upstream.exhausted`，不泄露上游密钥或厂商原始错误。

---

## 5. 计费系统（怎么提供）

A3S 已写死边界（`platform-capability-architecture` §4）：

> Commercial prices may be recorded as immutable reference metadata for showback and quota calculation. Balance, checkout, invoice, tax, settlement, payment and commercial entitlement remain an **external** bounded service. They must consume authorized exports rather than mutate the Inference usage ledger.

### 5.1 拆成两层（禁止合成「一个计费中台」进 OS）

| 层 | 名称 | 权威 | 内容 | Console |
| --- | --- | --- | --- | --- |
| **L1 计量** | Usage Ledger | Inference/Capability 域 | 请求/attempt、token、按次、Listing、Principal、成本中心引用；**prompt-free** | 运营 → 用量；市场用量 Tab |
| **L2 商业** | Billing/Plan | **外部**商业服务 | 余额、充值、套餐、发票、税、结算、合同 entitlement | Customers **投影**席位/套餐；**无**钱包页 |

### 5.2 L1 必须具备的机制（OS 内）

| 机制 | 说明 |
| --- | --- |
| 单一 ledger | 模型 + Market 调用同一账本或同一投影契约，禁止第二套 |
| Quote 元数据 | Listing/Model 上不可变标价引用，供 showback 与硬顶估算 |
| 硬顶 | Key/Env spend/RPM/TPM；Gateway 执行；触顶拒绝并可 cancel Flow/Run |
| 导出 | 授权导出给 L2；幂等、可对账、无 payload |
| 归因 | Org/Project/Env/Credential/Listing/Route |

### 5.2a 多租户硬顶（Env 级，Gateway 执行）

相对单账号云厂商（如 SiliconFlow「我的 TPM」），Kense 硬顶挂在 **Env**（及 Key 子集），禁止跨 Env 默认可调。

```text
Org
 └─ Project
     └─ Env          ← Entitlement · Route · RPM/TPM/spend 硬顶
         └─ Capability Key（绑定 Env）
```

| 规则 | 说明 |
| --- | --- |
| Key 作用域 | 一张 Key = 一个 Env（或显式声明集合）；跨 Env 禁止默认可调 |
| 开通作用域 | Entitlement 落在 Env，不是账号全局 |
| 硬顶执行点 | Gateway：鉴权 → 集合校验 → **RPM/TPM/Env spend** → 路由 |
| 触顶 | HTTP 429 · `quota.exceeded`；可 cancel in-flight Flow/Run |
| 隔离 | 租户间凭证、路由、用量、日志隔离；Power 流量不出租户网络 |

Gateway 强制顺序（与 [WORK-CONNECT.md](./WORK-CONNECT.md) 一致）：

1. 鉴权 Key → Principal / Env  
2. 协议校验  
3. Listing/model ∈ 编译集合？否则 `entitlement.denied`  
4. 硬顶？否则 `quota.exceeded`  
5. 选 Route → 上游 / Power / Adapter  
6. 写 prompt-free Usage（Org/Project/Env/Key/Listing/Route/tokens|units）

### 5.3 L2 与 OS 的接口

```text
OS Usage export (signed, scoped)
        → 商业服务：入账、套餐扣减、开票
商业「合同 entitlement」变更
        → 仅能驱动 OS 侧：席位投影 / 可开通 Listing allowlist（经控制面修订）
        → 绝不能直接改 Usage 行或 Gateway 计数器
```

OEM 渠道分润：属 L2；OS 只提供客户归属与用量导出（[prd/07-channels.md](./prd/07-channels.md)）。

### 5.4 与 a3s-use「quota」的关系

Use Knowledge 等有 **scope 配额与 receipt 记账**（安装/索引容量），那是 **包/知识资源配额**，不是 API 调用计费。  
映射：资源配额 → 拥有该资源的 BC（Knowledge/Workloads admission）；**调用计费 → Usage Ledger**。两者都可触顶，但 **账本分离**。

---

## 6. 端到端（Work 一把 Key）

```text
Kense Work · 其它智能体 / IDE / SDK
  配置一次：A3S_API_KEY + https://gateway…/v1
       │
       ├─ /v1/services/{kind}/invoke/{sku}  → listing kind dispatch
       ├─ tools/search         → search.* Listing
       ├─ tools/parse          → parse.document Listing
       └─ tools/<sku>          → 任意已开通 Market / 方案 API
       │
       ▼
  全部 Authorization: Bearer <同一把 Key>
  Gateway 按 Entitlement∩Grants 放行并写入同一 Usage ledger
```

**验收：** 用户无需为 OpenAI、检索商、Monitor 分别申请 Key；停用某一 Listing 后同 Key 调该 SKU 立即失败，其它已开通能力仍可用。

---

## 7. 建设序（机制优先）

| 阶段 | 交付 | 对齐 |
| --- | --- | --- |
| **G0** | Gateway 快照 + Key 校验 + Inference 路由真执行 | A3S I0/E0 outcomes |
| **U1** | Usage ledger + showback 导出 | TokenHub 用量行；禁第二账本 |
| **M0** | Entitlement 修订 + Gateway 强制集合 | Market PRD 08 |
| **M1** | Provider 适配器（含方案 API / AIsa-proxy） | PLATFORM-SERVICES-GAPS |
| **P0** | 一等 `search`/`parse` Listing + Worker | Work 依赖 |
| **C0** | 外部 Billing 对接导出；Customers 套餐投影 | 非钱包 |
| **Use** | Registries +（可选）嵌入 a3s-use 世代投影到 Work | 不吞并 Market |

---

## 8. 明确不做什么

| 不做 | 原因 |
| --- | --- |
| Token Hub / 内置钱包控制台 | 复制机制；与 A3S 决策冲突 |
| Gateway 内写路由/Entitlement 管理态 | Gateway 无管理聚合 |
| Use 包自带计费或公网密钥 | 破坏信任与权威边界 |
| Market 安装包绕过 Plugin Manager | 第二突变路径 |
| Console 浏览器侧配额当真 | 违反五层真相 |
| 方案业务 UI 进 OS | OS≠业务系统 |

---

## 9. 一句话决策

**统一网关** = Kense Gateway 请求路径（执行冻结的 Identity×Inference×Market 策略）。  
**能力市场** = **在线 Listing 开通（B）** + **Use 包供给（A）** 双轨。  
**计费** = **OS 计量账本（L1）+ 外部商业结算（L2）**；自部署 Power 与外部 Provider 同 L1，L2 由 Quote 决定。  
**多租户** = Entitlement / 硬顶 / Key **挂 Env**；Gateway 强制隔离。  
**使用入口** = **Gateway + 一把 Capability Key**；**Kense Work** 与其它智能体同契约调用全部已开通 OS 能力。
