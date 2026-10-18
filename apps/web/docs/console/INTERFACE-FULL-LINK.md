# 接口服务全链路（管理面扩展面 + 数据面咽喉）

| 字段 | 值 |
| --- | --- |
| 地位 | **权威**（全链路拼图；服从控制面 Canon） |
| 范围 | 三平面职责 · 两条请求路径 · 本地 a3s-gateway · 阶段验收 |
| 上级 | [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [WORK-CONNECT.md](./WORK-CONNECT.md) |
| 对照 | [API-ENVELOPE.md](./API-ENVELOPE.md) · [ENTITLEMENT-COMPILE.md](./ENTITLEMENT-COMPILE.md) · [SERVICE-INVOKE.md](./SERVICE-INVOKE.md) · [SERVICE-DEV.md](./SERVICE-DEV.md) · [apps/api/docs/BOUNDARIES.md](../../../api/docs/BOUNDARIES.md) |
| 状态 | Decision v1.3（2026-09-20）— a3s-gateway + Runtime `/v1/services/{kind}/invoke/{sku}` |

冲突时：**CONTROL-PLANE-BOUNDARY > 本文 > 客户端实现偏好**。

---

## 0. 第一性原理

1. **一个可变不变量一个所有者** — Grant / EntitlementCompile / Usage ledger 在 **a3s-cloud**；Gateway 只强制已编译快照。
2. **管理面 ≠ 数据面** — Console CRUD → Cloud（主）/ a3s-api（扩展）；Work 调用 → **a3s-gateway**，禁止经 a3s-api 冒充咽喉。
3. **一把 Capability Key** — 客户端只持 `baseURL` + `a3s_sk_…`；上游 Provider Key 只在 Function/Adapter 服务侧。
4. **昂贵调用可观测可计量** — 每请求 `request_id`、访问日志、Usage 事实；失败用稳定 `code`（WORK-CONNECT §4）。

**硬禁令：** 不在 a3s-api 增加 `/v1/chat` / `/v1/tools`；不在本仓再实现第二套 Gateway 进程；浏览器不得作为开通集合或 Usage 权威。

---

## 1. 三平面（谁说话 / 谁不说话）

| 平面 | 谁说话 | 谁不说话 |
| --- | --- | --- |
| **管理面** | a3s-cloud（OS 期望态）· a3s-api（通讯录/Member/安装配置/过渡供给） | Gateway 不提供 Org/Deploy CRUD |
| **数据面** | **a3s-gateway**（compose `:8080`，源码 `apps/gateway`） | Console / a3s-api 不冒充 Work 咽喉 |
| **运行面** | Workloads · Fleet · Box | 产品域不直连容器/GPU API |

```text
┌─ Management ─────────────────────────────────────────────┐
│  Console · CLI · Management MCP                            │
│       ├─► A3S Cloud     ← OS 期望态权威                  │
│       └─► a3s-api       ← 仅扩展域（BOUNDARIES）         │
└────────────────────────────────────────────────────────────┘
                              │ EntitlementCompile / Edge 快照
                              ▼
┌─ Data ───────────────────────────────────────────────────┐
│  Work / IDE / Agent                                        │
│       │  Bearer a3s_sk_… + Gateway baseURL               │
│       ▼                                                    │
│  a3s-gateway (:8080 docker)                              │
│       ├─ /api|/app|/v2 → host a3s-api :3000（扩展面）   │
│       └─ /v1/* → host a3s-runtime :8787                 │
│              → Provider（Monitor / Boyue / AIsa …）        │
│              → L1 usage（本地 JSONL；Cloud ledger 后置）   │
│              → L1 events → NATS JetStream（events.runtime.*）│
└────────────────────────────────────────────────────────────┘

全局消息平面（Cloud NATS `:42220` / monitor `:8220`）：

```text
Outbox → Relay → events.cloud.*     （控制面事实）
Runtime → events.runtime.*          （数据面 L1 观测）
Cloud Queue API → queues.>          （产品消息队列）
```

详见 [EVENT-BUS-AND-QUEUE.md](./EVENT-BUS-AND-QUEUE.md)。Console `/events` 仍是进程日志，不是总线。
```

---

## 2. 两条请求路径

### 2.1 管理 / 扩展面

```text
Browser  ──/api──►  rsbuild proxy  ──►  a3s-gateway :8080/api
                                      └──► host a3s-api :3000
```

| 探针 | 语义 |
| --- | --- |
| `GET /api/health` | **Readiness**：依赖指标聚合；任一下游 Down → 503 |
| `GET http://127.0.0.1:8080/api/health` | 经 a3s-gateway 的同语义探针 |

### 2.2 数据面：Work → a3s-gateway → Runtime → Provider

```text
Client  ──/v1/services/{kind}/invoke/{sku}──►  a3s-gateway
  → @a3s/runtime
  → Provider
  → L1 usage showback（GET /v1/usage）
  → kense.gateway.usage-batch.v1 导出（GET /v1/usage/batch；Cloud ledger ingest 后置）
```

本地脊梁：`just up`（Gateway compose + a3s-api + Runtime；Cloud 尽力启动）。Cloud Edge 快照 / Cloud ledger 仍为生产权威；本地 Runtime 是 R6b 可测脊梁，不是第二控制面。

Connect 片段（本地入口）：

```text
baseURL: http://127.0.0.1:8080/v1
api_key: a3s_sk_devlocalgateway00000000000001
```

Compose 反代见 [apps/api/gateway/README.md](../../../api/gateway/README.md)；Runtime 见 [apps/runtime/README.md](../../../runtime/README.md)。

---

## 3. 契约索引

| 契约 | 文档 |
| --- | --- |
| 控制面所有权 | CONTROL-PLANE-BOUNDARY |
| Work 接入 | WORK-CONNECT |
| **商品调用** | [SERVICE-INVOKE](./SERVICE-INVOKE.md) |
| **商品开发** | [SERVICE-DEV](./SERVICE-DEV.md) |
| 统一信封 | API-ENVELOPE · apps/api/docs/API.md |
| 开通编译 | ENTITLEMENT-COMPILE |
| a3s-api 准入 | apps/api/docs/BOUNDARIES.md |

---

## 4. 本地运维

```bash
just up         # Gateway :8080 + a3s-api :3000 + Runtime :8787（+ Cloud :18080 尽力）
just web        # Console :3100（前台 HMR；不进 just up）
just runtime-e2e
```

| # | R6b EXIT | 本地状态 |
| --- | --- | --- |
| 1 | baseURL + 一把 Key | a3s-gateway 入口就绪 |
| 2 | 至少一条 model 路径端到端 | `POST /v1/services/model/invoke/boyue.openai.chat`（经 Gateway；缺凭证须 fail-closed） |
| 3 | Usage 归因 | Function showback + `kense.gateway.usage-lifecycle.v1` / `usage-batch.v1` 导出（Cloud ledger ingest 后置） |
| 4 | 401/403/429 可理解 | Function 返回 `auth.*` / `entitlement.denied` / `quota.exceeded` |
| 5 | 流量不经 a3s-api 冒充 Work | 遵守；`/v1` → Function，`/api` 仅扩展面 |