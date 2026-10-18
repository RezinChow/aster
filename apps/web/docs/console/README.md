# Kense OS Console — Design Docs

对照 A3S Cloud（`apps/cloud`）控制面规划，按第一性原理为 **Kense 管理后台** 产出的产品需求与 UI/UX 线框。

Cloud **不提供 Dashboard**；本套文档定义 Kense Console 作为其可视化运营壳。  
**A3S Cloud**（`apps/cloud`）= 唯一 OS 控制面；**a3s-api** = 扩展面（通讯录 / Member / 安装配置 / 过渡供给），禁止第二控制面。裁定见 [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md)。

## 权威序（冲突时从上到下）

| 序 | 文档 | 内容 |
| --- | --- | --- |
| 0 | [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md) | **控制面所有权** · A3S Cloud vs a3s-api · 管理面≠数据面 |
| 0b | [ROADMAP.md](./ROADMAP.md) | **研发交付波次** R0–R8 / Rx · 与 a3s 闸门依赖 · 旧 M0–M5 映射 |
| 1 | [ARCHITECTURE.md](./ARCHITECTURE.md) | 产品分层 + Console 功能架构 |
| 2 | [PRINCIPLES.md](./PRINCIPLES.md) | Console 设计不变量 · ActivityBar IA |
| 2a | [PAGE-UX.md](./PAGE-UX.md) | **页面 UI/UX 规范**：模式解剖 · DESIGN 绑定 · CTA/密度/四态门禁 |
| 2a′ | [WEB-PAGES-UX.md](./WEB-PAGES-UX.md) | **全站页面**相对 PAGE-UX 的实现验收 |
| 2b | [UI-COMPONENTS.md](./UI-COMPONENTS.md) | 管理后台常用 UI 组件分层 · 页面采用 · Wave D/E/F |
| 2c | [IDENTITY.md](./IDENTITY.md) | **Member / User**；用户与组织（企业通讯录） |
| 2d | [ORG-PAGE-UX.md](./ORG-PAGE-UX.md) | **组织页** UI/UX 优化规划（第一性原理 → Wave O1–O4） |
| 2e | [IDENTITY-PAGES-UX.md](./IDENTITY-PAGES-UX.md) | **身份四页** UI/UX 实现验收（Orgs · Users · Roles\|Permissions） |
| 3 | [SIDEBAR.md](./SIDEBAR.md) | 侧栏逐项晋升/拒绝矩阵 |
| 4 | [USE-GATEWAY-MARKET-BILLING.md](./USE-GATEWAY-MARKET-BILLING.md) | Gateway · 双轨市场 · 计量/计费 |
| 4a | [WORK-CONNECT.md](./WORK-CONNECT.md) | **Work / IDE 数据面接入**：baseURL + Capability Key · 错误码 · R6b |
| 4a′ | [API-ENVELOPE.md](./API-ENVELOPE.md) | **统一响应信封（持久规范）**：`/api` · `/app` · Gateway · OpenAPI |
| 4a″ | [GATEWAY-MUST-FOR-OS.md](./GATEWAY-MUST-FOR-OS.md) | **Gateway 支撑 OS 的必做功能**：G0–G5 · 非目标 · 验收闸 |
| 4a‴ | [SERVICE-INVOKE.md](./SERVICE-INVOKE.md) | **商品服务调用规范**：唯一路径 · kind/sku · snake_case input · 错误码 |
| 4a⁗ | [SERVICE-DEV.md](./SERVICE-DEV.md) | **商品服务开发规范**：adapter · 映射 · 商品化 · 测试门禁 |
| 4a⁰ | [EVENT-BUS-AND-QUEUE.md](./EVENT-BUS-AND-QUEUE.md) | **NATS 全局事件总线 · 消息队列**：所有权 · subject · Console `/bus` `/queues` |
| 4b | [ENTITLEMENT-COMPILE.md](./ENTITLEMENT-COMPILE.md) | 开通 → Cloud 编译 → Edge 快照观测 |
| 4c | [AGENT-MODEL-PRODUCT-PATH.md](./AGENT-MODEL-PRODUCT-PATH.md) | **智能体商品 × 模型商品**：第一性优化路径 P0–P3 · EXIT · 非目标 |
| 4d | [SKILL-PRODUCT-PATH.md](./SKILL-PRODUCT-PATH.md) | **已废止**：技能/连接器不再是商品，改由能力扩展（a3s-api `capability`）管理 |
| 5 | [PLATFORM-SERVICES-GAPS.md](./PLATFORM-SERVICES-GAPS.md) | Work 依赖能力 · 市场 · 方案 API 运营缺口 |
| 5b | [PLATFORM-DASHBOARD-VIEWS.md](./PLATFORM-DASHBOARD-VIEWS.md) | **平台仪表盘（CTO）应具备视图** |
| 6 | [prd/00-master.md](./prd/00-master.md) + `prd/01`–`08` | 范围、里程碑、分册需求 |
| 7 | [wireframes/](./wireframes/) · [button-level/](./wireframes/button-level/) | 结构线框 / 控件级交互 |
| 8 | 官方 `a3s-os` MDX | 对外叙述；细节以 0–7 为准 |
| 9 | a3s `apps/cloud/docs/a3s-os-boundary.md` | Cloud 侧对偶边界声明 |

**实现真相源（导航）：** `apps/web/src/shell/destinations.ts`  
**已退役：** [`apps/web/WIREFRAMES.md`](../../WIREFRAMES.md)（旧 W0–W12 IA）— 仅作指针，勿再扩展。

## 双轴说明（勿混）

| 轴 | 用途 | 不是 |
| --- | --- | --- |
| **ActivityBar 四域** | 操作者导航（侧栏一级结构） | 交付里程碑编号 |
| **P0–P4 / 06–08** | PRD 交付切片与线框文件分组 | 侧栏领域名 |

四域：`运营 → 研发 → 平台 → 设置`（见 PRINCIPLES §4，与 `destinations.ts` 的 `OS_ACTIVITY_DOMAINS` 一致）。

## 现行侧栏

| Activity 域 | 分区 · 叶子 |
| --- | --- |
| 运营 | 仪表盘：概览。商务：客户 · 渠道商 · 供应商。业务：商品 · 订单 · 订阅 · 工单 |
| 研发 | 代码仓库：智能体 · 工作流 · 接口服务 · 连接器。资源仓库：小程序 · 技能 · 工具 · 知识库。制品仓库：包仓库 · 镜像仓库 · 模型仓库 |
| 平台 | 仪表盘：平台。运行：工作流 · 函数 · 智能体 · 耐久单元 · 推理。资源：网关 · 集群。观察：拓扑 · 事件总线 · 消息队列 · 日志 · 用量。企业：成员 · 职位 · 角色 |
| 设置 | 通用 · 行政 · 分类 · 配置 · 开发者 |

分册 `prd/01`–`08` 仍是屏幕规格，不再充当 ActivityBar 域名。线框目录见 [wireframes/](./wireframes/)。

## 产品决策（摘要）

- **要：** TokenHub-class **outcomes**（路由/密钥/限额/诊断/showback）→ Inference + Usage。  
- **要：** 统一能力市场 → **市场**；World Monitor / Polymarket / AIsa 等为 Provider。  
- **要：** Gateway + **一把 Capability Key**；**Kense Work** 与其它智能体同契约接入。  
- **要：** 智能体商品（编排/席位）≠ 模型 Listing（可调用）；依赖经 Harness `ModelRevision` + 开通，见 [AGENT-MODEL-PRODUCT-PATH.md](./AGENT-MODEL-PRODUCT-PATH.md)。  
- **要：** 技能与连接器是能力扩展，不是商品：目录与启停在 a3s-api `/api/admin/capabilities`（Console 运营侧边栏「技能」`/admin/capabilities/skills` 与「连接器」`/admin/capabilities/connectors`），成员安装走 `/api/org/capabilities`；技能包（.zip / SKILL.md）与图标在 Console 表单上传，存 RustFS，不再有 `MarketListingKind::skill`。  
- **不要：** 把 `agent` 加进 `MarketListingKind`；Console fixture 假绿；侧栏「Token Hub」「Token Plan」、钱包/充值/结算；地理代理；方案业务 UI 进 OS。  
- 详见 [ARCHITECTURE.md](./ARCHITECTURE.md) · [PRINCIPLES §7](./PRINCIPLES.md)。

## 与现码关系

`@a3s/web` 已有控制面导航骨架与部分模块页。本文档是 **目标态设计**；实现以 PRD 验收与 `destinations.ts` 为准。
