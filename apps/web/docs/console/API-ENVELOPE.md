# API 统一响应信封（开发规范）

| 字段 | 值 |
| --- | --- |
| 地位 | **权威 · 持久规范**（前后端必须遵守） |
| 范围 | a3s-api `/api` · `/app` · Work Gateway 数据面 JSON · OpenAPI / 文档站 |
| 实现 | `apps/api/src/shared/api.rs` · `http_pipeline.rs` · `apps/web/src/lib/apiEnvelope.ts` · `apps/official/src/lib/apiEnvelope.ts` |
| 文档对偶 | [API.md](../../../api/docs/API.md) · [WORK-CONNECT.md](./WORK-CONNECT.md) |
| 状态 | Normative v1（2026-09-18） |

冲突时：**本文 + API.md > 临时实现偏好 / SDK 便利性**。  
禁止以「对标 SiliconFlow 原生 body」为由再次拆掉统一信封；OpenAI 兼容载荷放在 `data` 内。

---

## 1. 不变量

1. **所有业务 JSON**（前台 Member `/app`、后台 Console `/api`、Work Gateway 数据面）成功与失败均使用同一信封。  
2. **业务体只在 `data`**；失败时 `data` 恒为 `null`。  
3. **客户端必须**经 `unwrapApiEnvelope`（或等价）解包后再消费业务字段。  
4. **OpenAPI / `/docs`** 的响应 schema 与示例必须展示完整信封，不得只写内层 DTO。  
5. **例外（不包装）**：`/api/health` · OpenAPI JSON 本体 · OCI `/v2` · Git smart/dumb HTTP。

---

## 2. 形状

成功：

```json
{
  "success": true,
  "code": 0,
  "message": "OK",
  "data": {},
  "request_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "timestamp": "2026-09-18T06:42:00.123Z"
}
```

失败：

```json
{
  "success": false,
  "code": 40100,
  "message": "invalid session",
  "data": null,
  "errors": [{ "field": "email", "message": "valid email is required" }],
  "request_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "timestamp": "2026-09-18T06:42:00.123Z"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `success` | boolean | `code == 0` |
| `code` | number | `0` 成功；否则稳定业务码 |
| `message` | string | 人类可读摘要 |
| `data` | any \| null | 成功载荷；失败 `null` |
| `errors` | array? | 字段级校验 |
| `request_id` | uuid | 与响应头 `x-request-id` 对齐 |
| `timestamp` | string (RFC3339) | 服务端 UTC |

业务码表见 [API.md](../../../api/docs/API.md)。

---

## 3. 落地检查清单（PR / 新接口）

- [ ] Controller 返回业务 DTO，由全局 `ApiEnvelopeInterceptor` 包装（勿手写第二套信封）  
- [ ] 异常走 `ApiExceptionFilter`  
- [ ] Web / Official 客户端使用 `unwrapApiEnvelope`  
- [ ] Work OpenAPI（`workOpenApi.ts`）200/4xx schema 为信封，`data` 指向业务 `$ref`  
- [ ] 文档站「统一响应信封」说明与示例未删  

---

## 4. 变更治理

若需调整信封字段：先改 `API.md` + 本文 + `shared::ApiEnvelope` + 两端 `apiEnvelope.ts` + OpenAPI，再合入业务。  
**禁止**仅改某一平面或仅改文档站示例。
