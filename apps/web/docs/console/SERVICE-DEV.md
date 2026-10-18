# 商品服务开发规范（Service Dev）

| 字段 | 值 |
| --- | --- |
| 地位 | **权威**（上架商品 · Runtime adapter · Console 商品化） |
| 范围 | 选型 kind · sku · adapter · 字段映射 · 商品化 · 测试 · 验收清单 |
| 上级 | [SERVICE-INVOKE.md](./SERVICE-INVOKE.md) · [WORK-CONNECT.md](./WORK-CONNECT.md) · [ENTITLEMENT-COMPILE.md](./ENTITLEMENT-COMPILE.md) |
| 实现 | `apps/runtime` · `apps/web/src/data/*Upstream.ts` |
| 状态 | Decision v1.0（2026-09-20） |

冲突时：**SERVICE-INVOKE > 本文 > 局部实现习惯**。

本文回答：**如何把一个上游能力做成可开通、可调用、可计量的 Kense 商品**。调用方契约见 [SERVICE-INVOKE.md](./SERVICE-INVOKE.md)。

---

## 0. 目标产物（一次上架必须齐）

| 层 | 必须交付 | 真相源 |
| --- | --- | --- |
| 路由契约 | `POST /v1/services/{kind}/invoke/{sku}` | `apps/runtime/src/routes.rs` |
| 开通投影 | sku 进入对应 entitlement 集合 | `apps/runtime/src/entitlement.rs`（本地）；生产 = Cloud 编译 |
| Adapter | 校验 snake_case → 映射上游 → 调用 → 回写 Usage | `apps/runtime/src/providers/*` |
| 商品化 | gatewayPath · sampleInput · OpenAPI 参数（snake_case）· 文案 | `apps/web/src/data/*Upstream.ts` |
| 文档 | 开发者可见路径与字段 | Console `/docs?source=work` · WORK-CONNECT / SERVICE-INVOKE |
| 测试 | 非法 camelCase 拒绝 · 映射正确 · e2e 绿 | `*.test.ts` · `just runtime-e2e` |

---

## 1. 选型：kind 与 sku

### 1.1 选 kind（硬规则）

| 上游形态 | kind | 说明 |
| --- | --- | --- |
| HTTP/RPC API，Runtime 只转发 | `api` | Monitor · AIsa Data 等 |
| 需部署/执行的函数或 tool runtime | `tool` | 仅真 FaaS / tool；**禁止**把纯 API 塞进来 |
| 对话 / 补全模型 | `model` | Boyue · echo 等 |
| 订阅流 / feed listing | `feed` | 预留；契约同 `api` 的 `input` |

### 1.2 命名 sku

```text
{namespace}.{domain}.{capability}
```

示例：

- `kense.monitor.resilience-score`
- `kense.data.cited-answer`
- `boyue.openai.chat`（OpenAI 兼容对话族；body.`model` 选 LLM）

规则：

1. **一个可独立开通、独立计价的能力 = 一个 sku**。同一供应商下多个可切换模型，优先 **一个 chat listing + `model` 参数**，不要为每个模型再建细分接口。  
2. sku 对调用方 **不透明**：不要把上游 path / operationId 拼进公网路径。  
3. 细分差异用 **不同 sku** 或 **input/body 字段**，不用路径后缀。  
4. **多协议供应商（如 Boyue）** 用三段式：`{supplier}.{family}.{capability}`。  
   - `family` 区分协议面：`openai`（兼容 `/v1/chat/completions` 等），以及未来其它 Boyue 自有 API 族。  
   - **禁止** `boyue.chat` 这类吞掉整供应商的短名——后续 embeddings / 图片 / 专用 API 会无处落位。  
   - 例：`boyue.openai.chat` ·（预留）`boyue.openai.embeddings` · `boyue.<other-family>.*`。

---

## 2. Runtime 开发步骤（清单）

在 `apps/runtime`：

1. **登记开通集合** — `entitlement.ts` 的 `ENTITLED_API_SKUS` / `ENTITLED_TOOL_SKUS` / `ENTITLED_MODEL_IDS`。  
2. **写 / 扩展 provider** — `src/providers/<vendor>.ts`。  
3. **挂到 `index.ts` 分发** — 按 kind + sku 调用对应 `invoke*`。  
4. **输入门禁** — 调用 `findIllegalWorkField`（`input_contract.rs`）；非法键立刻 `request.invalid`。  
5. **映射函数** — 显式 `mapWorkInputToUpstream*`；上游 camelCase **只**出现在映射输出。  
6. **凭证** — 读 env / vault；缺失 **fail-closed**（`provider.credential_missing` / `route.not_ready`），禁止编造成功结果。  
7. **计量** — 成功路径写 Usage（`billableUnits` · `unitPriceUsd`）。  
8. **单测** — camelCase 拒绝、必填字段、映射断言。  
9. **e2e** — `just runtime-e2e`（经 Gateway `:8080` 优先）。

参考实现：

| 类型 | 文件 |
| --- | --- |
| 输入契约 | `src/inputContract.ts` |
| API · Monitor | `src/providers/worldMonitor.ts` |
| API · AIsa | `src/providers/aisa.ts` |
| Model · Boyue | `src/providers/boyue.ts` |

---

## 3. 字段命名与映射（硬裁定）

### 3.1 Work 面（对外）

- 全部 `snake_case`。  
- 与信封 / Usage 对齐：`request_id`、`country_code`、`page_size`、`start_date`、`end_date`…  
- Console `sampleInput`、OpenAPI `name`、TryIt 默认体必须一致。

### 3.2 上游面（对内）

仅在 adapter 内出现。示例：

| Work `input` | 上游（示例） | 商品 |
| --- | --- | --- |
| `country_code` | `countryCode` | WM resilience-score |
| `country_code` | `country` | WM conflict-events |
| `country_code` | `country_code` | WM country-risk（上游已是 snake） |
| `handle` | `userName` | AIsa public-profile |
| `symbol` | `ticker` | AIsa security-price |
| `limit` | `max_num_results` | AIsa academic-search |
| `topic` | `tag_slug` | AIsa prediction-event |

### 3.3 禁止事项

- 为「兼容」同时接受 `country` / `countryCode` / `country_code`。  
- 把上游 query 名原样写进 Console OpenAPI。  
- 在文档里教调用方使用上游字段名。

---

## 4. Console 商品化步骤（清单）

在 `apps/web`：

1. **Upstream 表** — `src/data/<vendor>Upstream.ts`：  
   - `gatewayPath`: `/services/{kind}/invoke/{sku}`（**无** `/v1` 前缀或与现网 merch 一致）  
   - `sampleInput`: snake_case  
   - OpenAPI / pricing 字段 `name`: snake_case  
2. **若存在 `queryFromInput`**（文档/沙箱辅助）— 可读 Work input，输出上游 query；并 `assertSnakeCaseInput`。  
3. **Marketplace / Listing 页** — TryIt 走统一 `gatewayInvoke`，body 用 `sampleInput`。  
4. **Work OpenAPI 文案** — `workOpenApi.ts` 中 tool/api input 描述声明 snake_case。  
5. **i18n** — 参数说明中英文与字段名同步（不要残留 `countryCode` 文案）。

**沙箱夹具**（`*SandboxFixtures*`）若模拟**上游响应**，可保留上游形状；不得当作 Work 请求示例。

---

## 5. 凭证与安全

| 项 | 规则 |
| --- | --- |
| Provider Key | 仅 Runtime 进程 env / vault；永不下发客户端 |
| 缺 Key | fail-closed；返回稳定错误码 |
| 日志 | 不打印完整 Key / 上游 Authorization |
| 错误消息 | 可说「凭证未配置」；不回显上游响应中的密钥 |

---

## 6. 测试门禁（合并前）

| # | 门禁 | 命令 / 断言 |
| --- | --- | --- |
| 1 | 单元：非法 camelCase → `request.invalid` | `bun --filter @a3s/runtime test` |
| 2 | 单元：snake_case → 正确上游字段 | 同上（map 断言） |
| 3 | 单元：缺必填 → `request.invalid` | 同上 |
| 4 | e2e：Gateway → Runtime → Provider/sandbox | `just runtime-e2e` |
| 5 | 现场：camelCase 400 / snake_case 200 | curl 见 SERVICE-INVOKE §6 |
| 6 | Console merch 无 camelCase 参数名 | 搜 `countryCode` / `userName` 于 `*Upstream*` OpenAPI 字段 |

未通过：**禁止**在 Marketplace 标「已接线 / Serving」。

---

## 7. 新增商品最小模板

### 7.1 Runtime adapter 骨架

```ts
import { findIllegalWorkField, requireStr } from '../inputContract';

function gate(input: Record<string, unknown>) {
  const bad = findIllegalWorkField(input);
  if (bad) {
    return { ok: false as const, message: `Work input fields must be snake_case; got "${bad}"` };
  }
  return { ok: true as const };
}

function mapToUpstream(input: Record<string, unknown>) {
  const g = gate(input);
  if (!g.ok) return g;
  const id = requireStr(input, 'resource_id');
  if (!id.ok) return id;
  // Upstream-only names below:
  return { ok: true as const, query: { resourceId: id.value } };
}
```

### 7.2 Console sample

```ts
sampleInput: { resource_id: 'example' }
// openApiParams[].name === 'resource_id'
```

---

## 8. 评审检查表（PR）

- [ ] kind 正确（纯 API ≠ tool）  
- [ ] sku 不透明；无路径细分后缀  
- [ ] Work input 全 snake_case；无兼容别名  
- [ ] 映射单测覆盖「拒绝 camelCase + 正确上游名」  
- [ ] entitlement 已登记；未开通路径返回 403  
- [ ] 缺上游凭证 fail-closed  
- [ ] Usage 记账字段齐全  
- [ ] Console sampleInput / OpenAPI / TryIt 一致  
- [ ] `just runtime-e2e` 绿  
- [ ] 文档链接指向 SERVICE-INVOKE / 本文，无过时 `/v1/tools` 或 endpoint 拼接说明  

---

## 9. 相关文档

| 文档 | 用途 |
| --- | --- |
| [SERVICE-INVOKE.md](./SERVICE-INVOKE.md) | 调用方契约 |
| [WORK-CONNECT.md](./WORK-CONNECT.md) | baseURL + Key · 错误码总表 |
| [ENTITLEMENT-COMPILE.md](./ENTITLEMENT-COMPILE.md) | 开通 → Edge 快照 |
| [INTERFACE-FULL-LINK.md](./INTERFACE-FULL-LINK.md) | 三平面拓扑 |
| [API-ENVELOPE.md](./API-ENVELOPE.md) | 统一信封 |
| `apps/runtime/README.md` | 本地运行与 curl |
