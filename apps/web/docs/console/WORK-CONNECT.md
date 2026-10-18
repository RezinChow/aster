# Kense Work Connect — 统一网关接入契约

| 字段 | 值 |
| --- | --- |
| 地位 | **权威**（Work / IDE / Agent 数据面接入） |
| 范围 | Gateway baseURL · Capability Key · 协议子集 · 错误码 · 禁入边界 |
| 上级 | [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) §2.3 · [USE-GATEWAY-MARKET-BILLING.md](./USE-GATEWAY-MARKET-BILLING.md) · [API-ENVELOPE.md](./API-ENVELOPE.md) |
| 交付波次 | P0 本文；P1 Console Connect UX；R6b 真调用（见 [ROADMAP.md](./ROADMAP.md)） |
| 状态 | Decision v1.3（2026-09-20）— SiliconFlow 对照 · 统一 ApiEnvelope · `/v1/models` 开通集合 · 商品调用见 [SERVICE-INVOKE.md](./SERVICE-INVOKE.md) |

冲突时：**CONTROL-PLANE-BOUNDARY > 本文 > 客户端实现偏好**。

---

## 1. 产品不变量

1. **接入物只有两样：** `baseURL`（Kense Gateway）+ **一把** Capability Key。  
2. **数据面咽喉是 Kense Gateway**（Edge 快照驱动）；期望态权威在 **a3s-cloud**。  
3. **a3s-api 不是 Work 网关** — 禁止把 `/api/*`（扩展面）当作推理/工具/方案 API 入口。  
4. **Work 是一等参考客户端，不是唯一消费者** — Claude Code / Cursor / 自研 Agent 同契约。  
5. **可调用集合** = `Entitlement ∩ Grants ∩ InferenceAccess`（Cloud 编译，Gateway 强制）。  
6. **客户端不持有上游 Provider Key**；不内嵌路由/授权判定。  
7. **数据面 JSON 响应 = 统一 `ApiEnvelope`**（`success` / `code` / `message` / `data` / `request_id` / `timestamp`），与 Console `/api`、Member `/app` 相同；业务体在 `data`。OpenAI 兼容 SDK 需读取 `data`（或由 Work 客户端解包）。

```text
Kense Work / IDE / Agent
  baseURL + Capability Key
        │
        ▼
  Kense Gateway  ──► model | tool | api | feed | MCP
        │
        └── Usage ledger（prompt-free 请求事实）
```

### 1.1 对照 SiliconFlow（学体验、不加单租户假设）

产品体验对标 [SiliconFlow 平台介绍](https://api-docs.siliconflow.cn/docs/userguide/introduction) 与 OpenAI 兼容 Chat API；机制上 Kense 是**企业多租户 OS**，不是单账号云厂商。

| SiliconFlow | Kense Work Connect |
| --- | --- |
| 单一 `base_url` + Bearer API Key | Gateway `baseURL` + Capability Key（`a3s_sk_…`） |
| `/v1/chat/completions`，响应为**原生** OpenAI JSON | `POST /v1/services/model/invoke/{sku}`；响应为 **ApiEnvelope** |
| `model` = 目录模型名 | `{sku}`=不透明 listing id（开通集合内） |
| 现成 API · 专属 · 私有部署 | Market Listing：`saas-provider` · `dedicated` · `self-hosted/power` · `aisa-proxy` |
| 按量 + TPM + Trace | L1 Usage + Gateway Env 硬顶 + `x-request-id` / `traceparent` |
| 「我的账号」全局开通 | **Org → Project → Env**；Key 绑定 Env；开通与配额挂 Env |

---

## 2. Connect 配置

### 2.1 字段

| 字段 | 含义 | 示例 |
| --- | --- | --- |
| `baseURL` | Gateway 公网根（无末尾斜杠或带 `/v1` 以 Gateway 修订为准） | `https://gw.example.com/v1` |
| `api_key` | Identity **inference credential** ≡ Capability Key | `a3s_sk_…` |

### 2.2 HTTP 鉴权

| Header | 值 |
| --- | --- |
| `Authorization` | `Bearer {api_key}` |
| 或 `X-Api-Key` | `{api_key}`（Gateway 修订若声明则同等接受） |

禁止：Query 传 Key；把 Key 写入前端公开仓库；一客户多上游 Key。

### 2.3 Connect 片段（Work / Claude Code / Cursor 同形）

```text
# Kense OS · Work Connect
baseURL: https://gw.example.com/v1
api_key: a3s_sk_••••••••
```

OpenAI-compatible SDK 示例：

```bash
export OPENAI_BASE_URL="https://gw.example.com/v1"
export OPENAI_API_KEY="a3s_sk_…"
```

```ts
import OpenAI from 'openai';
const client = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY,
});
```

---

## 3. 协议子集（数据面）

Gateway **执行**冻结计划；下列为 Work 优先支持的协议面。未在 Edge 快照中就绪的路径 **fail-closed**。

| Kind | 路径（示意） | 响应形状 | 说明 |
| --- | --- | --- | --- |
| 全部 Listing | `POST /v1/services/{kind}/invoke/{sku}` | 信封 `data` 内为业务体 | `{sku}`=不透明 listing id；细分/上游由 Runtime 转发 |
| 开通模型列表 | `GET /v1/models` | 信封内 list 形 | 仅发现，不调用 |
| MCP HTTP | Gateway MCP 端点（typed readiness 后） | MCP 协议 | 缺省 fail-closed |

### 3.1 `GET /v1/models`（开通集合，非全站目录）

- 返回 **该 Capability Key 可调用** 的模型投影 ID 列表：`Entitlement ∩ Grants ∩ InferenceAccess`。  
- **禁止**返回未开通、跨 Env、或全站 Marketplace 目录。  
- 形状对齐 OpenAI `list models`（信封 `data` 内：`object: list` · `data[].id`）；`id` = 投影 ID（如 `boyue.openai.chat`）。

### 3.2 成功 / 失败体（硬裁定）

| 路径类 | 成功 | 失败 |
| --- | --- | --- |
| Work Gateway（services invoke / models） | **统一 `ApiEnvelope`**；业务体在 `data`（如 `chat.completion` / `list` / adapter result） | 同信封：`success=false` · `data=null` · 稳定 `code`（§4） |
| Console `/api` · Member `/app` | 同左 `ApiEnvelope`（见 [API.md](../../../api/docs/API.md)） | 同左 |

### 3.3 Work `input` 字段命名（硬裁定）

> **完整调用规范（路径 · kind · 命名 · curl · 禁令）以 [SERVICE-INVOKE.md](./SERVICE-INVOKE.md) 为准；上架 / adapter 以 [SERVICE-DEV.md](./SERVICE-DEV.md) 为准。** 本节保留摘要。

Listing `kind=api|tool|feed` 的请求体：

```json
{ "input": { /* snake_case only */ } }
```

1. **字段名一律 `snake_case`**（与 ApiEnvelope / Usage 字段一致：`request_id`、`country_code`、`page_size`…）。  
2. **禁止**把上游 camelCase / 供应商专用名直接暴露给 Work（如 `countryCode`、`userName`、`tag_slug` 仅作上游映射目标）。  
3. Runtime adapter **在转发时**完成 Kense → 上游字段映射；校验失败返回 `400 request.invalid`。  
4. `kind=model` 的 body 使用该模型协议字段（如 `messages`）；listing sku 在路径中。  
   - **Boyue OpenAI 兼容对话：** 单一 listing `boyue.openai.chat` + body.`model` 选 LLM；**不要**为每个上游模型再建 listing。其它 Boyue API 用其它 `{family}`（见 [SERVICE-DEV.md](./SERVICE-DEV.md) §1.2）。

**不在本契约内（管理面）：** Org / Project / Deploy / Grant CRUD — 走 A3S Cloud REST/CLI/Management MCP，**不**经 Capability Key 数据面。

可选请求头：`x-request-id`（客户端传入则回显）；`traceparent`（W3C Trace Context，若 Gateway 修订支持）。

---

## 4. 错误码（Work 可理解）

稳定语义；具体 JSON 形状服从 Gateway 修订。客户端应按 `code` / HTTP 分支，而非解析英文文案。

| 语义 | 典型 HTTP | 建议 `code` | Work 行为 |
| --- | --- | --- | --- |
| Key 缺失/无效 | 401 | `auth.invalid_key` | 提示重新签发；停止重试风暴 |
| Key 已吊销 | 401 | `auth.revoked` | 同上 |
| 未开通 Listing / 无 Grant | 403 | `entitlement.denied` | 引导管理员开通；不换上游 Key |
| Env spend / RPM 触顶 | 429 | `quota.exceeded` | 退避；**取消 in-flight** Flow/Run（若有） |
| 路由/快照未就绪 | 503 | `route.not_ready` | 可重试有限次；展示「网关未就绪」 |
| 上游 Provider 故障（已编译回退耗尽） | 502 / 503 | `upstream.exhausted` | 可理解失败；不暴露上游凭证 |
| 协议/参数错误 | 400 | `request.invalid` | 修请求 |

触顶与未开通 **不得** 伪装成模型幻觉或空 200。

---

## 5. 禁入边界（强制）

| 禁止 | 原因 |
| --- | --- |
| Work 默认 `baseURL` = a3s-api（`/api`） | 扩展面；无数据面执行权威 |
| 在 a3s-api 增加 `/v1/chat` 冒充统一网关 | 第二控制面 / 第二咽喉 |
| Gateway 提供 Org/Deploy CRUD | 管理面≠数据面 |
| Work 排他占用 Gateway | 其它客户端同契约 |
| 客户端保存多把上游 Provider Key | 破坏「一把 Key」 |

---

## 6. 与开通 / 编译的关系

```text
Console 开通 Listing（Entitlement）
  → Cloud EntitlementCompile（见 ENTITLEMENT-COMPILE.md）
  → Edge 完整快照
  → Gateway 强制 Key∩集合
  → Usage ledger
```

Work **不**调用「开通」API 作为运行时热路径；开通是管理面动作。

---

## 7. R6b 验收（真调用闸门）

对齐 [ROADMAP.md](./ROADMAP.md) **R6b**：

| # | 验收项 |
| --- | --- |
| 1 | Work（或同等客户端）仅配置 baseURL + 一把 Capability Key |
| 2 | 至少一条 `model` 路径端到端成功（本地：`boyue.openai.chat` 经 Gateway→Runtime；生产：Edge 快照路由） |
| 3 | 用量写入 Usage ledger（本地：showback + `GET /v1/usage/batch` 导出 `kense.gateway.usage-batch.v1`；生产：Cloud ledger） |
| 4 | 无效 Key / 未开通 / 触顶 返回 §4 可理解错误 |
| 5 | 流量 **不**经过 a3s-api |

本地脊梁：`just up` + `just runtime-e2e`（见 `apps/runtime`）。未满足前：Console 必须标注 **预览 / 未接线**，禁止假绿 Serving。权威拓扑入口：Console `/topology`。Gateway 本地 ACL（含 `a3s-runtime` upstream）变更后须 **recreate** Gateway 容器（`docker compose … up -d --force-recreate` 对应 gateway 服务），仅 restart 不够。

---

## 8. 最小 curl 矩阵（mock / 真调用共用）

完整矩阵与 camelCase 负例见 [SERVICE-INVOKE.md](./SERVICE-INVOKE.md) §6。

```bash
# Invoke model（Boyue：sku=boyue.openai.chat；body.model 选 LLM）
curl -sS "$GATEWAY_BASE/services/model/invoke/boyue.openai.chat" \
  -H "Authorization: Bearer $CAPABILITY_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"ping"}]}'

# Models（仅已开通）
curl -sS "$GATEWAY_BASE/models" \
  -H "Authorization: Bearer $CAPABILITY_KEY"

# Invoke api（input 必须 snake_case）
curl -sS "$GATEWAY_BASE/services/api/invoke/kense.monitor.chokepoint" \
  -H "Authorization: Bearer $CAPABILITY_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input":{}}'

# 期望：401 auth.* · 403 entitlement.denied · 429 quota.exceeded · 200 + usage 归因
```

---

## 9. 文档与实现指针

| 产物 | 路径 |
| --- | --- |
| **商品调用规范** | [SERVICE-INVOKE.md](./SERVICE-INVOKE.md) |
| **商品开发规范** | [SERVICE-DEV.md](./SERVICE-DEV.md) |
| Console 复制 Connect | Inference · 密钥（预览至 R6） |
| 开通集合 | Marketplace · 已开通 + EntitlementCompile 状态 |
| Gateway 运营 | `/gateway` · Work Connect 面板 |
| Console `/docs?source=work` | Work 数据面 OpenAPI（统一 ApiEnvelope） |
| Cloud 边界 | a3s `apps/cloud/docs/a3s-os-boundary.md` |
