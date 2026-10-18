# PRD P1 — 产品泳道

对齐 Cloud：Agents、Workflows、Functions、Durable Cells、Inference、Applications/Web。

统一模式：**List → Detail（Overview / Revisions / Runs / Access）→ 关联证据**。

---

## 1. Agents

| ID | 需求 | 优先级 |
| --- | --- | --- |
| AG-1 | Agent 资产列表（名称、版本、状态、Env） | P1 |
| AG-2 | Conversation / Execution 列表与详情 | P1 |
| AG-3 | Execution 内审批闸门深链 **统一收件箱** `/tasks`（不另开 Agent 审批栏） | P1 |
| AG-4 | Checkpoint 列表、Fork 入口 | P1 |
| AG-5 | Tool 调用证据时间线 | P1 |

**验收：** 从 Execution 可跳到关联 Workload / Audit；审批通过/拒绝经 `/tasks` 写回控制面。

---

## 2. Workflows / Flows（WaaS）

现有 Flows 页升级为产品级 Workflow 面。

| ID | 需求 | 优先级 |
| --- | --- | --- |
| WF-1 | Workflow 定义列表 + Run 列表（可切换） | P1 |
| WF-2 | Run Detail：步骤时间线、重放入口、当前等待 | P1 |
| WF-3 | HumanTask 经 **统一收件箱** `/tasks`（与 Agent 审批同一叶子；见 [SIDEBAR.md](../SIDEBAR.md)） | P1 |
| WF-4 | 修订对比（definition digest） | P1 |
| WF-5 | 挂起 / 取消 / 重放操作（按权限） | P1 |

**验收：** Run 时间线顺序与控制面 journal 一致；重放跳过已完成步骤的说明可见；`/tasks` 可处理 Agent 与 Flow 两类人工闸门。

---

## 2b. 人工任务（编排侧栏叶子）

| ID | 需求 | 优先级 |
| --- | --- | --- |
| TASK-1 | `/tasks` 统一收件箱：Agent approval ∪ Flow HumanTask | P1 |
| TASK-2 | 筛选：来源（Agent/Flow）· 超时 · 作用域 | P1 |
| TASK-3 | 通过/拒绝/转交写回控制面 + Operation | P1 |

---

## 3. Functions / Executions（FaaS）

| ID | 需求 | 优先级 |
| --- | --- | --- |
| FN-1 | Function 资产与 Release | P1 |
| FN-2 | Invocation 列表：状态、时延、幂等键 | P1 |
| FN-3 | 手动触发面板（schema 表单或 ACL） | P1 |
| FN-4 | 并发与超时策略只读/编辑 | P1 |

---

## 4. Durable Cells

| ID | 需求 | 优先级 |
| --- | --- | --- |
| CELL-1 | Cell Application 列表 | P1 |
| CELL-2 | Revision / Deployment 详情 | P1 |
| CELL-3 | 休眠 / 唤醒操作与 writer fence 状态 | P1 |
| CELL-4 | 存储配置与备份入口（链到 Ops） | P1 |

---

## 5. Inference

升级现有 Inference 占位页。TokenHub 类网关 outcomes **落入本模块**（不做 Token Hub 壳）。

| ID | 需求 | 优先级 |
| --- | --- | --- |
| INF-1 | Route 目录：publish / revise / retire | P1 |
| INF-2 | API Key（推理）与授权绑定 | P1 |
| INF-3 | Usage 汇总（模型/路由/主体） | P1 |
| INF-4 | Provider / 后端健康只读投影 | P1 |
| INF-5 | 路由详情：Edge binding、目标、限流 | P1 |

**细化（完整矩阵 · 策略 · 访问 · 限额 · 护栏 · 诊断）：** 见 [06-inference-usage.md](./06-inference-usage.md)。  
**线框：** [inference-usage.md](../wireframes/inference-usage.md) · [button-level/07](../wireframes/button-level/07-inference-usage.md)。

**验收：** retire 后列表状态变更；无 Power 数据面时明确「Serving 不可用」而非假绿；无 Token Hub/Plan 导航。

---

## 5b. 市场 Marketplace（能力目录）

统一 API / Tool / Model / Skill / Feed 目录与多 Provider 开通。挂在 ActivityBar **能力** 域（与 Inference 并列）。执行仍走 Gateway；模型开通后进入 Inference 候选。

**细化：** [08-marketplace.md](./08-marketplace.md)。  
**线框：** [marketplace.md](../wireframes/marketplace.md) · [button-level/09](../wireframes/button-level/09-marketplace.md)。

| ID | 需求 | 优先级 |
| --- | --- | --- |
| MKT-1 | 浏览目录 + Listing Detail + 标价展示 | P1 |
| MKT-2 | Entitlement 开通/停用 + Operation | P1 |
| MKT-3 | Provider 模板（World Monitor · Polymarket · AIsa …）与同步 | P1 |
| MKT-4 | Capability Key 与 Usage 归因（无钱包） | P1 |

---

## 6. Applications / Static Web

| ID | 需求 | 优先级 |
| --- | --- | --- |
| APP-1 | Application 列表与绑定的 API/Agent/Workflow | P1 |
| APP-2 | Web Release：不可变版本、切换流量、回滚 | P1 |
| APP-3 | 预览 URL / 域名绑定状态 | P1 |

---

## 跨泳道 UX 规则

1. 所有「Run/Invocation/Execution」用同一 Timeline 组件语言。  
2. 修订不可变：编辑即新建 revision，禁止就地改历史。  
3. 详情页右侧固定「Scope · Owner · Digests · Links」。
