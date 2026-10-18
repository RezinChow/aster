# Wireframes — P4 运营 · 商业 · 系统


> **交付切片线框**（非 ActivityBar 域名）。导航权威：[shell.md](./shell.md) · [SIDEBAR.md](../SIDEBAR.md) · `destinations.ts`。


## W-P4-1 Events & Logs

```text
事件                              [日志查询]

筛选：[级别] [平面] [时间]

│ 时间     │ 平面     │ 级别 │ 消息                    │
│ 14:09:12 │ Gateway  │ info │ Route /v1/agent scaled… │
│ 14:05:19 │ Workload │ error│ replica … readiness    │

点击行 → Drawer：相关资源链接 + correlation id

日志查询：
correlation [____________]  from/to  [查询]
结果流式表格 · 复制查询
```

## W-P4-2 Usage

摘要；**完整线框（含 showback / 客户桥 / 反模式）**见 [inference-usage.md](./inference-usage.md)。

```text
用量 · 商业投影（非账单）
范围：当前 Org / Env
维度：[模型|路由|主体|项目|天]

┌ 请求 42.6k ┐ ┌ Token 1.2B ┐ ┌ 错误率 0.08% ┐ ┌ 估算成本 ※showback ┐

表格 rollup …
[导出 CSV] → Toast：Operation op_… [查看]
※ 无充值/余额/发票 CTA
```

## W-P4-3 Notifications

```text
通知
[订阅|投递失败]

订阅：
│ 事件类型        │ 渠道    │ 目标          │
│ workload.degraded│ webhook │ https://…    │
│ audit.danger    │ email   │ sec@orbit.io │

失败队列：
│ 时间 │ 目标 │ 错误 │ [重试] │
```

## W-P4-4 System（平台）

```text
系统                              仅平台角色可见

健康：api ✓  worker ✓  relay ✓  postgres ✓
版本：control-plane 1.87.0 · contract 1.87.0

[Provider 信任] [Registry 信任] [升级] [备份恢复]

升级向导：
选择目标版本 → 预检 → Operation → 混合版本窗提示
```

## W-P4-5 Customers Detail

```text
客户 / Orbit Labs
enterprise · 正式 · 席位 42/60
                                    [编辑] [更多]
绑定 Organization：Orbit Labs  [打开组织]

[概览|成员|用量|合同]

用量摘要（投影）：
本月请求 12.1k · Token … · [完整用量]

席位：
████████████░░░░  42/60
```

## W-P4-6 Overview（控制台首页）

```text
概览                              [事件流] [打开流程]

┌ Flows ┐ ┌ Gateway rpm ┐ ┌ Fleet ┐ ┌ Policies ┐

┌ 平面健康 2/3 宽 ─────────────┐ ┌ 最近事件 ┐
│ Gateway / Flows / Runtime    │ │ …        │
└──────────────────────────────┘ └──────────┘

┌ 活跃流程表 ─────────────────────────────────┐
│ name · status · step · duration             │
└─────────────────────────────────────────────┘
```
