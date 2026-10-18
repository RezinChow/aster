# PRD P3 — Workloads · Fleet · Gateway/Edge

对齐 Cloud：Workloads、Fleet、Edge（Gateway 快照发布）。

## 1. Workloads

升级现有列表为完整运营面。

| ID | 需求 | 优先级 |
| --- | --- | --- |
| WL-1 | List：运行时、副本、CPU、状态 | P3（`/admin/workloads` 重定向到网关，列表未挂页） |
| WL-2 | Detail：Revision 历史、Deployment、滚动状态 | P3 |
| WL-3 | 操作：扩缩、暂停、回滚 revision | P3 |
| WL-4 | 关联：Edge target、Pipeline receipt、Events | P3 |
| WL-5 | Source / Agent / OCI 工作负载创建向导 | P3 |

## 2. Fleet

| ID | 需求 | 优先级 |
| --- | --- | --- |
| FL-1 | Node 列表：区域、角色、负载、版本、状态 | P3（基线已有） |
| FL-2 | Node Detail：拓扑、GPU、当前 Claims | P3 |
| FL-3 | Drain / 维护窗口 / 取消排水 | P3 |
| FL-4 | NodePool 与容量策略（平台角色）：**区分 Runtime(CPU) / Power(GPU) / 存储亲和** | P3 |
| FL-5 | 放置失败原因可读化 | P3 |
| FL-6 | **资源池投影**（供 [PLATFORM-DASHBOARD-VIEWS](../PLATFORM-DASHBOARD-VIEWS.md) V3） | P3 |

### FL-6 资源池投影字段

| 池 kind | 必投字段 |
| --- | --- |
| `cpu` | capacity/allocatable（vCPU·内存）、nodesReady/Total、usedRatio、pending/failed Claims、unschedulableTop |
| `gpu` | accelerators Total/idle/draining/unhealthy、servingState、queuedInferClaims、usedRatio |
| `object` | endpointReachable、used/quota bytes、writeErrorRate、ttlPolicy、deletionProof 灯 |
| 共用 | health ∈ {healthy,saturated,degraded,unreachable}、region、深链 filter |

**验收：** 平台仪表盘可只读渲染池卡；饱和/不可达进入 Attention；无云厂商控制台嵌入。

## 3. Gateway / Edge

升级现有 Gateway 路由表。

| ID | 需求 | 优先级 |
| --- | --- | --- |
| ED-1 | Domain / 证书状态 | P3 |
| ED-2 | Route 意图列表 + 已应用快照版本 | P3 |
| ED-3 | Gateway Route 与 rpm/错误率投影（现有） | P3 |
| ED-4 | Snapshot 发布历史与差异 | P3 |
| ED-5 | MCP / Inference 路由策略入口 | P3 |

**验收：** 「意图版本」与「已应用版本」不一致时强提示；禁止暗示 Cloud 直接代理请求体。

## 跨模块

Workload 详情一键「查看 Edge 目标」；Fleet 排水前显示受影响 Workload 数。
