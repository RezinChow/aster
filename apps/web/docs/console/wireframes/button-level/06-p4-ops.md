# 按钮级线框 — P4 运营 · 商业 · 系统

## Events & Logs

```text
#EV01 [日志查询] ·secondary → 日志页
#EV02 筛选 级别/平面/时间 ·chip/field
#EV03 行 → Drawer
#EV04 Drawer [打开资源] ·primary
#EV05 Drawer [复制 correlation] ·icon
#LG01 [查询] ·primary · enable: 时间窗合法
#LG02 [复制查询] ·ghost
#LG03 [告警规则] ·secondary
```

## Usage

基线；**完整（showback/下钻/禁止支付 CTA）**见 [07-inference-usage.md](./07-inference-usage.md)。

```text
#USE01 维度 chips ·chip
#USE02 [导出 CSV] ·secondary → Operation Toast
#USE03 Toast [查看] ·ghost → /ops/:id
#USE04 [打开客户详情] ·ghost · 当 scope=Org
```

## Notifications

```text
#NT01 Tabs [订阅|投递失败]
#NT02 [添加订阅] ·primary
#NT03 [保存订阅] ·primary
#NT04 [删除订阅] ·danger · confirm
#NT05 失败行 [重试] ·row · loading
#NT06 [全部重试] ·secondary · enable: 失败数>0 · confirm
```

## System（平台）

```text
#SYS01 [Provider 信任] ·secondary
#SYS02 [Registry 信任] ·secondary
#SYS03 [升级] ·primary → 升级向导
#SYS04 [备份恢复] ·secondary
#SYS05 向导 [预检] ·secondary
#SYS06 向导 [开始升级] ·danger · confirm「进入混合版本窗」
#SYS07 [平台角色绑定] ·ghost → Permissions 平台平面
```

## Customers

```text
#CU01 [导出] ·secondary
#CU02 [新建客户] ·primary → 向导（Org+套餐+Owner）
#CU03 状态 chips ·chip
#CU04 [编辑] ·row
#CU05 [更多]：流失标记 ·danger · confirm / 恢复试用
#CU06 [打开组织] ·secondary → Organizations 选中绑定 Org
#CU07 [完整用量] ·ghost → Usage 预填 Org
#CU08 向导 [创建] ·primary · loading
```

## Overview

```text
#OV01 [事件流] ·secondary → /events
#OV02 [打开流程] ·primary → /flows
#OV03 平面卡片 ·ghost → 对应模块
#OV04 最近事件行 ·ghost → Event Drawer
#OV05 活跃流程名链接 ·ghost → Run Detail
```
