# Kense OS — 研发交付路线图

## SMS provider configuration and content management

| Gate | Result | Evidence |
| --- | --- | --- |
| SMS-PROVIDER-CONSOLE-2 | Six management tabs; searchable tables and separate edit dialogs; provider schema/conditional credential forms; save/cancel/CAS; managed signatures, engine templates and exact scenario bindings. Main 3100 menu/layout observed; actual backend/account save remains unavailable. Bounded DOM/routes/build gate passed. | [OUTCOME](../../../../docs/evidence/sms/20261008-content-management/OUTCOME.md) |
| SMS-CONSOLE-CREDENTIAL-3 | Native save reproduced 403 missing `sms:write`; Console issuance now includes SMS scope, and login/org changes clear stale Cloud credentials. 5 API tests, 22 Console session/route tests, 4 SMS DOM tests and build passed. Feature correction verified; end-to-end acceptance explicitly assigned to humans. Observed runtime population blocked by unrelated API migration 080 checksum drift; no saved data or full expanded certification claimed. | [OUTCOME](../../../../docs/evidence/sms/20261008-console-write-scope/OUTCOME.md) |

## Console 插件分发增量（2026-10-08）

| Gate | 交付范围 | 验收状态 | 证据 |
| --- | --- | --- | --- |
| TEAM-WORKBENCH-1 | 删除七个旧 Office/Review 插件目录，改为团队内置工作台；日程和邮件迁入团队侧边栏 | 本机认证 HTTP 已删除 7 条目录记录；API 重启后目录仍为空，13 个历史版本及 7 条安装记录哈希未变；工作台提交/审批、团队侧栏及存储双适配器验证通过；原生 GUI 与真实成员审批 HTTP 未认证 | [OUTCOME](../../../../docs/evidence/studio-team/20261008-team-workbench/OUTCOME.md) |
| AIX-MIG-1 | 内置 Office 包生成与现有 Console 原生插件目录迁移为 AIX；保留历史归档及安装固定版本 | 已在本机运行中的 PostgreSQL/RustFS 执行：6 个 Office 包升至 0.1.1，当前目录 7/7 为有效 AIX；7 条安装记录及历史版本元数据未变；认证 HTTP 与双适配器迁移测试通过，重跑转换数为 0 | [OUTCOME](../../../../docs/evidence/console-plugins/20261008-aix-data-migration/OUTCOME.md) · [操作说明](../../../api/docs/AIX-PACKAGES.md#existing-console-data-migration) |
| VSIX-HOST-1 | 插件页 VSIX 上传、版本目录、SHA-256 固定下载、下架/恢复发布；复用 plugin context、PostgreSQL、RustFS；成员只读已发布版本 | MVP 代码及本地 HTTP/交互验证完成；生产会话 + PostgreSQL + RustFS 实机链路待验收，当前沙箱拒绝本地 PostgreSQL 连接；Studio 外部扩展运行仍独立验收 | [OUTCOME](../../../../docs/evidence/console-plugins/20261008-vsix-hosting/OUTCOME.md) · [接口说明](../../../api/docs/VSIX-HOSTING.md) |
| VSIX-HOST-2 | 托管 Web VSIX 作为 plugin 包格式进入成员能力目录、账户安装记录与固定版本下载；Studio 复用原插件页面和安装/卸载流程 | 本地 API 与 Studio 安装流程已验证；迁移 079、生产 PostgreSQL/RustFS 链路及外部扩展运行待验收 | [OUTCOME](../../../../docs/evidence/studio-plugins/20261008-vsix-plugin-type/OUTCOME.md) |
| SVC-CATALOG-P0 | 把智能体、连接器、技能、插件的现行接口写回 API.md 与 BOUNDARIES.md。不改路由、表或钉扎 | 文档路径、`kind` 闭集和三套安装记录与控制器一致。未跑 HTTP，也未改数据库 | [OUTCOME](../../../../docs/evidence/service-catalog/20261011-api-contract-baseline/OUTCOME.md) |
| DOCS-ROUTE-1 | Console 平台、控制面、数据面文档并到公开路由 `/docs`。旧 `/admin/cloud/docs` 与 `/admin/developer/docs` 跳转 | 路由助手测试与页面切换测试通过。本机 `:3100` 打开 `/docs`，切到后台接口，并从旧地址进入控制面与数据面 | [OUTCOME](../../../../docs/evidence/console-docs/20261011-unified-docs-route/OUTCOME.md) |
| DOCS-WITH-API | `just api` 在 `docker compose up` 之后同时启动文档站 `:3100/docs` | `scripts/ensure-docs.sh` 在文档站已应答时立即返回。未重新前台启动 API | [OUTCOME](../../../../docs/evidence/console-docs/20261011-docs-with-api/OUTCOME.md) |
| DOCS-NAV-1 | `/docs` 顶栏分成标题行和来源行。平台的前台/后台改成分段开关 | 页面测试 2 通过。浏览器核对了平台、控制面、数据面和 390 宽。平台正文本次是 OpenAPI HTTP 504，`:3000` 未在听 | [OUTCOME](../../../../docs/evidence/console-docs/20261011-docs-nav/OUTCOME.md) |

| 字段 | 值 |
| --- | --- |
| 地位 | **权威**（Delivery roadmap · Kense 仓） |
| 范围 | Console（`apps/web`）· 扩展面（`apps/api`）· 与 **a3s-cloud** 的接线顺序 |
| 服从 | [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md) > 本文 > 旧 PRD 里程碑表 |
| 对照 | a3s `apps/cloud/ROADMAP.md`（闸门与 Verified）；[prd/00-master.md](./prd/00-master.md)（屏幕规格） |
| 状态 | Decision v1（2026-09-18） |
| 非范围 | 改写 a3s 产品闸门；宣称未 Verified 的可用性；在 a3s-api 复制控制面 |

---

## 0. 路线图第一性

1. **先所有权，后功能广度。** 未钉死「谁写期望态」的功能不排进关键路径。  
2. **管理面接线 ≠ 数据面可用。** Console 接 A3S Cloud API 是管理面；Work/IDE 过 Gateway 是数据面——分期验收。  
3. **跟 a3s 闸门，不跟侧栏叶子冲动。** 函数与耐久单元页面已经调用 Cloud，侧栏不标预览。这不等于 `FN0`/`CELL0` 可用性已过；未过闸门不得写成 EXIT。  
4. **扩展面只做增量。** a3s-api 深化通讯录/Member/安装配置；model/git/oci **有退出波次**。  
5. **禁止第二控制面与假绿。** mock 仅标预览；生产路径零本地权威写入。

---

## 1. 与 A3S Cloud 闸门的依赖（只读对齐）

Kense 波次 **消费** a3s 状态，不重新定义 Verified：

| a3s 能力（摘要） | Kense 可开始的工作 | Kense EXIT 额外要求 |
| --- | --- | --- |
| F0 / C0 管理面 API | 客户端 SDK/代理、错误码对齐 | Console 真调用 + 作用域头 |
| H0.1–H0.2 · BX0.software | **R2** 运行平面接线 | List/Detail 无 mock 权威；排水/快照只读可见 |
| GA-1 Agent（管理面→窄 Code 可用） | **R4** | 至少一条真 Agent 发布/执行证据链在 Console 可点通 |
| `AR0.1`+ Ready / egress 投影（Wave H 排序提示） | **R4b** | **分期**：α 跟 `AR0.1` 投影；β 仅在 `AR0.2` 后显示 egress digest；禁止未 Verified 的 suspend/ssh CTA |
| GA-2 一 Workflow/Application 路径 | **R5** | 一 Goal→Plan→Run +（可选）一 Application 发布可见 |
| Inference Track A（路由/用量账本） | **R6** | 路由 CRUD + Usage showback；**不**宣称 Power 数据面 |
| PW0 / 数据面推理 | **R6b**（后置） | Capability Key 经 Gateway 真调用 |
| FN0 / CELL0 可用性 | **Rx 延期** | 控制台页已调 Cloud，不标预览；可用性闸门仍在 Cloud |

硬件 / TEE / LIVE CERTIFIED：Kense **不**单开波次；跟随 a3s，跳过硬件门。

---

## 2. 波次总览

```text
R0 边界冻结（文档） ──► R1 壳+通讯录真 ──► R2 运行平面真（Cloud）
         │                      │
         │                      └─► R3 SubjectLink / Project·Env 联邦
         │                                │
         ├──────────────────────────────► R4 Agent（GA-1）
         │                                R4b AR0 投影（Ready/egress，跟 Wave H）
         │                                R5 Workflow（GA-2）
         │                                R6 Inference 控制面 + Usage
         │                                R7 供给 digest 准入 · 过渡退出
         │                                R8 市场开通 UX · OEM 投影
         └─ Rx 延期：FaaS · Cell · 全矩阵 · PW0 数据面 · 分布式 I0
```

| 波次 | 名称 | 主仓工作 | 依赖 | EXIT（摘要） |
| --- | --- | --- | --- | --- |
| **R0** | 边界冻结 | Canon 文档 | — | CONTROL-PLANE-BOUNDARY · BOUNDARIES · INTERFACE-FULL-LINK · a3s-os-boundary 交叉引用一致 |
| **R1** | 壳 + 通讯录真 | Console ↔ a3s-api identity/member；Scope Org；预览标记平台 mock | R0 | 组织/用户/部门真 API；平台页标注预览或未接线 |
| **R2** | 运行平面真 | Console ↔ **a3s-cloud** Gateway/Workloads/Fleet；平台总览聚合只读 | R0；a3s H0+BX0.software | 三页去 mock 权威；健康/快照/副本来自 Cloud |
| **R3** | 身份联邦 | SubjectLink；Cloud Project/Env 进 ScopeSwitcher；Grant 以 Cloud 为准 | R1+R2 启动可并行 | 无双写 Grant；部门≠Env；切换 scope 带 Cloud 身份 |
| **R4** | Agent 垂直 | Agents/Tasks（审批收件箱）接 Cloud；占位页退役 | R3；a3s GA-1 管理面 | 发布→执行/审批证据可在 Console 演示 |
| **R4b** | Governed Agent Runtime 投影 | **α**：跟 Cloud `AR0.1` 的 create/get/list/exec/log 投影与已有审批/逻辑 checkpoint 只读；**β**：`AR0.2` 后只读 egress digest 摘要 | R4；α←Cloud `AR0.1`；β←`AR0.2`（见 [ax-inspired-agent-platform-plan.md](../../../../docs/ax-inspired-agent-platform-plan.md)） | 无第二控制面；无 mock Ready；无发明 Ready 枚举；无 suspend/ssh CTA 直至 Cloud `AR0.7`/H5 |
| **R5** | Workflow 窄路径 | Workflows 接 Cloud 一路径；HumanTask 并入 `/tasks` | R3；a3s GA-2 一路径 | 一完整 Run 可观测；不宣称 23 节点矩阵 |
| **R6** | Inference + Usage | 路由/策略/密钥管理面 + Usage showback | R3；Inference Track A | 无 Token Hub；showback≠账单；数据面另见 R6b |
| **R6b** | 数据面咽喉 | Work/客户端 Capability Key → **a3s-gateway** 真调用 | R6；PW0/相关 | 一把 Key；触顶错误可理解；验收清单 [WORK-CONNECT.md](./WORK-CONNECT.md) §7 · [INTERFACE-FULL-LINK.md](./INTERFACE-FULL-LINK.md) §4 |
| **R7** | 供给收敛 | ArtifactAdmission；model_supply/git/oci **退出唯一权威** | R2+ | 生产绑定只认 Cloud digest；kense 拉取降为便利 |
| **R8** | 市场 · OEM | Entitlement UX；客户/渠道投影；编译在 Cloud | R6 | 开通集合可管；无钱包；OEM 白标过滤 |
| **Rx** | 延期车道 | 全 APP0.6/K0、数据面等。函数/耐久单元页不再用预览文案充当局门 | a3s 对应闸门 | 不得抢占 R2–R6 资源 |

**R0 现状：** 文档 Canon 已落地（2026-09-18）；本路线图将其记为基线，后续波次以代码与闸门证据推进。

---

## 3. 分波次说明

### R0 — 边界冻结

| 交付 | 证据 |
| --- | --- |
| 单一控制面裁定 | `CONTROL-PLANE-BOUNDARY.md` |
| a3s-api 准入表 | `apps/api/docs/BOUNDARIES.md` |
| Cloud 对偶 | a3s `docs/a3s-os-boundary.md` |

### R1 — 壳 + 通讯录真（扩展面）

| In | Out |
| --- | --- |
| Member / Department / User / 管理员角色目录走 a3s-api | 在 a3s-api 实现 Resource Grant / Route / Workload |
| Console 组织/用户页去假权威 | 假装平台运行数据为真 |
| 平台域 mock **统一「预览」** 标记 | 无标记的假绿 |

### R2 — 运行平面真（关键路径优先）

业界与边界一致：**先让入口与收敛可见**，再堆产品泳道 UI。

| 叶子 | 后端 |
| --- | --- |
| `/gateway` · `/workloads` · `/fleet` | A3S Cloud |
| `/overview/platform` | 聚合 Cloud 只读健康/告警投影 |

EXIT：三页 + 总览关键卡片无「静默 mock」；401/作用域错误失败闭合。

### R3 — 身份联邦

| 契约 | 验收 |
| --- | --- |
| SubjectLink | 通讯录 User ↔ Cloud Principal 可查询 |
| DirectoryProjection | 按部门授权 = Grant 主体引用，移动部门不改 Env |
| ScopeSwitcher | Project/Env 列表来自 Cloud |

### R4 / R5 — 产品垂直（跟 a3s GA）

| 波次 | Console | 禁止 |
| --- | --- | --- |
| R4 | Agents · 统一 `/tasks` | 双 inbox；a3s-api 伪 Agent 库 |
| R4b-α | `AgentRuntime` 投影 · 审批与逻辑 checkpoint 只读 | 发明 Cloud API；把候选 Ready 名写成产品契约；Cloud REST+SDK+api 已有 create/get/list/stop/logs；Console `/agent-runtimes` α 页已接投影（无 Ready 枚举、无 suspend CTA） |
| R4b-β | egress digest **只读**摘要（`AR0.2` 后） | Gateway 出站配置 UI 当真；未 H5 的 suspend/ssh |
| R5 | Workflows 窄路径 | 「全节点矩阵已可用」文案 |

R4b 对齐 OS Wave H **排序提示**（[ax-inspired-agent-platform-plan.md](../../../../docs/ax-inspired-agent-platform-plan.md)）：Console **消费** Cloud 投影，服从 Cloud 门禁，不拥有沙箱生命周期。

### R6 / R6b — 推理

| 波次 | 内容 |
| --- | --- |
| R6 | 管理面：路由修订、密钥、限额、Usage showback |
| R6b | 数据面：Gateway 真推理/工具调用（依赖 PW0 等）；契约 [WORK-CONNECT.md](./WORK-CONNECT.md)；开通编译 [ENTITLEMENT-COMPILE.md](./ENTITLEMENT-COMPILE.md) |

**R6b EXIT（与 WORK-CONNECT §7 对齐）：**

1. 客户端仅 baseURL + 一把 Capability Key  
2. 至少一条 `model` 路径端到端成功  
3. Usage ledger 有归因事实  
4. 401/403/429 可理解  
5. 流量不经 a3s-api  

### R7 — 供给过渡退出

按 BOUNDARIES 停止条件：

1. 拉取产物 → content digest  
2. Cloud Artifact/Asset（或准入端口）承认  
3. Console「部署/绑定」只引用 Cloud 修订 ID  
4. kense `model_supply` / `git_store` / `oci_registry` 降级为可选便利或只读

### R8 — 市场与商业投影

- 市场 / 已开通：UX 在 Kense；**EntitlementCompile 在 Cloud**  
- 客户 / 渠道：OEM 投影；无省代、无钱包  

### Rx — 明确延期

| 项 | 原因 |
| --- | --- |
| Functions / Cells 可用性闸门 | 页面已调 Cloud；FN0/CELL0 未过不得写成 EXIT |
| 全 Application 六模式 · 全 Knowledge 矩阵 | P2 / 非窄路径 |
| TEE / KVM LIVE | 硬件门；软件路径不堵 |
| Token Hub | 架构禁止 |

---

## 4. 旧 PRD 里程碑映射（废止并行权威）

`prd/00-master.md` 原 M0–M5 以「UI 点通」为主，**交付顺序改由本路线图波次约束**：

| 旧里程碑 | 新归属 | 说明 |
| --- | --- | --- |
| M0 Shell IA | R1 | 保留；导航以 `destinations.ts` 为准 |
| M1 P0 IAM | R1 + R3 | 通讯录真在 R1；Grant/Env 联邦在 R3 |
| M2 P1 六泳道 | R4+R5+Rx | Agent/Workflow 是关键路径；函数/耐久单元页已调 Cloud，不标预览 |
| M3 P2 供给 | R7 | 必须以 Cloud digest 为准，禁止纯 mock 晋级当真 |
| M4 P3 运行 | **提前为 R2** | 运行平面优先于泳道堆砌 |
| M5 P4 运营/商业 | R6 Usage + R8 | Audit 跟 Cloud；OEM 后置 |

屏幕级验收仍用各 `prd/0x-*.md`；**何时开工**以本表波次为准。

---

## 5. 工程轨道（并行但不乱序）

| 轨道 | 内容 | 约束 |
| --- | --- | --- |
| **A · Console** | 去 mock、双 baseURL（a3s-api + a3s-cloud）、预览态组件 | 平台域禁止只打 a3s-api |
| **B · a3s-api** | 通讯录/Member/config；过渡供给退出 | BOUNDARIES 准入检查清单 |
| **C · a3s 消费** | OpenAPI 客户端、幂等键、作用域头 | 不 fork Cloud 聚合 |
| **D · 文档/IA** | 侧栏与波次同步；预览叶子文案 | 不把 Rx 画成当前 EXIT |

---

## 6. 每波次通用验收清单

- [ ] 所有者符合 CONTROL-PLANE-BOUNDARY（无新第二权威）  
- [ ] 管理面调用目标正确（扩展→a3s-api；平台→a3s-cloud）  
- [ ] 无静默 mock 充当生产真相  
- [ ] 危险变更可关联 Audit/Operation（接 Cloud 后）  
- [ ] 不引入 Token Hub / 钱包 / 地理代理  
- [ ] 若依赖 a3s 闸门：仅引用 ROADMAP 状态，不发明 Verified  

---

## 7. 文档权威序（交付主题）

| 序 | 文档 |
| --- | --- |
| 1 | [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md) |
| 2 | **本文**（波次与 EXIT） |
| 3 | [ARCHITECTURE.md](./ARCHITECTURE.md) · [PRINCIPLES.md](./PRINCIPLES.md) |
| 4 | [prd/00-master.md](./prd/00-master.md) + 分册（屏幕规格） |
| 5 | a3s `ROADMAP.md`（上游闸门只读） |

修订规则：调整波次依赖或把 Rx 升入关键路径时，必须同步改本文与 CONTROL-PLANE-BOUNDARY（若涉及所有权）。
