# Wireframes — P3 Workloads · Fleet · Edge


> **交付切片线框**（非 ActivityBar 域名）。导航权威：[shell.md](./shell.md) · [SIDEBAR.md](../SIDEBAR.md) · `destinations.ts`。


## W-P3-1 Workloads List / Detail

```text
工作负载
│ 名称            │ Runtime        │ 副本 │ CPU │ 状态   │
│ operations-flow │ a3s-flow 0.9 │ 6/6  │ 42% │ healthy│

Detail
operations-flow                    [扩缩] [回滚] [更多]
[概览|修订|部署|事件|访问]

修订：
r5 (current) · r4 · r3
滚动：████████░░ 80%  ready 5/6

关联：
Edge targets 2 · Pipeline receipt run_551 · Events 4
```

## W-P3-2 Fleet

```text
机群                         [节点|资源池]

节点 Tab：
│ 节点         │ 区域 │ 角色    │ 负载 │ 版本  │ 状态    │
│ node-hkg-01  │ hkg  │ Runtime │ 61%  │ 0.9.2 │ ready   │
│ node-sjc-gpu │ sjc  │ Power   │ 91%  │ 0.9.2 │ draining│

资源池 Tab（FL-6）：
│ 池              │ kind │ 区域 │ 利用率 │ 可分配        │ 健康       │
│ runtime-hkg     │ cpu  │ hkg  │ 61%    │ 198 vCPU     │ healthy    │
│ runtime-nrt     │ cpu  │ nrt  │ 91%    │ 18 vCPU      │ saturated  │
│ power-sjc       │ gpu  │ sjc  │ 75%    │ idle 3       │ degraded   │
│ artifacts-prim  │ obj  │ hkg  │ 41%    │ 23.6 TiB     │ healthy    │

Node Detail
[排水] [结束排水] [维护窗口]

Claims：
│ Workload         │ 设备 │ 世代 │
│ power-infer      │ gpu0 │ g19  │

排水确认：
将影响 3 个 Workload。继续？
```

## W-P3-3 Gateway / Edge

```text
网关 / 边缘                 [域名|路由|快照]

域名：
│ example.com │ 证书有效 89d │ Gateway scope gs_1 │

路由意图 vs 已应用：
│ 路径       │ 类型      │ 意图 ver │ 已应用 │ rpm   │
│ /v1/agent  │ Agent     │ 12       │ 12 ✓   │ 12.4k │
│ /v1/infer  │ Inference │ 9        │ 8 ⚠    │ 6.7k  │

⚠ 意图与已应用不一致 — [查看快照差异]

快照历史：
snap_88  published 14:01  by ci-bot
snap_87  published  yesterday
```
