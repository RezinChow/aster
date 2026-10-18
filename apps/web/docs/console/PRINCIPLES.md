# 第一性原理与信息架构

> **架构总览（技术 + 功能）：** [ARCHITECTURE.md](./ARCHITECTURE.md)。本文专注 Console 设计不变量与 IA；冲突时以 ARCHITECTURE + 本文为准。

## 1. 产品是什么

**Kense OS Console** 是运营商与租户管理员操作 AI-native 控制面的可视化界面。  
它不拥有业务真相：

| 真相 | 所有者 |
| --- | --- |
| 平台期望态（Grant · Route · Workload · Flow · Inference · Audit…） | **a3s-cloud**（唯一 OS 控制面） |
| 通讯录 / Member / 安装配置（扩展） | **a3s-api** |
| 数据面强制执行 | **Kense Gateway** |

总裁定见 [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md)。

| Console 是 | Console 不是 |
| --- | --- |
| 作用域感知的运营壳 | 第二套调度器 / Flow 引擎 / 请求代理 |
| 同一 REST 契约的人机界面 | 独立「仅 UI」策略源 |
| 列表 → 详情 → 变更 → 证据 的工作流 | 无审计的配置玩具 |
| 与 CLI / MCP 对等的管理面之一 | 唯一管理通道 |

## 2. 五层真相（设计不变量）

```text
范围 Scope     → Installation / Org / **Department（人）** / Project / Environment（资源）
身份 Identity  → **User**（属部门）/ AdminRole / Grant / Credential / Secret；前台 **Member** 见 [IDENTITY.md](./IDENTITY.md)
意图 Product   → Agent / Workflow / Function / Cell / Inference / **Marketplace** / App
供给 Supply    → Source / Artifact / Pipeline / Registry / Model
运行 Runtime   → Workload / Fleet / Edge / Gateway
运营 Ops       → Audit / Usage / Event / Notification / Health
商业 Commercial→ Customers / Channels（OEM；运营投影，非业务系统）
```

**不变量：**

1. **一切列表默认带作用域**；无作用域的全局视图仅限平台角色。  
2. **变更必须可关联 Audit / Operation**；危险操作二次确认。  
3. **Secret 永不回显明文**；仅创建时一次性展示。  
4. **状态以控制面为准**；UI 缓存可失效，不可写成权威。  
5. **不复制机制**：不在前端实现重试、调度、授权判定逻辑；不经 a3s-api 伪造 A3S Cloud 已拥有的期望态。

## 3. 角色

| 角色 | 典型任务 | 默认落点 |
| --- | --- | --- |
| Platform Owner/Admin | 安装级策略、升级、租户生命周期、Provider 信任 | 系统运维 · 平台 RBAC |
| Platform Operator | 机群排水、事件响应、有界恢复 | Fleet · Events · Ops |
| Security Auditor | 只读审计与导出 | Audit · Security findings |
| Org Admin | 成员、角色、配额、客户商业属性 | Users · Permissions · Customers |
| Developer / Operator | 部署、调试流程、推理路由 | Products · Workloads · Inference |
| Viewer | 只读状态与报表 | Overview · 只读列表 |

## 4. 信息架构（ActivityBar · 侧栏）

**规则：** ActivityBar = **领域切换**（一图标一职责）；侧栏 = **当前领域**内按 **分区（section）** 排列的目的地。切换领域时若当前路由不在该域，则落到该域 `defaultDestination`。

**与 PRD 交付切片关系：** `prd/01`–`05` 的 P0–P4 及 `06`–`08` 是 **实现分组**，不是 ActivityBar 域名。导航权威永远是本节 + [SIDEBAR.md](./SIDEBAR.md) + `destinations.ts`。

### 4.1 细化原则（防过度设计）

1. **分区标签**只用于归类（2–4 项为宜），不可点击。  
2. **晋升为侧栏叶子**的条件：独立操作者任务 + 值得书签的 URL（如人工任务收件箱）。  
3. **不晋升**：同一资源的 Tab/属性（Inference 的路由·密钥·限额、Listing Detail 等）——留在页内。  
4. **不**为每个 PRD 控件再开导航项。

### 4.2 领域 × 侧栏

逐项裁定见 [SIDEBAR.md](./SIDEBAR.md)。实现：`destinations.ts`。

```text
ActivityBar                     侧栏（分区 · 叶子）
─────────────────────           ────────────────────────────────
运营                            仪表盘：概览
                                商务：客户 · 渠道商 · 供应商
                                业务：商品 · 订单 · 订阅 · 工单
研发                            代码仓库：智能体 · 工作流 · 接口服务 · 连接器
                                资源仓库：小程序 · 技能 · 工具 · 知识库
                                制品仓库：包仓库 · 镜像仓库 · 模型仓库
平台                            仪表盘：平台
                                运行：工作流 · 函数 · 智能体 · 耐久单元 · 推理
                                资源：网关 · 集群
                                观察：拓扑 · 事件总线 · 消息队列 · 日志 · 用量
                                企业：成员 · 职位 · 角色
设置                            通用 · 行政 · 分类 · 配置 · 开发者
```

顺序与 `OS_ACTIVITY_DOMAINS` 一致。旧文里的八域（概览 / 身份 / 编排 / 能力 / 供给 / 运行 / 运营 / 商业）不是现行轨道。经营、增长、凭证、审计、通知、工作负载不在这张侧栏上。

工作流、函数、智能体、耐久单元是「造什么在跑」；推理是「能调什么」。网关和集群在平台的资源分区。市场页有路由，不在侧栏分组里。
**渠道：** 仅 OEM；不做省/市地理代理（见 [prd/07-channels.md](./prd/07-channels.md)）。  
**实现真相源：** `apps/web/src/shell/destinations.ts`（`OS_ACTIVITY_DOMAINS` · `OS_NAV_GROUPS.sections`）。

## 5. 页面模式（全站统一）

| 模式 | 用于 | 结构 |
| --- | --- | --- |
| **List** | 资源目录 | PageHeader + 工具条（搜索/筛选/主 CTA）+ Stats + Table/Cards + 空态 |
| **Directory** | 树 + 同屏详情 | DirectorySplit · 选中同步 URL · 详情 Tabs（见身份组织页） |
| **Detail** | 单资源 | 标题元数据 + Tab（Overview / Revisions / Activity / Access）+ 侧栏属性 |
| **Editor** | ACL/策略/定义 | 双栏：表单或代码编辑 + 校验/diff + 提交生成 Operation |
| **Matrix** | 权限/路由绑定 | 行=主体，列=能力，只读+批量编辑模式 |
| **Timeline** | Run / Audit / Pipeline | 垂直事件流，可筛选级别与相关资源 |
| **Wizard** | 创建租户/邀请/发布 | 步进 + 可回退 + 结束页展示证据 ID |

**页面级 UI/UX（密度 · CTA · 四态 · DESIGN 绑定 · 验收门禁）：** [PAGE-UX.md](./PAGE-UX.md)。

## 6. UX 原则

1. **一屏一事**：首屏不做仪表盘堆砌；Overview 除外且仍控制模块数 ≤ 4。  
2. **主按钮唯一**：每页至多一个 primary CTA（邀请、新建、发布）。  
3. **破坏性操作后置**：禁用/删除进「更多」或详情危险区。  
4. **反馈可追踪**：提交后展示 Operation ID，可跳转 Ops/Audit。  
5. **深浅色与中英**：沿用现有 prefs；线框以结构为准，不绑定具体色板。  
6. **密度**：管理表偏紧凑（行高 ~40–44px）；产品详情可疏。

## 7. TokenHub 类能力落点（决策）

**原则：** 保留 TokenHub 有价值的 *outcomes*，不引入 TokenHub / Token Plan 产品壳，不复制其 API、UI 拓扑或计费模型。

| Outcome（结果） | Console 落点 | 权威在控制面 |
| --- | --- | --- |
| 外部/本地模型目录与 Provider | **Inference**（模型/Provider 只读+链到 Models 供给） | Inference · Model Supply · Secrets |
| 统一协议发现与路由 | **Inference → 路由 / 策略** | Inference 修订 · Gateway 快照 |
| 优先级 · 权重 · 回退 · 亲和 | **Inference → 路由策略编辑器** | Inference 不可变 revision |
| 项目/环境推理 Key | **Inference → 密钥**（创建时一次性明文） | Identity credentials |
| 模型访问最小权限 | **Inference → 访问** ∩ P0 Grants | Identity ∩ Inference access |
| 配额 · 速率 · 并发 | **Inference → 限额策略** + Usage 只读展示 | Inference policy · Gateway 执行 |
| 用量归因 · 成本 showback | **Usage**（+ Customers 摘要） | Inference usage ledger |
| 诊断 · 契约示例 · 试探流量 | **Inference → 诊断** | 授权查询；无持久 prompt 库 |
| 内容安全 / Guardrail | **Inference → 护栏** | Inference 不可变策略 |
| 席位 / 套餐商业投影 | **Customers** | 外部商业服务 + Org 绑定 |
| 统一 API/工具/模型目录与多 Provider | **市场 Marketplace** | Gateway 执行 · Entitlement · Provider 适配 |
| 调用前标价 · 跨 Provider 归因 | **市场 + Usage** | Gateway ledger；非钱包余额 |
| Capability Key（一钥调已开通集合） | **市场 · 密钥** ≡ Inference 密钥资源；**Work（及其它客户端）仅配这一把** | Identity credentials |


**明确不做：**

| 非目标 | 原因 |
| --- | --- |
| 导航项「Token Hub」或独立 TokenHub 控制台 | 第二控制面；与 Cloud 能力架构冲突 |
| 「Token Plan」充值 · 余额 · 开票 · 结算 UI | 商业权威在外部服务；Console 只做投影/导出 |
| 浏览器侧重试 / 本地配额计数当真 | 违反五层真相与「不复制机制」 |
| 把 Monitor 地图 / 预测市场交易台嵌进 OS | 属解决方案或 OEM；OS 只做 Provider 目录与调用治理 |

细化需求见 [prd/06-inference-usage.md](./prd/06-inference-usage.md)、[prd/08-marketplace.md](./prd/08-marketplace.md)；线框见 [wireframes/inference-usage.md](./wireframes/inference-usage.md)、[wireframes/marketplace.md](./wireframes/marketplace.md)。

## 8. 非目标

- Desktop / Work **客户端偏好页**（联网搜索开关等）不充当开通与配额权威；权威在 Marketplace · Inference · Gateway（见 [PLATFORM-SERVICES-GAPS.md](./PLATFORM-SERVICES-GAPS.md)）。  
- 不在 Console 内存活第二套授权引擎。  
- 不把 Redis/搜索/分析投影当作配额或权限真相。  
- 不做 TokenHub / Token Plan 产品壳（见 §7）。  
- 能力市场不做充值钱包与供应商结算台（见 [prd/08-marketplace.md](./prd/08-marketplace.md)）。  
- 不把 Monitor 地图/研判等方案 UI 嵌进 OS 导航。
