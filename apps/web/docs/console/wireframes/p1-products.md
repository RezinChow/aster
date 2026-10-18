# Wireframes — P1 产品泳道（**交付切片**，非 ActivityBar 域名）

> 导航权威：[shell.md](./shell.md) · [SIDEBAR.md](../SIDEBAR.md) · `destinations.ts`。  
> 本文件按 PRD 02 交付分组；编排域含 **人工任务 `/tasks`**，能力域市场线框见 [marketplace.md](./marketplace.md)。

## W-P1-0 产品 List 通用

```text
{泳道名}                         [次要] [新建]
一句话说明

[搜索]  (状态筛选 chips)

stats × 3

table / cards …
```

## W-P1-1 Agents

```text
Agents                              [新建 Agent]

│ Agent        │ Revision │ Env  │ 状态   │ 最近执行 │
│ support-bot  │ r12      │ prod │ ready  │ 2m 前   │

Detail tabs: [概览|修订|执行|访问]
执行详情右侧：
┌ Scope prod ┐
┌ Workload wl_… ┐
┌ Digest sha… ┐
时间线：invoke → tool → await.approval → …
待审批：深链 **人工任务** `/tasks`（不在此页另开收件箱）
```

## W-P1-2 人工任务收件箱（`/tasks`）

```text
人工任务                              [仅我的|全部]
│ 时间 │ 来源      │ 原因摘要        │ 超时 │ 操作        │
│ 14:02│ Agent     │ 需人工确认 sev2 │ 12m │ [通过][拒绝]│
│ 14:08│ Workflow  │ human-ack …    │ 15m │ [通过][拒绝]│
```

> Agent 审批与 Flow HumanTask **同一叶子**；见 [SIDEBAR.md](../SIDEBAR.md)。

## W-P1-3 Workflows / Runs

```text
Workflows            [定义|运行]
运行 Tab：
│ 名称                  │ 状态     │ 步骤              │ 重放 │
│ monitor.incident…     │ running  │ await.human-ack   │ 0    │

Run Detail
┌ 步骤 journal ──────────────────────────────┐
│ 1 invoke   14:02:11  monitor.incident…     │
│ 2 complete 14:02:12  fetch.signals → 14    │
│ 3 await    14:08:29  human-ack timeout=15m │ ← 当前
└────────────────────────────────────────────┘
[重放] [取消] [打开 HumanTask]
```

## W-P1-4 Functions

```text
Functions
│ 名称     │ Release │ 模式     │ 并发 │ 状态 │
│ etch-pdf │ r3      │ Task     │ 20   │ ok   │

Invocation 抽屉：
状态 succeeded · 时延 820ms · idempotency key …
输入/输出 JSON 折叠面板
```

## W-P1-5 Durable Cells

```text
Cells
│ Application │ Revision │ Deployment │ Writer │ 状态   │
│ collab-doc  │ 5        │ dep_2      │ fenced │ active │

Detail：
[休眠] [唤醒]  存储 profile · 最近备份 op_…
```

## W-P1-6 Inference

摘要壳；**完整线框**见 [inference-usage.md](./inference-usage.md)。

```text
Inference     [概览|路由|策略|密钥|访问|限额|护栏|诊断|用量]

路由：
│ 路由 ID   │ 模型        │ 状态    │ Edge 绑定 │ 操作   │
│ rt_chat   │ a3s-l2    │ active  │ snap_88   │ 修订…  │
│ rt_embed  │ emb-small   │ retiring│ snap_87   │ …      │

用量页签 → 完整 Usage；无 Token Hub / Token Plan 入口
```

## W-P1-6b 市场 Marketplace

摘要壳；**完整线框**见 [marketplace.md](./marketplace.md)。

```text
市场          [浏览|Provider|密钥|用量]
已开通        → 侧栏叶子 /marketplace/entitled（非本页 Tab）

浏览：Kind / Provider chips · 卡片 Listing · [开通]
Provider 模板：World Monitor · Polymarket · AIsa · …
与 Inference：model Listing 开通 → 路由候选；密钥同一资源
```

## W-P1-7 Applications / Web

```text
Applications
│ App     │ 绑定              │ Web Release │ 流量 │
│ console │ agent+workflow    │ web_r9      │ 100% │

Release Detail：
r9 (current) ── r8 ── r7
[切到 r8 回滚]  需确认 Modal
预览 URL https://…  证书 ok
```
