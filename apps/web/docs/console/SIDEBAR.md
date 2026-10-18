# 侧栏逐项审定（平台边界）

| 字段 | 值 |
| --- | --- |
| 地位 | IA 决策附录（服从 [PRINCIPLES §4](./PRINCIPLES.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)） |
| 方法 | 第一性：一叶子 = 一可书签操作者任务；业界：Cloudscape 侧栏 ≠ 详情 Tab |
| 禁区 | 业务方案菜单、Token Hub、Inference/Market 全 Tab 抬栏、单链空分区 |

**晋升条件（须同时满足）：** ① 平台原语/运营任务（非行业业务）② 与同域其他叶子任务不同质 ③ 值得独立 URL。  
**不晋升：** 创建/编辑向导、Detail、同一资源的互斥面（用页内 Tab）。

---

## 现行轨道

ActivityBar 三域，顺序与 `OS_ACTIVITY_DOMAINS` 一致：运营、平台、设置。叶子与 `OS_NAV_GROUPS` 一致。

分域原则：运营放经营任务（客户、交易），平台放研发与运维任务（工作负载、AI、基础设施、可观测性），设置放组织与系统管理（团队权限、登录安全、配置、参考数据）。

### 运营

| 分区 | 叶子 |
| --- | --- |
| 仪表盘 | 经营概览 `/admin` |
| 客户与伙伴 | 客户 · 渠道商 · 供应商 |
| 业务 | 订阅 · 订单 · 工单 `/admin/work-orders` |
| 服务 | 模型 · 智能体 · 小程序 · 连接器 · 技能 · 插件 |

### 平台

| 分区 | 叶子 |
| --- | --- |
| 仪表盘 | 平台概览 `/admin/platform` |
| 工作负载 | 工作流 · 函数 · 智能体 `/admin/agents` · 耐久单元 `/admin/cells` |
| AI | 推理 · 模型 · 连接器 · 技能 |
| 基础设施 | 网关 · 集群 |
| 可观测性 | 拓扑 · 日志 `/admin/logs` |

### 设置

| 分区 | 叶子 |
| --- | --- |
| 通用 | 系统 · 应用 |
| 团队与权限 | 成员 · 职位 · 角色 `/admin/team/*` |
| 安全与登录 | 授权登录 `/admin/settings/sign-in`（微信 · 飞书 · 钉钉 · 企业微信） · 验证码 |
| 系统配置 | 启动配置 · 运行时配置 `/admin/settings/runtime` · 调试 |
| 行政 | 地区 · 机关 · 园区 · 高校 |
| 分类 | 行业 · 产业 · 标签 |

---

## 已退出现行侧栏

旧八域裁定里标过保留或晋升、但 `OS_NAV_GROUPS` 没有挂上的叶子：

| 叶子 | 现行 |
| --- | --- |
| 商品 `/admin/products` | 菜单、目录页和商品详情已删除。旧地址落到 `/admin` |
| 内容（文章、页面、分类、标签、媒体库、评论） | 分组、页面和内容接口已删除。旧地址落到 `/admin` |
| 经营 `/overview/business`、增长 `/overview/growth` | 无此路由 |
| `/overview/ops` | 重定向到 `/admin/topology` |
| 凭证、审计 | 重定向到成员 |
| 通知 | 重定向到日志 |
| 工作负载 | 重定向到网关 |
| 制品、流水线 | 重定向到资产智能体列表 |
| 市场、已开通、源码 | 有页面，未进分组 |

凭证和审计仍缺能力。上表只说明侧栏上没有这两片叶子。

仍拒绝抬栏：Agent 审批另栏（并入工单）、Run 列表另栏、Inference 的策略/密钥/限额 Tab、Provider 目录、Capability Key、试探、PipelineRun、Drain 向导、Traces/Replay。

---

## 明确不进侧栏（平台边界）

- Kense Monitor / Finance 等**方案**导航  
- 行业工作台、预测看板、交易台  
- Token Hub / 钱包 / 充值  
- 创建类 Wizard、任意 `/:id` Detail  
