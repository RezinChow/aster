# PRD — 能力市场（API Marketplace）

| 字段 | 值 |
| --- | --- |
| 产品 | Kense OS Console · 能力市场 |
| 版本 | Design target v1 |
| 对照 | Gateway · Inference · Registries · Usage · Secrets |
| 状态 | Draft for implementation |
| 相关 | [wireframes/marketplace.md](../wireframes/marketplace.md) · [button-level/09-marketplace](../wireframes/button-level/09-marketplace.md) · [06-inference-usage](./06-inference-usage.md) |

---

## 1. 问题与目标

**问题：** Agent / Flow / OEM 应用需要调用大量外部能力（模型、MCP 工具、数据 API、预测市场、态势源）。今日能力散落在各 Provider 控制台：多 Key、无统一目录、无作用域授权、无调用前标价、无跨 Provider 用量归因。

**目标：** 在 **Kense OS** 提供类 AIsa 的 **统一能力市场**：一目录发现、一钥调用、多 Provider 接入、作用域开通、调用前标价、硬预算与 Usage showback。World Monitor、Polymarket、AIsa、以及一等模型商等均为 **Provider**，不是平行控制面。

**成功标准：**

1. Org/Env 内可浏览统一目录（Model · Tool/MCP · API · Skill · Feed），每条 Listing 可见 Provider、标价、SLA/健康、权限要求。  
2. **一把 Capability Key**（与 Inference Key 同一资源）即可调用已开通 Listing；流量经 Gateway。**Kense Work 及其它智能体**仅需配置这一把 Key 使用全部已开通模型与 API。  
3. Platform 可注册 / 信任 / 停用 Provider；Org 可开通 / 停用 Listing（生成 Operation）。  
4. 调用前展示单价；Usage 按 Provider × Listing × Principal 归因；Key/Env 级硬支出上限可熔断 Run。  
5. **不做**充值钱包、开票结算台、第二套 Token Hub 壳；**不做**「每 Provider 一把客户端 Key」。

---

## 2. 边界与第一性

| OS 市场是 | OS 市场不是 |
| --- | --- |
| 控制面的能力目录 + 开通 + 计量投影 | 行业态势/交易业务系统 |
| Provider 适配与信任策略 | 爬虫或替 Provider 持有用户业务数据真相 |
| Gateway 可调用面的发现与授权 | 替代 Inference 路由引擎 / Flow 引擎 |
| OEM 可白标暴露的目录子集 | 分润提现 / 供应商结算后台 |

**不变量：**

1. **执行真相在 Gateway** — 目录只声明；拒绝/限流/标价校验在 Gateway。  
2. **Listing 开通 = Entitlement 修订** — 不可变 revision + Operation；UI 不本地计数当真。  
3. **AIsa 是 Provider 之一** — 可「整包转发」其目录子集，或逐条镜像；用户仍只持 Kense Key。  
4. **World Monitor / Polymarket 等同理** — 适配器把上游 OpenAPI/MCP 登记为 Listing。  
5. **与 Registries 分工** — Registry = 可安装制品（Skill 包、Connector 包）；Market = 可调用/可计量的在线能力要约。Skill **Listing** 可指向 Registry 包。

```text
发现/开通（本 PRD）     执行策略              计量
Marketplace  ──启用──►  Inference / Tool ACL ──► Gateway ──► Usage
     ▲                      ▲
 Provider Catalog      Capability Key
```

---

## 3. 领域模型

```text
Installation
  └─ Provider                 # worldmonitor | polymarket | aisa | openai | …
        status · trust · adapter · health
        └─ Listing[]          # 可发现的能力要约
              kind · sku · price · schemas · upstream_ref
Org / Env
  └─ Entitlement              # 开通修订：哪些 Listing 可用
  └─ CapabilityKey            # 作用域密钥（可调用已开通集合）
  └─ SpendPolicy              # Key/Env 硬顶（链 Inference 限额）
```

| 概念 | 说明 | Console |
| --- | --- | --- |
| **Provider** | 上游能力供应方 | 目录卡 · Detail · 信任/凭证 |
| **Listing** | 单条可调用要约（API/Tool/Model/Skill/Feed） | 市场浏览 · Detail · 开通 |
| **Kind** | `model` \| `tool` \| `api` \| `skill` \| `feed` | 筛选 chips |
| **Entitlement** | Org/Env 对 Listing 的启用修订 | 开通抽屉 · 已开通列表 |
| **Capability Key** | 调用已开通集合的凭证 | 与 Inference「密钥」合并或深链 |
| **Quote** | 调用前单价（上游 + 平台费展示） | Listing · 试探面板 |
| **Adapter** | 上游协议：OpenAPI · MCP · AIsa-proxy · 原生 | Provider Detail 只读 |

**示例 Provider（v1 设计目标，非业务功能）：**

| Provider | 典型 Listing kind | 适配要点 |
| --- | --- | --- |
| World Monitor | `feed` / `tool` | MCP tools + REST；JMESPath 投影；来源字段透传 |
| Polymarket | `api` / `feed` | 市场只读查询；写操作默认拒绝或需独立 Grant |
| AIsa | `model` / `tool` / `api` / `skill` | 目录同步或按 SKU 代理；单价透传 |
| OpenAI / Anthropic / … | `model` | 与现有 Inference Provider 资源对齐 |
| Kense hosted | 任意 | 一等自研能力 |

---

## 4. 角色与权限

| 角色 | 可做 | 不可做 |
| --- | --- | --- |
| Platform Admin | 注册 Provider、信任策略、全局下架 Listing、看安装级用量 | — |
| Org Admin | 浏览、开通/停用 Listing、管 Key 与 Env 预算 | 改 Provider 信任根 |
| Developer | 浏览已信任目录、试探（若授权）、只读开通状态 | 开通计费 Listing（默认可配置） |
| Viewer | 只读目录与开通摘要 | 写 |
| OEM Admin | 见白标目录子集（Channels 品牌过滤） | 装未授权 Provider |

Permission 示意：`market.read` · `market.entitle.write` · `market.provider.write` · `market.probe` · `credential.capability.write`

---

## 5. 导航与信息架构

ActivityBar **能力** 领域侧栏（逐项见 [SIDEBAR.md](../SIDEBAR.md)）：

```text
能力
  ├─ 市场                 /marketplace
  ├─ 已开通               /marketplace/entitled
  └─ 推理                 /inference
```

**已开通** = **仅**侧栏叶子 `/marketplace/entitled`（日频运营任务）。**禁止**在市场页再设「已开通」Tab 作为第二权威入口；浏览态可用筛选「已开通」chip 深链到该叶子。

页内 IA（市场页 `/marketplace`）：

```text
市场
  [浏览] [Provider] [密钥] [用量]
```

| Tab | 职责 | 主 CTA |
| --- | --- | --- |
| 浏览 | 统一目录搜索/筛选/卡片或表 | 开通 |
| Provider | Provider 目录与健康 | 添加 Provider（平台） |
| 密钥 | Capability Key（深链或内嵌 Inference 密钥子集） | 创建 Key |
| 用量 | 本作用域 Market 归因 rollup | 打开完整 Usage |

**与 Inference 关系（UX）：**

- Listing `kind=model` 开通后出现在 Inference → 模型/路由候选。  
- 「密钥」Tab 与 Inference → 密钥 **同一资源**；市场侧重「能调哪些 Listing」，Inference 侧重「模型路由与限额」。  
- 限额硬顶：Market 开通页可链到 Inference → 限额；不维护第二套计数器。

**与 Registries 关系：**

- `kind=skill` 的 Listing 详情展示「安装包」深链 Registry；开通 = Entitlement +（可选）安装到 Env。

---

## 6. 需求明细

### 6.1 浏览 MKT-B

| ID | 需求 | 优先级 |
| --- | --- | --- |
| MKT-B1 | 目录：名称、Provider、kind、标价摘要、健康、开通状态 | P0 |
| MKT-B2 | 搜索 + chips：kind · Provider · 已开通 · 定价模式（按次/token/订阅投影） | P0 |
| MKT-B3 | 卡片/表切换；空态说明「等待 Provider 同步」 | P0 |
| MKT-B4 | Listing Detail：描述、OpenAPI/MCP schema 摘要、单价表、SLA、上游文档链、试探 | P0 |
| MKT-B5 | 调用示例（curl / MCP / SDK）只读；无持久 prompt 库 | P1 |

### 6.2 开通 MKT-E

| ID | 需求 | 优先级 |
| --- | --- | --- |
| MKT-E1 | 开通抽屉：选择 Env、确认标价与权限、可选预算提示 | P0 |
| MKT-E2 | 提交 → Entitlement revision + Operation ID | P0 |
| MKT-E3 | 停用 / 暂停：二次确认；已发流量拒绝新调用 | P0 |
| MKT-E4 | 批量开通（同 Provider 多 Listing） | P1 |
| MKT-E5 | OEM 目录过滤：仅展示渠道允许的 Provider/Listing | P1 |

### 6.3 Provider MKT-P

| ID | 需求 | 优先级 |
| --- | --- | --- |
| MKT-P1 | Provider List：名称、类型、Listing 数、健康、信任级 | P0 |
| MKT-P2 | 添加 Provider 向导：类型模板（MCP · OpenAPI · AIsa-proxy · 原生）→ 凭证 → 同步试拉 | P0 |
| MKT-P3 | Detail：适配器配置、同步日志、信任/停用、关联 Secrets | P0 |
| MKT-P4 | 目录同步：手动/定时；失败可见；不静默清空已开通 | P0 |
| MKT-P5 | 预置模板卡：World Monitor · Polymarket · AIsa · OpenAI…（一键填适配器默认值） | P1 |
| MKT-P6 | AIsa-proxy：可选「镜像全目录」或「SKU allowlist」 | P1 |

### 6.4 密钥与计量 MKT-K / MKT-U

| ID | 需求 | 优先级 |
| --- | --- | --- |
| MKT-K1 | Capability Key 列表：作用域、前缀、开通集合摘要、支出上限 | P0 |
| MKT-K2 | 创建时一次性明文；吊销确认 | P0 |
| MKT-K3 | Key 可限制「仅某 Provider / kind」 | P1 |
| MKT-U1 | 用量表：Provider × Listing × 日；深链 P4 Usage | P0 |
| MKT-U2 | Listing Detail 内嵌近 7 日调用火花图 | P2 |

### 6.5 试探与护栏 MKT-X

| ID | 需求 | 优先级 |
| --- | --- | --- |
| MKT-X1 | 试探面板：构造最小请求、显示标价预估、返回消毒后的结果 | P0 |
| MKT-X2 | 写操作 Listing 默认 `probe` 禁用，需 `market.probe.write` | P0 |
| MKT-X3 | 结果 envelope 提示：保留 `source` / `as_of`（若上游提供） | P1 |

### 6.6 非目标（OOS）

| 非目标 | 原因 |
| --- | --- |
| 充值 · 余额 · 开票 · 供应商结算 | 同 PRINCIPLES §7；外部商业服务 |
| 导航「Token Hub」 | 禁止第二壳 |
| 在浏览器执行上游重试/计费 | 机制在 Gateway |
| 把 Monitor 地图/研判 UI 嵌进市场 | 属 Kense Monitor 方案 |
| Polymarket 下单交易台 | 市场仅目录与受控调用；交易属 OEM/方案 |

---

## 7. 屏幕清单

| ID | 屏幕 | 模式 |
| --- | --- | --- |
| S-MKT-1 | 市场 · 浏览 | List（卡/表） |
| S-MKT-2 | Listing Detail | Detail + 试探 Drawer |
| S-MKT-3 | 开通抽屉 | Wizard-lite |
| S-MKT-4 | 已开通 | List |
| S-MKT-5 | Provider List / Detail / 添加向导 | List · Detail · Wizard |
| S-MKT-6 | 密钥 | List（共享 Inference 资源模型） |
| S-MKT-7 | 用量 | List + 深链 |

---

## 8. 验收

1. 以模板添加「World Monitor」Provider → 同步出 ≥1 条 Listing → Org 开通 → Capability Key 经 Gateway 试探成功 → Usage 可见一行归因。  
2. AIsa Provider（allowlist）开通某 model Listing 后，Inference 路由候选可见该模型。  
3. 停用 Listing 后新调用 403/策略拒绝；Audit 有 Entitlement 修订。  
4. 无钱包入口；标价为展示 + Gateway 计量，不出现「充值」。  
5. OEM 作用域下目录被 Channels 策略过滤（若配置）。

---

## 9. 里程碑建议

| 里程碑 | 交付 |
| --- | --- |
| M-M0 | IA + 浏览/Detail mock + Provider 模板壳 |
| M-M1 | Entitlement 开通/停用 + Key 打通 + Usage 深链 |
| M-M2 | World Monitor · AIsa 适配器真通；Polymarket 只读 API |
| M-M3 | OEM 目录过滤 · 批量开通 · SKU allowlist |
