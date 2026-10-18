# 商品服务调用规范（Service Invoke）

| 字段 | 值 |
| --- | --- |
| 地位 | **权威**（Work / IDE / Agent 商品调用数据面） |
| 范围 | 唯一调用路径 · kind/sku · 请求体 · 命名 · 响应信封 · 错误码 · 禁令 |
| 上级 | [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md) · [WORK-CONNECT.md](./WORK-CONNECT.md) · [API-ENVELOPE.md](./API-ENVELOPE.md) |
| 对偶 | [SERVICE-DEV.md](./SERVICE-DEV.md)（上架 / adapter 开发） |
| 实现 | `apps/runtime`（Rust `a3s-runtime`）· `apps/gateway` |
| 状态 | Decision v1.0（2026-09-20）— 不透明 sku · snake_case input · Runtime 转发映射 |

冲突时：**CONTROL-PLANE-BOUNDARY > WORK-CONNECT > 本文 > 客户端实现偏好**。

---

## 0. 第一性原理

1. **调用方只看见商品** — 路径里是 listing `kind` + 不透明 `sku`；上游 RPC / 细分接口名 **不**进入公网 URL。  
2. **一把 Capability Key** — 客户端只持 Gateway `baseURL` + `a3s_sk_…`；上游 Provider Key 仅在 Runtime / 供应商 vault。  
3. **Kense 面命名统一** — `input` 字段一律 `snake_case`（与 ApiEnvelope / Usage 一致）；上游字段名只在转发映射中出现。  
4. **响应永远是 ApiEnvelope** — 业务体在 `data`；失败 `data=null` + 稳定 `error_code` / `code`。  
5. **开通集合强制** — 可调用集合 = `Entitlement ∩ Grants ∩ InferenceAccess`；未开通 **403**，不得假绿。

```text
Client
  Authorization: Bearer a3s_sk_…
  POST /v1/services/{kind}/invoke/{sku}
        │
        ▼
  a3s-gateway :8080
        │
        ▼
  @a3s/runtime :8787
        │  snake_case → upstream map
        ▼
  Provider（Monitor / AIsa / Boyue / FaaS …）
        │
        ▼
  Usage ledger（L1 showback → Cloud ingest）
```

---

## 1. 唯一调用路径

```http
POST /v1/services/{kind}/invoke/{sku}
```

| 段 | 类型 | 含义 |
| --- | --- | --- |
| `kind` | `model` \| `tool` \| `api` \| `feed` | Listing 商品形态（与开通投影一致） |
| `sku` | 不透明 string | 开通集合内的 listing / 路由投影 ID |

### 1.1 kind 语义（硬裁定）

| kind | 何时使用 | 典型 sku | Body |
| --- | --- | --- | --- |
| `model` | 对话 / 补全类推理商品 | `boyue.openai.chat` | 模型协议字段（如 `messages`）；Boyue OpenAI 面另需 body.`model` 选 LLM；**无**外层 `input` |
| `api` | 纯上游 API 转发商品（Monitor · Data…） | `kense.monitor.*` · `kense.data.*` | `{ "input": { … } }` |
| `tool` | **真** tool / FaaS 执行商品 | （暂无开通样例） | `{ "input": { … } }` |
| `feed` | 订阅 / 推送类 listing（预留） | — | `{ "input": { … } }` |

**禁止：**

- 把纯 API 商品挂到 `kind=tool` 或历史 `/v1/tools`。  
- 在 URL 拼接细分后缀：`…/invoke/{sku}/{endpoint}`、`…/invoke/{sku}.{op}`。  
- 客户端直连上游 Provider URL 或携带上游 Key。

### 1.2 发现（非调用）

```http
GET /v1/models
```

仅返回该 Key **已开通** 的 model 投影 ID；不是全站 Marketplace 目录。

---

## 2. 鉴权与请求头

| Header | 值 |
| --- | --- |
| `Authorization` | `Bearer {Capability Key}` |
| `Content-Type` | `application/json` |
| `x-request-id`（可选） | 客户端传入则回显 |
| `traceparent`（可选） | W3C Trace Context（Gateway 修订支持时） |

禁止：Query 传 Key；浏览器公开仓库内嵌生产 Key。

---

## 3. 请求体

### 3.1 `kind=model`

```json
{
  "messages": [{ "role": "user", "content": "ping" }]
}
```

SKU 只在路径中；不要再在 body 重复 `model` 字段作为路由权威（若 body 含 `model`，不得覆盖路径 sku）。

### 3.2 `kind=api|tool|feed`

```json
{
  "input": {
    "country_code": "US",
    "page_size": 25
  }
}
```

| 规则 | 说明 |
| --- | --- |
| 外层必须有 `input` 对象 | 缺省 → `400 request.invalid` |
| **字段名一律 `snake_case`** | 含 `country_code`、`page_size`、`start_date`、`end_date`… |
| **禁止 camelCase / PascalCase** | 如 `countryCode`、`userName` → `400 request.invalid` |
| 上游专用名不得出现在 Work 面 | 如 `tag_slug`、`userName`、`max_num_results` 仅作 Runtime 映射目标 |
| 细分能力靠 **不同 sku** 或 **input 字段** | 不靠 URL 后缀 |

Runtime adapter **在转发时**完成 Kense → 上游映射（见 [SERVICE-DEV.md](./SERVICE-DEV.md) §3）。

---

## 4. 响应

服从 [API-ENVELOPE.md](./API-ENVELOPE.md)。

**成功（示意）：**

```json
{
  "success": true,
  "code": 0,
  "message": "OK",
  "data": {
    "sku": "kense.monitor.resilience-score",
    "mode": "sandbox",
    "upstream": "/v1/services/api/invoke/kense.monitor.resilience-score",
    "result": { },
    "usage_id": "usage_…",
    "billable_units": 1
  },
  "request_id": "…",
  "timestamp": "…"
}
```

**失败（示意）：**

```json
{
  "success": false,
  "code": 40000,
  "message": "Work input fields must be snake_case; got \"countryCode\"",
  "data": null,
  "request_id": "…",
  "timestamp": "…",
  "error_code": "request.invalid"
}
```

客户端应按 `error_code` / HTTP 状态分支，不解析英文文案。

---

## 5. 错误码（与 WORK-CONNECT §4 对齐）

| 语义 | HTTP | `error_code` | 调用方行为 |
| --- | --- | --- | --- |
| Key 缺失/无效 | 401 | `auth.invalid_key` | 停重试；重新签发 |
| Key 已吊销 | 401 | `auth.revoked` | 同上 |
| 未开通 / kind 不匹配 | 403 | `entitlement.denied` | 引导开通；不换上游 Key |
| Env 配额触顶 | 429 | `quota.exceeded` | 退避；取消 in-flight |
| 路由/快照未就绪 | 503 | `route.not_ready` | 有限重试 |
| 上游耗尽 / 凭证缺失 | 502 / 503 | `upstream.exhausted` · `provider.credential_missing` | 可理解失败；不暴露上游密钥 |
| 协议/参数错误（含 camelCase） | 400 | `request.invalid` | 修请求 |

---

## 6. 最小 curl 矩阵

```bash
export GATEWAY_BASE="http://127.0.0.1:8080/v1"
export CAPABILITY_KEY="a3s_sk_devlocalgateway00000000000001"

# model
# model（Boyue OpenAI 面：单一 listing + body.model）
curl -sS "$GATEWAY_BASE/services/model/invoke/boyue.openai.chat" \
  -H "Authorization: Bearer $CAPABILITY_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"ping"}]}'

# api — snake_case input
curl -sS "$GATEWAY_BASE/services/api/invoke/kense.monitor.resilience-score" \
  -H "Authorization: Bearer $CAPABILITY_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input":{"country_code":"US"}}'

# api — camelCase 必须失败
curl -sS "$GATEWAY_BASE/services/api/invoke/kense.monitor.resilience-score" \
  -H "Authorization: Bearer $CAPABILITY_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input":{"countryCode":"US"}}'
# → error_code=request.invalid

# discovery
curl -sS "$GATEWAY_BASE/models" \
  -H "Authorization: Bearer $CAPABILITY_KEY"
```

本地脊梁：`just up` + `just runtime-e2e`。

---

## 7. 禁令清单（调用方 + 产品面）

| 禁止 | 原因 |
| --- | --- |
| URL 暴露上游 path / OpenAPI operationId | 破坏不透明 sku；泄漏供应商形状 |
| Work `input` 使用上游 camelCase | 破坏 Kense 统一命名；锁定供应商 |
| 纯 API 走 `/v1/tools` 或 `kind=tool` | kind 语义污染；计费/开通投影错位 |
| 经 a3s-api `/api` 冒充商品调用 | 管理/扩展面 ≠ 数据面 |
| 客户端持多把上游 Key | 破坏「一把 Key」 |
| 未开通仍返回 200 空结果 | 假绿；触顶/未开通必须显式错误 |

---

## 8. 文档与实现指针

| 产物 | 路径 |
| --- | --- |
| 开发 / 上架规范 | [SERVICE-DEV.md](./SERVICE-DEV.md) |
| Connect（baseURL + Key） | [WORK-CONNECT.md](./WORK-CONNECT.md) |
| 信封 | [API-ENVELOPE.md](./API-ENVELOPE.md) |
| 全链路拓扑 | [INTERFACE-FULL-LINK.md](./INTERFACE-FULL-LINK.md) |
| Runtime 实现 | `apps/runtime/src/routes.rs` · `input_contract.rs` · `providers/*` |
| Console TryIt / OpenAPI merch | `apps/web/src/data/*Upstream.ts` · `workOpenApi.ts` |
| Work 开发者文档页 | Console `/docs?source=work` |
