# EntitlementCompile — 市场开通 → Edge 快照

| 字段 | 值 |
| --- | --- |
| 地位 | **权威**（开通编译契约；服从控制面 Canon） |
| 范围 | Marketplace Entitlement 如何进入 Gateway 可强制集合 |
| 上级 | [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md) · [WORK-CONNECT.md](./WORK-CONNECT.md) · Cloud [a3s-os-boundary.md](../../../cloud/docs/a3s-os-boundary.md) |
| 交付 | R8 UX + Cloud 编译；Gateway 只读快照（R6b 依赖编译结果） |
| 状态 | Decision v1（2026-09-18） |

---

## 1. 一句话

**开通在 Console / Marketplace；编译在 a3s-cloud；执行在 Gateway。**  
禁止 a3s-api 或浏览器「本地计算」可调用集合并当作权威。

---

## 2. 流水线

```text
Admin 开通 Listing（Env 作用域 Entitlement）
        │
        ▼
A3S Cloud EntitlementCompile
  输入：Entitlement 修订 + Grants + InferenceAccess / Route 绑定
  输出：不可变编译世代（generation）+ 有效 Listing/Route 集合摘要
        │
        ▼
Edge 完整 Gateway 快照（含 ACL / 限额投影）
        │
        ▼
Fleet → Node Agent 安装
        │
        ▼
Gateway 按 Capability Key 强制集合 · 写 Usage
```

---

## 3. 观测面（Console 必须可展示）

| 字段 | 含义 | 来源 |
| --- | --- | --- |
| `compileStatus` | `pending` · `compiled` · `failed` · `stale` | Cloud 投影（未接线时 UI 标预览） |
| `generation` | 编译世代号 | Cloud |
| `snapshotRev` | 已应用 Edge/Gateway 快照修订 | Gateway / Fleet 投影 |
| `entitledCount` | 当前 Env 开通 Listing 数 | Marketplace 投影 |
| `lastError` | 编译失败原因（无密钥） | Cloud |

**`stale`：** Entitlement 已变但快照仍为旧世代 — Work 可能仍看到旧集合直至收敛。

---

## 4. 与双轨能力的关系

| 轨 | 编译角色 |
| --- | --- |
| Market Listing（可调用） | EntitlementCompile → Gateway 路径 |
| Use / Registry 包（可安装） | **不**经本编译器装包；Skill Listing 可深链「需安装」状态机，安装仍走 Use 单一突变路径 |

---

## 5. 验收

| # | 项 |
| --- | --- |
| 1 | 开通/撤销后 Cloud 产生新 `generation`（或明确 `pending`） |
| 2 | Console「已开通」可展示 `compileStatus` / `generation` / `snapshotRev` |
| 3 | Gateway 强制与编译集合一致；未编译成功 fail-closed |
| 4 | 无 a3s-api 平行 Entitlement 权威表 |

未接线前：Console 使用本地预览投影，文案必须含 **预览**，不得暗示生产 Gateway 已应用。
