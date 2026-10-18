# 全局事件总线与消息队列（NATS JetStream）

| 字段 | 值 |
| --- | --- |
| 地位 | **权威**（消息平面；服从控制面 Canon） |
| 范围 | 全局事件总线 · 消息队列服务 · subject / stream 规范 · Console 观测 |
| 上级 | [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md) · [INTERFACE-FULL-LINK.md](./INTERFACE-FULL-LINK.md) |
| 状态 | Decision v1（2026-09-20） |

冲突时：**CONTROL-PLANE-BOUNDARY > 本文 > 客户端实现偏好**。

---

## 0. 第一性原理

1. **一个可变不变量一个所有者** — 平台事件轨与产品队列权威在 **a3s-cloud**；不得在 a3s-api 再建第二套 Outbox / Audit / 全局总线。
2. **广播 ≠ 任务所有权** — 事件总线是多订阅事实广播；消息队列是竞争消费者 + 显式 ack。
3. **日志页 ≠ 事件总线** — Console `/events` 仍是进程日志（ClickHouse）；总线与队列用 `/bus`、`/queues`。
4. **本地 broker** — 全局总线统一 **Cloud NATS JetStream**（client `:42220`，monitor `:8220`）。API compose `:4222` 仅 config fan-out，不是全局总线。

---

## 1. 两产品

| 产品 | Stream | Subject | 语义 |
| --- | --- | --- | --- |
| **事件总线** | `A3S_CLOUD_EVENTS` | `events.cloud.{domain}.{entity}.{action}` · Runtime L1：`events.runtime.{…}` | Pub/sub、可回放 |
| **消息队列** | `A3S_CLOUD_QUEUES` | `queues.{org}.{project}.{name}` | WorkQueue、ack/nak |

Cloud 域事件仍走 **Postgres Outbox → OutboxRelay → A3S Event → JetStream**；不另开第二条 Cloud publish 路径。

---

## 2. 与现有能力的边界

| 能力 | 路径 / 所有者 | 不是 |
| --- | --- | --- |
| 进程日志 | `/events` · a3s-api ClickHouse | 事件总线 |
| L1 Usage | Runtime JSONL · Gateway `/v1/usage` | 总线权威（总线仅观测副本） |
| Cloud ledger | Inference / Usage rollup | JetStream 原始字节 |
| 通知投递 | Outbox + durable consumer + C6 AckWait | 产品消息队列 |
| API config bus | `kense.config.changed` on `:4222` | 全局 OS 总线 |

---

## 3. 本地端口

| 服务 | 端口 |
| --- | --- |
| Cloud NATS client | `42220` → `4222` |
| Cloud NATS monitor | `8220` → `8222`（`/healthz`） |
| API NATS（非全局） | `4222` |

```bash
just cloud   # Postgres :54320 · NATS :42220 · registry :50020
just up      # 含 Cloud 尽力启动 + Gateway + api + runtime
```

---

## 4. Console / Runtime

| 面 | 行为 |
| --- | --- |
| `/topology` | 节点 `bus`、`queue`；边 `cloud→bus`、`cloud→queue`、`runtime→bus`、`runtime→queue` |
| `/bus` | 健康 · stream · subject · 最近事件（Cloud 空时投影 Runtime L1 ring） |
| `/queues` | 队列 CRUD · 入队/出队/ack（dev） |
| `@a3s/runtime` | invoke / usage / lifecycle **尽力** publish `events.runtime.*`；queue workers 消费 `runtime-vault-apply` / `usage-ingest`；durable 投影 `events.runtime.>` |
| Console usage | **优先** `GET Runtime /v1/events/recent` 投影；Gateway `/v1/usage` 仅 fallback |
| Console vault sync | **优先** materialize（loopback 明文）→ `vault.apply` **只传 secret_ref**；禁止明文入队；scope 透传 Cloud org/project/env |
| Runtime vault | 作用域 active（内存）+ receipt（磁盘无明文）；见 [RUNTIME-VAULT.md](./RUNTIME-VAULT.md) |

---

## 5. 解耦不变量（验收）

1. Runtime L1 事实的权威写入路径是本地 JSONL + **总线广播**；Console 不得把 Gateway HTTP 当作唯一用量源。
2. 跨服务密钥应用：队列只传 `secret_ref`；明文不得出现在 `vault.apply` job。
3. Cloud `/event-bus/*` 只观测；不得在 a3s-api 建第二全局 Outbox。
4. 投影消费者（Runtime bus.projection / Console usageLedger）只镜像信封，不发明第二账本。
5. Vault apply 必须可查询 receipt（applied / cleared / failed）。

---

## 6. 非目标

- 把 ClickHouse 日志迁到 NATS
- 租户浏览 JetStream 凭证 / 任意原始字节
- 用产品队列替代通知 C6 重投递模型
- a3s-api 持有全局事件权威
