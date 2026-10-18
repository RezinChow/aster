# Kense OS — 平台仪表盘视图规范（CTO）

| 字段 | 值 |
| --- | --- |
| 地位 | 架构附录（服从 [ARCHITECTURE.md](./ARCHITECTURE.md) · [PRINCIPLES.md](./PRINCIPLES.md)） |
| 路由 | `/admin/overview/platform`（平台 · 仪表盘 · 平台） |
| 角色 | **CTO / Platform Owner / Platform Operator** |
| 问题 | 平台仪表盘按第一性原理与业界最佳实践 **应具备哪些视图** |
| 非范围 | COO 收件箱、CEO 经营 KPI、CMO 渠道增长、解决方案业务 UI |

---

## 0. 第一性结论（先钉死）

平台仪表盘回答的唯一问题：

> **控制面与基础设施现在是否健康、哪里在饱和、意图与执行是否漂移、下一步该打开哪条权威运营页？**

由此导出约束：

| # | 原理 | 对视图的含义 |
| --- | --- | --- |
| 1 | OS ≠ 业务系统 | 不展示行业 KPI、Monitor 地图、交易台 |
| 2 | Console 只投影 | 无浏览器侧权威配额/调度；卡片深链 Gateway / Fleet / Inference … |
| 3 | 一切昂贵调用过 Gateway | **Gateway 黄金信号是平台首页第一公民** |
| 4 | 期望状态 ≠ 执行 | 必须有 **Drift（意图 vs 已应用）** 视图 |
| 5 | Fleet / Box / Power / 存储是基础设施 | 必须有 **资源虚拟化池** 视图：CPU 集群 · GPU/Power 集群 · 对象存储（及必要的网络/卷） |
| 6 | Inference / Market 是可替换后端 | 只看 **Serving/Adapter 健康与触顶**，不做商业结算 |
| 7 | 模块数可控 | 首屏 ≤ 4 个主模块；资源池明细可滚入第二屏或深链 `/fleet` |
| 8 | 虚拟化 ≠ 云厂商控制台 | 看 **Kense 抽象的 Pool/Claim/配额/健康**；不嵌 AWS/K8s 原生控制台 |

**与其它仪表盘分工：**

| 仪表盘 | 主问 |
| --- | --- |
| 概览 `/admin` | 跨角色一句话：有没有事？ |
| **平台** `/admin/overview/platform` | **平台能不能扛、资源池是否够、意图有没有落地？** |

没有单独的运营、经营、增长仪表盘。`/admin/overview/ops` 重定向到拓扑。工单、用量、客户、渠道商各自有叶子。

---

## 1. 业界方法 → Kense 映射

| 业界方法 | 来源 | Kense 落点 |
| --- | --- | --- |
| **Four Golden Signals**（Latency · Traffic · Errors · Saturation） | Google SRE | **V1 Gateway 黄金信号** |
| **RED**（Rate · Errors · Duration） | Grafana / 微服务 | Gateway + Inference 请求面 |
| **USE**（Utilization · Saturation · Errors） | Brendan Gregg | **V3 资源虚拟化池**（CPU · GPU · 存储） |
| 症状优先、仪表盘≠告警 | AWS Builders' Library · SRE | Attention 条只列 **已影响/将影响** 症状；告警权威在 Events/外部 |
| 自上而下：摘要 → 深链 | AWS Console Home · Health Dashboard | KPI + 平面卡 → `/gateway` `/fleet` … |
| Cluster / Nodes / Workloads / Ingress / Storage | Kubernetes Dashboard · CSI | Fleet NodePool · Workloads · Gateway/Edge · **对象存储桶/卷** |
| Intent vs Applied | GitOps / Edge 快照 | **V2 Drift**（Kense 特有必选项） |
| Capacity / Quota / Claim | K8s ResourceQuota · 云资源池 | **Pool → Claim → Workload/Box** 虚拟化账本 |

参考（调研链接，非产品依赖）：

- [Google SRE — Monitoring Distributed Systems / Golden Signals](https://sre.google/sre-book/monitoring-distributed-systems/)
- [AWS — Building dashboards for operational visibility](https://aws.amazon.com/builders-library/building-dashboards-for-operational-visibility/)
- [AWS Well-Architected OPS08-BP05 Create dashboards](https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_workload_observability_create_dashboards.html)
- [Grafana — Dashboard best practices (USE/RED)](https://grafana.com/docs/grafana-cloud/learn-and-build/visualizations/dashboards/build-dashboards/best-practices/)
- [Kubernetes Dashboard 资源视图模型](https://kubernetes.io/docs/tasks/access-application-cluster/web-ui-dashboard/)

---

## 2. 应具备的视图清单（规范）

> **视图** = 仪表盘上的一块可理解单元（可深链，不抬成 ActivityBar 新域）。  
> **权威页** = 侧栏里的运营真相页；仪表盘禁止第二真相源。

### V0 · Attention（症状条）— P0

| 项 | 说明 |
| --- | --- |
| **职责** | 只列「现在就要人看」的平台症状 |
| **典型条目** | Edge 意图≠已应用；Fleet offline/draining；**CPU/GPU 池饱和或不可调度**；**对象存储配额触顶/不可达**；Workload 副本未收敛；Inference Serving 不可用；Provider adapter down；证书将过期；支出硬顶将熔断平台调用 |
| **权威** | Events + 各平面状态 API |
| **交互** | Chip → 权威页或预过滤 Events |
| **非目标** | HumanTask 收件箱（属运营仪表盘） |

### V1 · Gateway 黄金信号 — P0

| 项 | 说明 |
| --- | --- |
| **职责** | 咽喉是否健康：流量、延迟、错误、饱和 |
| **指标（投影）** | rpm / 并发；p50·p99 延迟；错误率 / `policy_denied` / `spend_capped`；限流触顶次数 |
| **权威** | Gateway ledger · Edge 快照 · [prd/04](./prd/04-p3-runtime-edge.md) ED-* |
| **深链** | `/gateway` |
| **非目标** | 请求体代理、按上游厂商拆多 Key |

### V2 · Drift（期望 vs 执行）— P0

| 项 | 说明 |
| --- | --- |
| **职责** | Kense 控制面核心不变量的可视化 |
| **内容** | Edge Route revision：意图 vs 已应用；Workload 期望副本 vs 就绪；Inference policy revision 是否生效；**资源池 headroom 策略 vs 实测**；关键 Operation 卡在收敛 |
| **行字段** | `plane` · `title` · `desired` · `observed` · `severity` · `href` |
| **权威** | Edge · Workloads · Inference revisions · Pool 策略 · Operations |
| **深链** | `/gateway` · `/workloads` · `/inference` · `/fleet` · Audit/Ops |
| **非目标** | 在仪表盘上「一键强制对齐」而不经 Operation |

```text
漂移
│ 平面     │ 对象              │ 期望            │ 观测              │
│ edge     │ /v1/infer         │ route rev 9     │ applied rev 8 ⚠   │
│ workload │ power-infer       │ 4/4             │ 3/4 ready ⚠       │
│ pool     │ runtime-nrt       │ headroom ≥ 15%  │ 9% · pending 7 ⚠  │
```

### V3 · 资源虚拟化池（CPU · GPU · 存储）— P0

**要看。** 平台仪表盘必须投影底层资源的 **虚拟化与供给态**，而不是只看「节点个数」。

#### 3.0 领域模型（权威）

```text
ResourcePool (虚拟化池)
  id · kind ∈ {cpu, gpu, object, volume, network}
  region · capacity[] · allocatable[] · health
       │
       ├─ Node / Bucket / Volume  (池成员，Fleet 或数据面登记)
       │
       ▼
Claim (租约，不可变世代)
  poolId · consumer(Workload|Box|Power|ArtifactPrefix)
  request · state ∈ {pending, bound, failed, releasing}
       │
       ▼
Consumer 运行态（副本 / Serving / 写入）
```

| 概念 | 含义 | 不含义 |
| --- | --- | --- |
| **Pool** | 可调度/可写入的虚拟容量账本 | 云账号里的「集群控制台」 |
| **Claim** | 消费者对池的有界租约 | 无限抢占；浏览器本地计数 |
| **allocatable** | 调度器此刻仍可承诺的量 | 厂商 Marketing vCPU |
| **health** | healthy / saturated / degraded / unreachable | 业务 SLA 合同状态 |

**状态机（池）：**

| health | 判定（投影规则） | Attention？ |
| --- | --- | --- |
| `healthy` | allocatable 充足且成员多数 Ready、无写失败尖峰 | 否 |
| `saturated` | usedRatio ≥ 软顶 **或** pendingClaims 持续 > 0 且 headroom < 阈值 | **是** |
| `degraded` | 部分成员 NotReady/draining，或 Serving 降级但仍有容量 | **是** |
| `unreachable` | 控制面探活失败 / 存储 endpoint 不可达 | **是（danger）** |

#### 3.1 字段目录（仪表盘投影）

**所有 Pool 卡片共用：**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | 池名（如 `runtime-hkg`） |
| `kind` | enum | cpu / gpu / object / … |
| `region` | string | 区域或「安装内」 |
| `health` | enum | 上表 |
| `usedRatio` | 0–1 | 稀缺资源利用率（CPU 用 max(cpu,mem)；GPU 用卡占用；对象用字节） |
| `capacityLabel` | string | 总容量人读（`512 vCPU · 2TiB`） |
| `allocatableLabel` | string | 可承诺余量人读 |
| `pendingClaims` | int | 排队租约 |
| `failedClaims` | int | 近窗失败租约 |
| `note` | string? | 顶层不可调度/触顶原因一行 |
| `href` | path | 深链权威页（带 filter） |

**V3.1 CPU（Runtime NodePool）另加：**

| 字段 | 说明 |
| --- | --- |
| `nodesReady / nodesTotal` | 成员节点 |
| `cpuAllocatable` / `memAllocatable` | 分资源余量 |
| `unschedulableTop` | 如 `Insufficient cpu` · `Taint` · `Affinity` |

**V3.2 GPU / Power 另加：**

| 字段 | 说明 |
| --- | --- |
| `acceleratorsTotal / idle / draining / unhealthy` | 卡级账本 |
| `servingState` | `ready` / `degraded` / `unavailable`（与 INF-O 假绿禁令一致） |
| `queuedInferClaims` | 等 GPU 的 Inference/Workload Claim |

**V3.3 对象存储另加：**

| 字段 | 说明 |
| --- | --- |
| `endpointReachable` | bool |
| `usedBytes` / `quotaBytes` | 配额账本 |
| `writeErrorRate` | 近窗写失败 |
| `ttlPolicy` | 如 `24h ephemeral` / `tenant-prefix` |
| `deletionProof` | 策略是否开启（只读灯） |
| `boundConsumers` | Artifact / parse worker / 租户前缀数 |

**V3.4 卷（轻）：** `volumeBindFailures` · `diskPressurePods`  
**V3.5 网络（轻）：** `egressMode` ∈ {open, allowlist, deny-egress} · `egressDenies1h` · `adapterUnreachable`

#### 3.2 阈值与 Attention 文案（默认）

| 条件 | severity | 文案模板 |
| --- | --- | --- |
| CPU/GPU `usedRatio` ≥ 0.85 且 pendingClaims > 0 | warn | `{pool} 饱和 · {n} 个 Claim 排队` |
| GPU `servingState=unavailable` | danger | `Power Serving 不可用 · {pool}` |
| 对象存储 `!endpointReachable` | danger | `对象存储不可达 · {pool}` |
| 对象存储 `usedRatio` ≥ 0.90 | warn | `{pool} 配额将尽 · {free} 剩余` |
| `egressMode=deny-egress` 且 adapter 需要外网 | warn | `禁外网模式 · {n} 个适配器受影响` |

阈值属 Installation 策略修订，仪表盘只投影。

#### 3.2.1 Claim 生命周期（投影用）

| state | 仪表盘含义 | 计入 |
| --- | --- | --- |
| `pending` | 调度器尚未绑定池成员 | `pendingClaims`；饱和 Attention |
| `bound` | 租约生效，消费者可运行/写入 | `usedRatio` 分子 |
| `failed` | 近窗放置失败（原因码保留） | `failedClaims` + 放置失败表 |
| `releasing` | 释放中，容量尚未回到 allocatable | 仍占 used，直至观测确认 |

**失败原因码（放置失败表 `reason` 前缀，权威在 Fleet/存储控制面）：**

| 前缀 | 典型场景 |
| --- | --- |
| `Insufficient cpu` / `mem` | Runtime NodePool 余量不足 |
| `No healthy Power` | GPU 池 draining / Serving down |
| `Object pool soft-cap` | 对象配额触顶拒绝写 |
| `Affinity` / `Taint` | 调度约束（深链 Fleet 节点） |

#### 3.3 子视图职责（续）

##### V3.1 CPU 计算集群 / Runtime NodePool

| 项 | 说明 |
| --- | --- |
| **职责** | 通用计算（Runtime）是否够、是否可调度 |
| **权威** | Fleet NodePool（role=Runtime）· Claims · [prd/04](./prd/04-p3-runtime-edge.md) FL-* |
| **深链** | `/fleet?role=Runtime` |
| **非目标** | 云厂商 ASG/MIG 嵌入；机柜 U 位图 |

##### V3.2 GPU / Power 集群

| 项 | 说明 |
| --- | --- |
| **职责** | 推理与重算力池是否可服务、是否饱和 |
| **权威** | Fleet NodePool（role=Power）· Inference local Power · Box GPU 绑定 |
| **深链** | `/fleet?role=Power` · `/inference` |
| **非目标** | 单卡温度曲线大盘；假绿「有 GPU」但 Serving down |

##### V3.3 对象存储与数据面

| 项 | 说明 |
| --- | --- |
| **职责** | Artifact / 解析产物 / 租户前缀对象存储虚拟化 |
| **权威** | 数据面绑定 · Supply · [PLATFORM-SERVICES-GAPS](./PLATFORM-SERVICES-GAPS.md) |
| **深链** | `/system?panel=storage` · `/artifacts` |
| **非目标** | S3 控制台；按对象浏览业务文件 |

##### V3.4 块/卷与 Box 本地存储（P1）

| 项 | 说明 |
| --- | --- |
| **职责** | Cell/Box 持久卷与本地盘压力 |
| **深链** | `/workloads` · Cell 详情 |
| **非目标** | 完整 CSI/PVC IDE |

##### V3.5 网络与出口姿态（P1）

| 项 | 说明 |
| --- | --- |
| **职责** | 禁外网 / allowlist / 适配器连通 |
| **深链** | `/gateway` · `/system` |
| **非目标** | VPC/安全组编辑器 |

#### 3.4 线框（平台页 · 资源池模块）

```text
资源虚拟化                              [打开 Fleet]  [存储姿态]
CPU 61% · GPU 75% · 对象 41% · 网络 allowlist · 饱和池 2 · 排队 Claim 13

┌ CPU runtime-hkg ── healthy ──┐ ┌ CPU runtime-nrt ─ saturated ─┐
│ 512 vCPU · 可分配 198         │ │ 256 vCPU · 可分配 18          │
│ ████████░░ 61%                │ │ █████████░ 91%               │
│ pending 2                     │ │ pending 7 · fail 1           │
│                               │ │ ⚠ Insufficient cpu …         │
└───────────────────────────────┘ └──────────────────────────────┘
┌ GPU power-sjc ── degraded ───┐ ┌ 对象 artifacts-primary ──────┐
│ 12×A100 · idle 3 · drain 1    │ │ 40 TiB · free 23.6 · TTL —   │
│ Serving: degraded             │ │ ████░░░░░░ 41%               │
│ queued infer 4                │ │ reachable ✓                  │
└───────────────────────────────┘ └──────────────────────────────┘

放置失败（近窗）
│ 时间    │ 池            │ 消费者              │ 原因                    │
│ 14:07   │ runtime-nrt   │ science.run.ingest  │ Insufficient cpu …      │
```

### V4 · Workload 收敛 — P0

| 项 | 说明 |
| --- | --- |
| **职责** | 运行时负载是否按期望落地 |
| **内容** | 按状态汇总（healthy / degraded / pending）；高 CPU/内存告警负载；与 Edge target 关联摘要 |
| **权威** | Workloads · Runtime / Box · [prd/04](./prd/04-p3-runtime-edge.md) WL-* |
| **深链** | `/workloads` |
| **非目标** | Agent 对话内容、业务 Run 语义（属编排/运营） |

### V5 · Inference Serving 健康 — P1

| 项 | 说明 |
| --- | --- |
| **职责** | 模型咽喉后端是否可服务、是否触顶 |
| **内容** | 活跃 Route 数；Provider/Power 健康；近 1h 错误；限额触顶次数；「Serving 不可用」显式态（禁假绿） |
| **权威** | Inference · [prd/06](./prd/06-inference-usage.md) INF-O |
| **深链** | `/inference`（诊断 Tab） |
| **非目标** | Token Plan / 钱包；完整用量经营分析（属经营仪表盘） |

### V6 · Capability Adapters（Market/Provider）— P1

| 项 | 说明 |
| --- | --- |
| **职责** | 上游适配器与同步管道是否健康（平台可靠性，非增长漏斗） |
| **内容** | Provider healthy/degraded/down；最近同步失败；影响的 Listing 数 |
| **权威** | Marketplace adapters · Entitlement 修订 |
| **深链** | `/marketplace`（Provider） |
| **非目标** | 开通转化率、渠道 OEM 经营（属增长） |

### V7 · 安装与系统姿态 — P1

| 项 | 说明 |
| --- | --- |
| **职责** | Installation 级：版本、证书、组件健康 |
| **内容** | 控制面版本；证书到期；System Health 组件灯；私有化/BYOC 模式标记 |
| **权威** | System · Secrets/证书 |
| **深链** | `/system` · `/credentials`（只读提示） |
| **非目标** | 设置偏好页、主题语言 |

### V8 · 平台信号流 — P1

| 项 | 说明 |
| --- | --- |
| **职责** | 近期平台相关事件（投影） |
| **过滤** | 默认 plane ∈ {Gateway, Workload, Policy} + Fleet 相关；排除纯业务 Flow 闲聊 |
| **权威** | Events |
| **深链** | `/events`（带过滤） |
| **非目标** | 完整日志检索 IDE |

### V9 · 供给就绪（轻量）— P2

| 项 | 说明 |
| --- | --- |
| **职责** | 阻塞发布的供给问题（影响平台变更能力） |
| **内容** | 失败 Pipeline 数；签名/晋级卡点；Registry 不可用 |
| **权威** | Supply |
| **深链** | `/pipelines` · `/registries` |
| **非目标** | 完整 CI 工作台搬进仪表盘 |

### V10 · 身份与护栏姿态（轻量）— P2

| 项 | 说明 |
| --- | --- |
| **职责** | 平台安全姿态摘要 |
| **内容** | 即将过期的 Credential；break-glass 未关闭；护栏策略覆盖缺口 |
| **权威** | Identity · Inference Guardrail · Audit |
| **深链** | `/credentials` · `/audit` · `/inference` 护栏 |
| **非目标** | 完整权限矩阵编辑 |

---

## 3. 推荐页面构图（`/overview/platform`）

业界共识：**最重要的在首屏上方**（AWS Builders' Library）。Kense 平台页建议：

```text
┌ Header（CTO · asOf · scope）────────── [打开 Gateway] [打开 Fleet]
├ V0 Attention（含资源池饱和 / 存储不可达；不含 COO 收件箱）
├ V1 KPI 黄金信号 ×4（可点）
│    Traffic · Latency · Errors · Saturation（含 CPU/GPU/对象池）
├ 首屏主模块
│  ┌ V2 Drift ──────────────┬ V3 资源池（CPU·GPU·对象存储）┐
│  └ 放置失败（近窗） ──────┴ V8 平台信号 ────────────────┘
└ 第二屏（后续）
   ┌ V4 Workload · V5 Inference · V6 Adapters · V7/V9/V10 · V3.4/V3.5 ┐
```

**不**为 V1–V10 各开侧栏叶子；深链进入运行/能力/运营权威页。若未来某视图日频独立操作且 URL 值得书签，再按 [SIDEBAR.md](./SIDEBAR.md) 晋升条件评估。

---

## 4. 明确不做（防过度设计）

| 禁止 | 原因 |
| --- | --- |
| 人工任务收件箱作平台主模块 | 属运营仪表盘 |
| 客户/渠道/开通漏斗 | 属经营/增长 |
| Token Hub / 钱包 / 充值 | PRINCIPLES §7 |
| 解决方案业务大屏 | OS ≠ 业务 |
| 把 Metrics 探索器做进概览 | 属 Events/System 或外部观测 |
| 仪表盘本地「权威」计数当真 | 违反五层真相 |
| 嵌云厂商 / 裸 K8s 控制台 | 只投影 Kense Pool·Claim·健康 |
| 无 Serving 时显示假绿 | INF-O 验收硬约束 |
| 只报「节点数」不报池饱和与存储 | **不完整**；CPU/GPU/对象存储虚拟化必须可见 |

---

## 5. 与现状差距（实现指导）

当前 `/overview/platform`（`OverviewPage` · `PlatformDashboard`）投影：

| 视图 | 现状 | 缺口 |
| --- | --- | --- |
| V0 Attention | 有；含资源池饱和；平台 lens 剔除收件箱项 | 存储不可达 / Serving 不可用独立 chip |
| V1 黄金信号 | **有** Traffic / Latency / Errors / Saturation KPI | 拆 `policy_denied` / `spend_capped` 子计数 |
| V2 Drift | **有** edge / workload / inference / pool 行 | Operation 卡死；更多 plane |
| V3 资源虚拟化 | **有** CPU·GPU·对象池卡片 + 放置失败表 | V3.1–V3.3 细字段（节点比、卡级账本、deletionProof）；V3.4/V3.5 轻量 |
| V4 Workload | 经 Drift 弱投影 | 收敛失败独立列表 |
| V5 Inference | 经 Drift / 池 note 弱投影 | Serving/触顶/假绿禁止专卡 |
| V6 Adapters | 无 | 同步失败与影响面 |
| V7–V10 | 无或极弱 | 按 P1/P2 追加 |

**代码落点：**

| 层 | 路径 |
| --- | --- |
| 规范 | `docs/console/PLATFORM-DASHBOARD-VIEWS.md` |
| 线框 | `docs/console/wireframes/overview.md` W-OV-3 |
| Mock 账本 | `src/data/platformPools.ts` |
| UI | `src/pages/OverviewPage.tsx` → `PlatformDashboard` |
| Fleet 权威字段 | [prd/04](./prd/04-p3-runtime-edge.md) FL-6 |

---

## 6. 验收问题

1. CTO 能否在 **30 秒内**判断：Gateway 是否受损、**CPU/GPU/对象存储池是否够用**、是否存在 Drift？  
2. 每一卡片是否都能深链到 **唯一权威页**，且不在仪表盘写第二账本？  
3. 无 Power/Serving 时是否出现 **不可用** 而非假绿？  
4. 是否出现客户漏斗、渠道经营、人工审批主列表？（期望：**否**）  
5. 首屏主模块是否 ≤ 4，且黄金信号在注意力条之后、详情之前？  
6. 资源视图是否展示 **Pool 虚拟化账本**（已用/可分配/触顶），而非仅节点枚举？（期望：**是**）

全部为「是」才视为本规范达标。

---

## 7. 修订规则

- 新增平台视图：先改本文，再改 [wireframes/overview.md](./wireframes/overview.md) W-OV-3，最后改 `OverviewPage` lens=`platform`。  
- 与运营/经营/增长仪表盘抢模块时：以本文 §0 主问为准裁剪。  
- 冲突时以 ARCHITECTURE + PRINCIPLES 为准。
