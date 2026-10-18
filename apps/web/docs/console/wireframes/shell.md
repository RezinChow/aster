# Wireframes — Shell · Scope · ActivityBar · Settings

依据 [PRINCIPLES §4](../PRINCIPLES.md) · [SIDEBAR.md](../SIDEBAR.md) · `src/shell/destinations.ts`。

---

## W-S0 ActivityBar

四域顺序：运营 · 研发 · 平台 · 设置。

**侧栏折叠：** 悬浮在侧栏/主区接缝的圆形 chevron（不在 ActivityBar 内）。

---

## W-S1 侧栏

```text
运营
  仪表盘 · 概览
  商务 · 客户 渠道商 供应商
  业务 · 商品 订单 订阅 工单

研发
  代码仓库 · 智能体 工作流 接口服务 连接器
  资源仓库 · 小程序 技能 工具 知识库
  制品仓库 · 包仓库 镜像仓库 模型仓库

平台
  仪表盘 · 平台
  运行 · 工作流 函数 智能体 耐久单元 推理
  资源 · 网关 集群
  观察 · 拓扑 事件总线 消息队列 日志 用量
  企业 · 成员 职位 角色

设置
  通用 · 行政 · 分类 · 配置 · 开发者
```

叶子以 `destinations.ts` 的 `OS_NAV_GROUPS` 为准。经营、增长、凭证、审计、通知、工作负载不在侧栏上。

---

## W-S2 边界

```text
✓ 工单是收件箱，不另开审批栏
✗ 推理的策略、密钥、限额、Provider、Capability Key、试探不抬栏
✗ 方案（Monitor 等）进 OS 侧栏
✗ 经营、增长、凭证、审计、通知、工作负载不进侧栏
```
