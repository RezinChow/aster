# Wireframes — 概览

依据 [ARCHITECTURE.md](../ARCHITECTURE.md) · [PRINCIPLES §4](../PRINCIPLES.md) · [SIDEBAR.md](../SIDEBAR.md)。

**侧栏仪表盘只有两片：** 运营域的概览 `/admin`，平台域的平台 `/admin/overview/platform`。`/admin/overview/ops` 重定向到拓扑。没有经营、增长路由。

---

## W-OV-1 总览 `/admin`

`OverviewPage` 的 `lens="home"`。首屏是 KPI、套餐、漏斗；其下是资源库存和排行。这些卡片今天仍是未标明的本地数据，见平台服务缺口，不把它们写成已接控制面。

## W-OV-3 平台 `/admin/overview/platform`

**规范权威：** [PLATFORM-DASHBOARD-VIEWS.md](../PLATFORM-DASHBOARD-VIEWS.md)。

脊梁、Gateway、Runtime 三格走实探。饱和度、资源池、词元热力、服务库存、模型排行仍是未标明的本地数据。日志和 API 流量标了示意。

主链到 `/admin/gateway` 与 `/admin/fleet`。

**不做：** 经营仪表盘、增长仪表盘、钱包、云厂商原生控制台。

---

## 验收

1. 仪表盘只有概览和平台两片，路由能高亮。
2. 未接控制面的卡片必须标明预览。
3. 用量表述为 showback，无充值。
