# 技能商品 — 第一性全流程路径（已废止）

> **已废止（2026-10-02）**：连接器与技能**不再作为商品提供**（无 listing / SKU / 价格 / 上下架 / 对外下载门控）。
> 二者是「能力扩展」，由 a3s-api `capability` 上下文管理：运维面 `/api/admin/capabilities`（Console 运营侧边栏「技能」`/admin/capabilities/skills` 与「连接器」`/admin/capabilities/connectors`），
> 成员面 `/api/org/capabilities`（Studio 能力扩展安装/卸载）。运维在 Console 直接上传技能包（.zip 或 SKILL.md）与图标，
> 文件存 RustFS；Cloud 的 `market-listings/{id}/skill-package|skill-bundle` 路由已删除，已安装技能包由
> `GET /api/org/capabilities/{slug}/bundle` 从 RustFS 下发，Studio 按 `install.digest` 校验并钉住。
> 下文仅作历史记录，不得据此实现。

| 字段 | 值 |
| --- | --- |
| 地位 | **已废止**（见文首） |
| 范围 | 代码托管 → 制品构建 → 商品上架 → 对外下载 |
| 上级 | [ARCHITECTURE.md](./ARCHITECTURE.md) · [prd/08-marketplace.md](./prd/08-marketplace.md) · [AGENT-MODEL-PRODUCT-PATH.md](./AGENT-MODEL-PRODUCT-PATH.md) |
| 状态 | Decision draft v1.0（2026-09-20） |
| 冲突 | 与 Canon 冲突时：**Canon > 本文**；Console fixture **不得**标成生产闭环 |

---

## 0. 第一性公理

1. **一个可变不变量一个所有者** — Skill 源、`skill_bundle` 制品、MarketListing、下载门控（env offer）各有唯一写者；浏览器永不持真相。
2. **可安装 ≠ 可部署 ≠ 已下载** — Listing 上架是要约；Workload 绑定是期望态；对外下载是 Objects/CAS 取件。三者不得揉成一步 UI。
3. **Skill 是能力市场 kind** — `MarketListingKind` 已含 `skill`（与 `agent` 不同：智能体不是 Listing kind）。
4. **制品契约唯一** — 对外分发物只认 `application/vnd.a3s.skill.bundle…`（`SKILL_BUNDLE_MEDIA_TYPE`）+ digest；禁止「手填版本跳过流水线」。
5. **假绿禁止** — `apps/web/src/data/skills.ts` / `supply.ts` 内存态仅只读 preview；不得暗示多租户 Cloud 已闭环。
6. **不复制机制** — 不在 Console 另建 Git/OCI/计费；下载走既有 Artifact store + env offer，不新开 CDN 权威、不另造买方 grant 表。

---

## 0.1 决策冻结（P0 ADR）

| 决策 | 裁定 |
| --- | --- |
| Skill 是否用 `MarketListingKind::Skill` | **是**。上架走 Inference `PublishMarketListing`（`kind=skill`）。 |
| Skill 构建是否走 Hosted Box / Workload recipe | **否**。`CreateAssetRelease` 对 Skill 同步 `prepare_release_bundle` → 存 CAS；禁止 build_recipe。 |
| 源托管权威 | Cloud **Assets**（`AssetKind::Skill` + Asset Git 仓）；Console Sources fixture 非权威。 |
| 运行时取件 | Node Control `artifacts:download`（节点侧）；对外下载 = **env offer（`entitled`≡`generation≥1`）∩ digest** 的 bundle 取件（非独立买方 grant）。 |
| Host 安装 | **不**经 Market UI 直接 `a3s-use apply`；Listing 深链 Registry / Plugin Manager（见 [USE-GATEWAY-MARKET-BILLING.md](./USE-GATEWAY-MARKET-BILLING.md) · M8）。下载 ≠ 安装突变。 |
| Console fixture | 仅只读预览；**写路径已关闭**（无 Cloud scope 时 fail-closed）。 |

违反本表的 PR：**拒收**。

---

## 1. 产品本体与所有权

```text
┌─ 源（代码托管）──────────────────────────────────────────┐
│  Assets AssetKind::Skill + Git 仓（SKILL.md 树）           │
│  所有者：Cloud Assets                                     │
└───────────────────────────┬──────────────────────────────┘
                            │ CreateAssetRelease(commit)
                            ▼
┌─ 制品（构建）────────────────────────────────────────────┐
│  skill_bundle → INodeArtifactStore (digest, media_type)   │
│  所有者：Cloud Assets（catalog_service 同步封存）         │
└───────────────────────────┬──────────────────────────────┘
                            │ PublishMarketListing(kind=skill)
                            ▼
┌─ 商品（上架）────────────────────────────────────────────┐
│  MarketListing + Entitlement generation                   │
│  所有者：Cloud Inference                                  │
└───────────────────────────┬──────────────────────────────┘
                            │ entitled download / node fetch
                            ▼
┌─ 分发（对外下载）────────────────────────────────────────┐
│  CAS blob by digest（env offer 或节点 admission）           │
│  运行时绑定：Workloads BindSkillWorkloadDeployment        │
└──────────────────────────────────────────────────────────┘
```

| 概念 | 是 | 不是 |
| --- | --- | --- |
| 技能商品 | 可售卖的 `skill` Listing + 钉死的 AssetRelease | 工作区里随便一份 `SKILL.md` |
| 构建 | Git commit → 不可变 `skill_bundle` | Hosted OCI / Box Agent 构建菜谱 |
| 下载 | 对 digest 的授权取件 | 把源仓 URL 当分发渠道 |

### 1.1 现状证据锚点

| 断言 | 权威路径 | 状态 |
| --- | --- | --- |
| Listing kind 含 `skill` | `.../inference/.../market_listing.rs` | DONE |
| Skill 无 build_recipe、同步 bundle | `.../assets/.../catalog_service.rs` | DONE |
| `skill_bundle` 介质 | `application/vnd.a3s.skill.bundle.v1+zip`（`SKILL_BUNDLE_MEDIA_TYPE`） | DONE |
| Workload 绑定 Skill release | `BindSkillWorkloadDeployment` + migration `067` | DONE |
| 节点下载制品 | `fleet/.../artifacts:download` | DONE（节点侧） |
| Console Skills 读 | `skills.ts` 内存只读 preview（无 Cloud scope） | DONE（写 API fail-closed） |
| 对外下载 API | a3s-api `/cloud/skills/listings/{id}/skill-bundle` → Cloud | DONE（session proxy；门控=env offer） |
| Console → Cloud Assets/Listing 写路径 | `skillsApi.ts` → a3s-api `/cloud/skills*` | DONE（需 A3S_CLOUD_API_TOKEN + Cloud scope） |

---

## 2. 语义钉死（第一性）

| 词 | 唯一含义 | 禁止 |
| --- | --- | --- |
| **listed** | 该 env 存在 `MarketListing`（`kind=skill`）行 | 用 `AssetRelease.state === published` 冒充（Skill release 创建即 published） |
| **built** | 有带 `skill_bundle` artifact 的 AssetRelease | 把 published release 标成 listed |
| **entitled** | 本 env 持有该 Listing 要约（publish 时 `generation ≥ 1`） | 叙事成跨租户买方 grant / Track B EntitlementCompile |
| **下载门控** | `entitled()` ∩ InferenceAccess ∩ digest | 无 Listing 仍可下包 |

权威路径：`Console skillsApi` → a3s-api `/cloud/skills*` → Cloud SDK。`cloudSkillsApi` 已废弃。`package_registry` / `skills.ts` **不是**技能商品权威。

### 2.1 已闭合的历史断层

| 原缺陷 | 现状 |
| --- | --- |
| D1 fixture 双写 | Skills / Eng skill 写路径 fail-closed；fixture 只读预览且不标 listed |
| D2 无开通下载 | `skill-bundle` / `skill-package` 门控 `entitled()`（env offer） |
| D3 UI 不上架 Cloud | `publishCloudSkillListing` → Cloud `PublishMarketListing` |
| D4 假 Sources | Cloud Asset Git；Console Sources fixture 非权威 |

---

## 3. 目标闭环（证伪形状）

生产上「技能商品全流程」成立，当且仅当：

```text
Cloud CreateAsset(kind=skill)
  → Asset Git 托管 SKILL.md（或导入已有仓）
  → CreateAssetRelease(version, commit_sha)
       → skill_bundle 入 CAS（digest 钉死）
  → PublishMarketListing(kind=skill, asset_id, asset_release_id, …)
  → 同 env 持有 offer（entitled ≡ generation≥1；非独立买方 grant）
  → GET 授权下载（同一 digest；失败闭合）
  → （可选）BindSkillWorkloadDeployment 挂到 Agent Workload
  → Console 只投影上述事实（listed ⇔ MarketListing 存在）
```

**反例：** Console 显示「已上架」但 Cloud `market_listings` 无行；或下载 URL 不校验 `entitled()`。

---

## 4. 优化路径（P0 → P3）

### P0 — 钉本体 + 去假绿

| 做什么 | EXIT |
| --- | --- |
| 本文挂 README / Marketplace 文档索引 | 侧栏/创建流不暗示 fixture=生产 |
| Skills / MarketCatalog skill 标明「本地预览 · 权威在 Cloud」 | 无「已上架到多租户」假绿 |
| 冻结：Skill 继续用 Listing kind；不新建并行商品表 | §0.1 |
| listed 同源 MarketListing（list/get summary + UI） | `cloudSkillMarketState` 仅看 `marketListing` |

### P1 — Console 写路径迁 Cloud（托管 + 构建 + 架）

| 做什么 | EXIT |
| --- | --- |
| **单一客户端** `skillsApi` → a3s-api → Cloud | 浏览器不直连 Cloud Skills REST |
| Console 持 session；api 持 `A3S_CLOUD_API_TOKEN` | 无 Cloud scope 时写路径失败闭合 |
| 发布：`PublishMarketListing(kind=skill)` | Postgres `market_listings` 有行 |
| `skills.ts` 只读 preview | 禁止 fixture 构建/上架 |

**阻塞：** 本地需 `A3S_CLOUD_BASE_URL` + `A3S_CLOUD_API_TOKEN` 与 Console Cloud scope（project/env）。


### P2 — 对外下载

| 做什么 | EXIT |
| --- | --- |
| Env-offer 门控的 bundle 下载（复用 Artifact store，不新 CDN） | 无 offer → 403；有 offer → bytes+digest 校验 |
| Marketplace / Ops UI「下载」走该 API | 浏览器可得包；审计有 request_id |

### P3 — 运行时与目录收敛

| 做什么 | EXIT |
| --- | --- |
| 已开通 Skill → 可选一键 BindSkillWorkload | Operation 可见 |
| Eng `package_registry` 隔离：非技能商品权威 | 文档 + 模块注释；Skill 商品不经 Eng packages |

---

## 5. 业界对照（实践约束，非抄产品）

| 实践 | Kense 落点 |
| --- | --- |
| 不可变制品 + digest（npm tarball / OCI layer） | `skill_bundle` + CAS digest |
| 注册表元数据与 blob 分离 | MarketListing vs Artifact store |
| 授权后下载（私有 registry token） | env offer ∩ download |
| 源在 VCS、发布物在 registry | Asset Git → bundle；不把 Git URL 当安装源 |

---

## 6. 验收清单（目标完成时）

- [x] 无 Console 内存态也能：创建 Skill Asset → Release bundle → Listing（经 a3s-api + Cloud token）
- [x] `GET …/market-listings/{id}` + `…/skill-package`（开通 + Assets 准入 + digest）
- [x] `GET …/skill-bundle` 开通门控字节下载（`x-skill-bundle-digest`）
- [x] `market_listings` publish 时 Asset FK / kind 准入（Cloud `PublishMarketListing` + skill release admission）
- [x] Console Skills list/detail：`listed` 仅当 `marketListing != null`
- [x] 无 Cloud scope：Skills 写路径 fail-closed
- [x] 单一 `skillsApi`；`cloudSkillsApi` deprecated
- [x] Skill Listing ↔ Registry 深链（M8：`registryDeepLink` + Console「打开 Registry」；`installMode=bundle_download`；禁止 Market UI `a3s-use apply`）
- [x] Skill 买方下载 entitlement（Publish → `generation≥1` = env offer；`skill-bundle` / package 门控 `entitled()`）
- [ ] Gateway Edge EntitlementCompile 纳入 **online Listing 调用**（Track B；**本目标明确不做**）
