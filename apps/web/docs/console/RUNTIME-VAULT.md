# Runtime Upstream Vault

| 字段 | 值 |
| --- | --- |
| 地位 | **权威**（本地数据面执行副本；服从控制面 Canon） |
| 范围 | 上游 Provider 凭证 materialize / apply / receipt |
| 上级 | [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md) · [EVENT-BUS-AND-QUEUE.md](./EVENT-BUS-AND-QUEUE.md) |
| 状态 | Decision v3（2026-09-20） |

---

## 0. 第一性原理

1. **客户端只持 Capability Key** — 上游 `apiKey` 永不进入 Work / 浏览器调用契约。
2. **一个可变不变量一个所有者** — 绑定意图在 Console `providerSecrets`（内存）/ 未来 Cloud Secrets；Runtime vault 是**执行副本**，不是第二权威。供应商 `localStorage` Key 池仅为 ops fallback。
3. **队列禁止明文** — `vault.apply` 只携带 `secret_ref` + `version` + `scope`；明文仅经 loopback `materialize`。
4. **作用域化** — active binding 按 `organization_id / project_id / environment_id` 隔离（Console 同步透传 Cloud scope）。
5. **可证明收敛** — 每次 apply 写 `receipt`（applied / cleared / failed）；磁盘只持久化 receipts，**从不**落盘 `apiKey`。
6. **命名** — Runtime upstream vault ≠ Cloud HashiCorp `VaultClient`（控制面密码学）。

---

## 1. 两段式路径

```text
Console resolve plaintext (providerSecrets 优先 → supplier 池 fallback)
  │
  ├─① POST /__local/vault/materialize   ← 明文仅此跳（loopback，内存 sealed）
  │     seal(secret_ref, version, apiKey, baseUrl)
  │
  └─② POST /__local/queue/vault-apply   ← 无明文
        enqueue { kind, scope, provider, secret_ref, version }
          → worker applyVaultJob → receipt（磁盘）+ active（内存）
```

Providers：`boyue` · `siliconflow` · `worldmonitor`。

NATS 不可用时：② 在 Runtime 进程内直接 `applyVaultJob`（仍要求已 materialize）。  
遗留 `PUT /__local/upstream-secrets` 仅作最后兜底，会先 seal 再 apply，**不得**再把明文放进队列。

进程重启后 sealed/active 清空（fail closed），须由 Console 重新 sync；receipts 可从磁盘恢复供审计。

---

## 2. 观测

| 端点 | 含义 |
| --- | --- |
| `GET /__local/vault/status` | 各 provider 是否 present（无明文） |
| `GET /__local/vault/receipts` | 最近 apply 回执 |
| `GET /health` → `vault` | status 摘要 |

---

## 3. 契约与测试

| 不变量 | 证据 |
| --- | --- |
| `vault.apply` 拒明文 | `apps/runtime/src/http/router.rs` 的 `vault_apply` 返回 `vault.plaintext_forbidden` |
| materialize → apply → receipt；作用域隔离；清凭证 | `apps/runtime/src/upstreamSecrets.test.ts` |
| 磁盘无 `apiKey` | 同上 `disk file never stores apiKey plaintext` |
| fail-closed 缺凭证 | `apps/runtime/src/function.test.ts` |

---

## 4. 非目标（仍开放）

- Cloud Secrets 作为唯一**远程**权威（`AR0.3`）；本地仍允许 Console 内存绑定 + supplier 池 fallback
- 多节点 Runtime 共享同一 sealed store（需短租约 / brokered grant）
- 写接口除 loopback 外的调用方身份（Capability Key / 服务 mTLS）
