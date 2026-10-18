# Kense Gateway — 支撑 OS 的必做功能规划

| 字段 | 值 |
| --- | --- |
| 地位 | **规划附录**（服从控制面 / Work Connect 权威；指导 `apps/gateway` 交付） |
| 范围 | Gateway **必须完成**什么才足以支撑 Kense OS 数据面；**不是** Gateway 产品全量 ROADMAP |
| 上级 | [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [WORK-CONNECT.md](./WORK-CONNECT.md) · [API-ENVELOPE.md](./API-ENVELOPE.md) · [USE-GATEWAY-MARKET-BILLING.md](./USE-GATEWAY-MARKET-BILLING.md) · [ENTITLEMENT-COMPILE.md](./ENTITLEMENT-COMPILE.md) |
| 对偶 | [`apps/gateway/ROADMAP.md`](../../../gateway/ROADMAP.md)（实现成熟度 / 非目标） |
| 状态 | Decision v1（2026-09-18） |
| 冲突 | CONTROL-PLANE-BOUNDARY > WORK-CONNECT / API-ENVELOPE > 本文 > gateway 本地便利 |

---

## 0. 第一性原理（裁定用）

从 Canon 压成五条；**只有违反后 OS「一把 Key」故事会断」的能力才进必做表。

| # | 原理 | 对 Gateway 的含义 |
| --- | --- | --- |
| P1 | **管理面 ≠ 数据面** | Gateway 只执行已编译快照；不提供 Org/Grant/Deploy CRUD，不解释 Flow |
| P2 | **一种能力一种权威** | 不自建第二套 Identity / Entitlement / Usage ledger / 调度器；只读 Edge 投影并强制 |
| P3 | **一切昂贵调用过同一咽喉** | model · tool · api · feed ·（就绪后）HTTP MCP · 方案 API 代理均经同一 Key 入口 |
| P4 | **执行顺序固定** | 鉴权 → 协议校验 → 开通集合 → Env 硬顶 → 选路/回退 → prompt-free Usage |
| P5 | **用量账本 ≠ 商业结算** | Gateway 写 L1 事实并导出 Cloud；禁止钱包/Token Hub/回写 ledger |

**推导规则：**

- **必做（MUST）** = 砍掉后「Work/IDE 一把 Capability Key 调已开通能力」在生产语义上不成立。  
- **应做（SHOULD）** = 支撑规模化 / HA / 静态站等，但可分期；缺省不阻断 R6b 级联通。  
- **禁止（MUST NOT）** = 做成第二控制面或复制 Cloud/a3s-api 真相。

---

## 1. 平面分工（Gateway 只占一格）

```text
Cloud 编译   Grant · Route · Entitlement · InferenceAccess
      │ Edge complete snapshot
      ▼
Gateway 强制  Key · 集合 · 硬顶 · 路由 · Usage 写入
      │
      ├── model / Power / Provider
      ├── tool · api · feed（快照公布路径 / 适配器上游）
      ├── HTTP MCP（typed readiness 后）
      └── （可选）static object · managed runtime service
```

| 不变量所有者 | 进程 | Gateway 角色 |
| --- | --- | --- |
| 期望态 / 开通 / 路由修订 | **a3s-cloud** | 消费者 |
| 通讯录 / Member / OEM / 安装配置 | **a3s-api** | 无 |
| 数据面执行与计量写入点 | **a3s-gateway** | **唯一** |
| Function / Box / Power 业务语义 | Runtime | 上游，非 Gateway 内嵌逻辑 |

---

## 2. 必做能力清单（MUST）

按依赖排序；状态以 `apps/gateway` 仓库现状为准（2026-09-18 抽检）。

### Wave G0 — 数据面底座（无此则无 OS 咽喉）

| ID | 能力 | 验收证据 | 现状 |
| --- | --- | --- | --- |
| **G0.1** | 多协议入口 + 声明式路由 + 中间件管道 | HTTP(S)/SSE/WS/gRPC/TCP；ACL `entrypoints/routers/services` | **有**（`entrypoint` · `router` · `middleware` · `proxy`） |
| **G0.2** | Cloud-managed **完整快照**原子 apply / ACK / 恢复 | Node API `POST …/snapshots/apply`；拒绝残缺快照；失败可回滚到上一好修订 | **有**（`managed_snapshot` · `node_api`；ROADMAP H0.2） |
| **G0.3** | Standalone ACL 冷启动（开发/边车） | 无 Cloud 时本地 ACL 可跑通同等执行路径 | **有**（`config/mode`） |
| **G0.4** | 机器运维面（健康 / metrics / version）与用户流量隔离 | 独立 Node listener；不暴露管理 CRUD | **有**（`node_api`） |

### Wave G1 — Capability Key 强制（「一把 Key」成立）

| ID | 能力 | 验收证据 | 现状 |
| --- | --- | --- | --- |
| **G1.1** | Capability Key 鉴权（Bearer / 声明的 `X-Api-Key`） | 无效/缺失 → 拒绝；禁止 query 传 Key | **有**（inference auth + middleware） |
| **G1.2** | 快照凭证与 Grant **模型/资源集合**强制 | 未在编译集合内 → 拒绝；吊销后立即失效 | **有**（`inference/authorization` · grants） |
| **G1.3** | `GET /v1/models` = **该 Key 开通集合**，非全站目录 | 列表 ⊆ Entitlement∩Grants∩InferenceAccess；无跨 Env 泄漏 | **有**（`managed_inference_returns_only_granted_models_*` + ApiEnvelope `data`） |
| **G1.4** | 执行顺序：鉴权 → 协议 → 集合 → 硬顶 → 选路 → Usage | 触顶/未开通不得伪装 200；与 A3S-USE §5.2a 一致 | **部分**（RPM/并发/池/TPM + WORK 码已齐；**Env spend** 仍属 P1 / 依赖快照字段） |

### Wave G2 — Work Connect 契约（客户端可理解）

| ID | 能力 | 验收证据 | 现状 |
| --- | --- | --- | --- |
| **G2.1** | 数据面 JSON = **统一 ApiEnvelope**（成功/失败） | 符合 [API-ENVELOPE.md](./API-ENVELOPE.md)；业务体在 `data` | **有**（准入失败 + `models` + **非流式 chat JSON**（有界 Content-Length）；**SSE 仍原生**；不完整 CL fail-closed） |
| **G2.2** | 稳定错误码 taxonomy | `auth.invalid_key` · `auth.revoked` · `entitlement.denied` · `quota.exceeded` · `route.not_ready` · `upstream.exhausted` · `request.invalid` | **有**（含 `UpstreamExhausted`） |
| **G2.3** | 关联头 | 客户端 `x-request-id` 回显；可选 `traceparent` | **有**（信封 `request_id` + 响应头；与既有 identity 对齐） |
| **G2.4** | 快照/路由未就绪 **fail-closed** | 503 `route.not_ready`；空 worker 不伪造成功 | **有**（`Unavailable` / `UsageUnavailable` → `route.not_ready`） |

### Wave G3 — 协议面广度（「全部已开通能力」）

| ID | 能力 | 验收证据 | 现状 |
| --- | --- | --- | --- |
| **G3.1** | `kind=model`：`POST /v1/services/model/invoke/{sku}` | 业务体在信封 `data`；流式边界另议 | **有**（Runtime model invoke） |
| **G3.2** | 全部 Listing：`POST /v1/services/{kind}/invoke/{sku}` | `{sku}`=商品；细分接口后缀；同一 Key / L1 | **有** |
| **G3.3** | HTTP MCP：仅 **typed readiness** 后准入 | 未就绪 fail-closed；stdio MCP **不**经公网 Gateway | **部分**（managed service `/mcp` 代理测试；无产品级 typed gate） |
| **G3.4** | 冻结候选 / 回退 / 护栏（快照内） | 上游耗尽 → `upstream.exhausted`；不泄露上游凭证 | **有**（fallback 耗尽 / 残缺 JSON → `UpstreamExhausted`） |

### Wave G4 — L1 计量与导出（运营可对账）

| ID | 能力 | 验收证据 | 现状 |
| --- | --- | --- | --- |
| **G4.1** | 本地 **prompt-free** 耐久 spool | 磁盘有界；进程崩溃可恢复游标 | **有**（`usage/spool` · lifecycle） |
| **G4.2** | 归因字段：Org / Project / Env / Credential / Listing·Route / tokens\|units | 记录可被 Cloud ledger 接纳 | **部分**（Listing SKU / `listing_id` 走既有 `model_alias` / `model_id`，endpoint `tools` 已进 Cloud 合同；Org/Project 仍不单列） |
| **G4.3** | 向 Cloud 幂等上传 `kense.gateway.usage-batch.v1` | mTLS/约定传输；收据推进游标 | **有**（`usage/cloud_ingest` · docs/usage-cloud-ingest.md） |
| **G4.4** | Env/Key **RPM · TPM · spend** 硬顶在执行点拒绝 | 429 + `quota.exceeded`；不写成功 Usage | **部分**（RPM/并发/TPM；spend 与 WORK 码待闭合） |

> **说明：** 客户端 `GET /v1/usage*` showback **不是** Gateway MUST（可读 Cloud 或本地 Function 导出）；Gateway MUST 是 **写入点 + 导出契约**。

### Wave G5 — 与 Runtime 协作的执行目标（OS 车道，非第二控制面）

| ID | 能力 | 验收证据 | 现状 |
| --- | --- | --- | --- |
| **G5.1** | Power / 分布式推理：快照无 worker 时 fail-closed；有 worker 时真实转发 | I0.2b EXIT 与 Cloud/Power 联调 | **部分**（本地 Dual-track 锁；跨产品 EXIT 开） |
| **G5.2** | Managed runtime service 绑定（健康上游） | 仅代理已发布健康端点 | **有**（`managed_service`） |
| **G5.3** | WEB0 只读 static-object 目标 | 不可变 manifest + digest 准入 | **本地基础有**（`static_object`）；Cloud object authority 依赖 WEB0.1 |

---

## 3. 明确非目标（MUST NOT）

| 禁止 | 原因 | 归属 |
| --- | --- | --- |
| Org / Project / Grant / Route / Entitlement CRUD | 管理面 | A3S Cloud |
| 解释 Flow Plan / HumanTask / Agent checkpoint | 编排权威 | Cloud / Runtime |
| 签发 Capability Key / 通讯录 User | 身份权威 | Cloud Identity · a3s-api 目录 |
| Token Hub / 钱包 / L2 开票回写 ledger | 账本纯度 | 外部商业服务 |
| 第二套 Usage 权威或 Console「网关策略编辑器」 | 重复 Inference | Cloud Inference + Edge |
| 普通 Agent egress 代理、注入凭证、改写 Tool 结果 | Agent Runtime 边界 | Cloud agent-runtime |
| 以 a3s-api `/api` 冒充 Work 数据面 | 第二咽喉 | 禁止 |
| 请求体经 Cloud 转发 | 平面污染 | 禁止 |

---

## 4. 交付优先级（支撑 OS 的最短路径）

```text
G0 底座 ──► G1 Key 强制 ──► G2 Work 契约 ──► G3 协议广度 ──► G4 计量闭合
                              │
                              └─► G5 Runtime EXIT（与 Cloud/Power 并行，不阻塞 G2）
```

| 优先级 | Waves | 产品含义 |
| --- | --- | --- |
| **P0** | G0 + G1 + **G2** + G3.1 + G4.1–G4.3 | Work/IDE 能用一把 Key 调开通模型，错误可理解，用量进 Cloud |
| **P1** | G1.4/G4.4 硬顶闭合（G3.2 已闭合） | Env spend 硬顶；市场 Listing 路径强制已由 G3.2 承担 |
| **P2** | G3.3 + G5.1 | HTTP MCP 产品准入；Power 真 worker EXIT |
| **P3** | G5.3 | 静态站公网交付（Cloud WEB0 就绪后） |

**过拟合拒绝：** 不把企业 HA soak、NGINX 替代、多模态设计、standalone 自动扩缩列为「支撑 OS」的 MUST；那些属 gateway 产品成熟度，见 `apps/gateway/ROADMAP.md`。

---

## 5. 跨仓依赖（Gateway 单独做不完）

| 依赖 | 所有者 | 阻塞的 MUST |
| --- | --- | --- |
| EntitlementCompile → Edge 完整快照 | Cloud | G1.2–G1.3 · G3.* |
| Inference credential ≡ Capability Key | Cloud Identity | G1.1 |
| Usage ledger 接纳 batch | Cloud Inference | G4.3 |
| Power worker 观测与发布 | Cloud / PW0 / Box | G5.1 |
| Listing 上游适配器实现 | Provider / Function / Runtime | 不阻塞 Gateway：G3.2 只强制路径并计量 |
| ApiEnvelope 客户端解包 | Work / SDK | G2（Gateway 出信封；客户端必须 unwrap） |

---

## 6. 验收总闸（何时可称「足够支撑 OS 数据面」）

同时为真：

1. **一把 Key**：同一 Credential 可调已开通 model，未开通立即 `entitlement.denied`（信封）。  
2. **平面干净**：管理 CRUD 不经 Gateway；昂贵 body 不经 Cloud/a3s-api。  
3. **契约对齐**：WORK-CONNECT §3–4 + API-ENVELOPE 在 chat/models（及已声明 tool 路径）上有回归证据。  
4. **计量闭合**：成功/拒绝分类正确；L1 spool → Cloud batch 可对账。  
5. **fail-closed**：空快照 / 空 worker / 未就绪 MCP 不产生伪成功。

未要求：OEM、Console CRUD、L2 账单、全协议 NGINX 平替。

---

## 7. 与现有分析的关系

| 文档 | 关系 |
| --- | --- |
| 本文 | **必做规划**（OS 视角） |
| `apps/gateway/ROADMAP.md` | 实现成熟度、soak、企业 GA、非目标细节 |
| 先前「是否足够」结论 | 数据面咽喉 **部分足够**；本文把缺口收成 G4.4 / G5.1 交付项 |
