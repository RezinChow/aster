# PRD P4 — 运营 · 商业 · 系统

对齐 Cloud：Operations、Observability/Usage、Notifications、平台运维；商业层 Customers。

## 1. Events & Logs

| ID | 需求 | 优先级 |
| --- | --- | --- |
| EV-1 | 控制面事件流（现有基线增强筛选） | P4 |
| EV-2 | 日志查询：作用域、相关性 ID、时间窗 | P4 |
| EV-3 | 从 Event 跳转资源详情 | P4 |
| EV-4 | 告警规则只读/编辑（若 API 具备） | P4 |

## 2. Usage & Billing projection

| ID | 需求 | 优先级 |
| --- | --- | --- |
| USE-1 | 用量仪表：按 Org/Project/路由/模型 | P4 |
| USE-2 | 导出 CSV（异步 Operation） | P4 |
| USE-3 | 与 Customers 席位/套餐并排展示 | P4 |

**细化（showback · 完整性 · 成本中心 · OOS 结算）：** 见 [06-inference-usage.md](./06-inference-usage.md) §3。  
**线框：** [inference-usage.md](../wireframes/inference-usage.md) · [button-level/07](../wireframes/button-level/07-inference-usage.md)。

**注意：** 用量为投影；争议以控制面 ledger 为准。  
**禁止：** Token Plan 充值/余额/开票/结算台；成本仅 showback。

## 3. Notifications

| ID | 需求 | 优先级 |
| --- | --- | --- |
| NT-1 | 订阅渠道与收件人 | P4 |
| NT-2 | 投递失败队列与重试 | P4 |
| NT-3 | 用户偏好（邮件/webhook） | P4 |

## 4. System（平台运维）

仅 Platform 角色。

| ID | 需求 | 优先级 |
| --- | --- | --- |
| SYS-1 | 安装健康、版本、迁移窗 | P4 |
| SYS-2 | Provider / Registry 信任 | P4 |
| SYS-3 | 升级与备份恢复入口（链到 Operation） | P4 |
| SYS-4 | 平台角色绑定（链到 Permissions 平台平面） | P4 |

## 5. Customers（客户管理）

现有客户列表升级为商业投影。

| ID | 需求 | 优先级 |
| --- | --- | --- |
| CUS-1 | List：套餐、席位、状态（现有） | P4 |
| CUS-2 | Detail：绑定 Organization、合同摘要、用量 | P4 |
| CUS-3 | 创建客户向导：Org + 套餐 + Owner | P4 |
| CUS-4 | 流失/试用状态流转 | P4 |
| CUS-U\* | 用量页签与 Usage 深链（非 Token Plan） | P4 |

CUS-U 细则见 [06-inference-usage.md](./06-inference-usage.md) §3.3。

### 5.1 渠道管理（OEM）

唯一渠道模型为 **OEM 白标伙伴**，见 [07-channels.md](./07-channels.md)。  
导航：商业领域下「渠道」。**不做**省/市地理代理。  
客户归属：`直客 | 渠道(OEM)`。

## 6. Settings（已有弹窗）

保持非路由弹窗；P4 仅补充「关于」中的控制面版本与合约版本号展示。
