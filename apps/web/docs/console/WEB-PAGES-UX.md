# Web 全站页面 UI/UX 验收

> **地位：** `apps/web` 页面相对 [PAGE-UX.md](./PAGE-UX.md) 的实现验收；冲突时以 PAGE-UX · PRINCIPLES · DESIGN 为准。  
> **范围：** 路由内真实页 + IA 占位页；不含控制面 API 产品深度（Inference 路由编辑等延后）。

## 门禁（PAGE-UX §9）

全站 `pages/*` 已清零：裸 `Table` · `window.confirm` · 筛选用原生 `<select>`。

| 门禁 | 证据 |
| --- | --- |
| AdminPageShell / 模式铬 | 实现页均挂壳；Login 独立；Overview 用 PageHeader |
| List：ListToolbar · DataTable/卡片 · Empty 分流 | Flows · Workloads · Fleet · Gateway · Customers · Channels · Entitled · Models · Sources · Users · Market |
| Directory | Organizations |
| Detail | Flow · Channel · Market Listing · User Drawer |
| Timeline | Events · Flow journal |
| Wizard | Invite · Channel create |
| Overview 首屏 ≤4 模块 | Home / Platform：注意力·KPI·主双栏在首屏；其余进 `os-overview__below` |
| 诚实占位 | PlaceholderPage · Inference（无假绿） |

## 明确非本波次

- 占位目的地的产品交互（Agents / Tasks / Pipelines…）仍按 PRD 切片接通  
- Overview L4 图表不升 `@a3s/ui`  
- 部门负责人 / 工作空间列表 / PermissionMatrix 页内编辑（API 债）
