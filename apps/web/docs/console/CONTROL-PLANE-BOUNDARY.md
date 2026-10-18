# Kense OS × A3S Cloud — 控制面边界（Canon）

| 字段 | 值 |
| --- | --- |
| 地位 | **权威**（Control-plane ownership canon） |
| 范围 | `a3s-cloud`（`apps/cloud`）与 `a3s-api` 的职责划分、平面模型、协作契约 |
| 对照 | [ARCHITECTURE.md](./ARCHITECTURE.md) · [IDENTITY.md](./IDENTITY.md) · [apps/cloud/docs/architecture.md](../../../cloud/docs/architecture.md) · [apps/api/docs/DDD.md](../../../api/docs/DDD.md) |
| 状态 | Decision v1（2026-09-18） |
| 冲突 | 与本文冲突时：**本文 > 旧「双控制面暗示」**；产品分层仍服从 ARCHITECTURE §0–§1 |

---

## 0. 第一性原理（裁定用）

1. **一个可变业务不变量只能有一个所有者。**  
   Org 资源授权、Route 修订、Workload 期望态、Flow journal、Inference policy、Audit 事实 — 不得在两个 API 进程里各写一份。

2. **边界保护不变量与独立演化，不是堆第二个「也能管平台」的服务。**  
   没有独立不变量的模块应成为适配器、投影或客户端，而不是平行控制面。

3. **管理面 ≠ 数据面。**  
   Console / CLI / Management MCP 提交**期望态**；Gateway 在执行点强制**已编译策略**并对昂贵调用限流/计量。二者不得揉成「唯一 HTTP 入口」。

4. **期望态与执行分离。**  
   控制面持久化意图；Fleet / Runtime / Box / Gateway 收敛；浏览器与 a3s-api **不得**实现调度、授权判定或配额权威。

5. **人对齐资源，但不冒充资源。**  
   Department / Member / 通讯录 User 是人的组织；Project / Environment 是资源 Scope。映射经显式契约，禁止部门树当 Env。

6. **业界同构（对照，非抄 API）：**  
   控制面（意图与真相）↔ 数据面（执行咽喉）分离，类似「API 平面 vs 入口平面」；平台原语与商业/通讯录扩展分离，避免把 IAM 目录产品做成第二套调度器。

7. **Agent 出站 ≠ Gateway。**  
   Google AX 式 egress / Workspace 物化 / 沙箱 suspend 由 Cloud `A1`·`AR0` + Box 拥有。跨仓**排序提示**见 [Wave H](../../../../docs/ax-inspired-agent-platform-plan.md)（非第二门禁权威）。Gateway 仅南北向入口与（未来）`AR0.6` 入站 wake 信号；**禁止**在 a3s-api 或 Gateway 建第二套 Agent 控制面。

---

## 1. 单一控制面所有者（硬裁定）

| 角色 | 进程 / 仓 | 地位 |
| --- | --- | --- |
| **OS 控制面（唯一）** | **A3S Cloud**（`apps/cloud`） | 平台原语、资源授权、编排、运行收敛、Inference 控制面、Audit/Outbox 的**权威存储与 API** |
| **Kense 扩展面** | **a3s-api**（`apps/api`） | **仅**拥有 A3S Cloud **刻意不拥有**的 Kense 增量；**禁止**复制 Agents / Workflow / Workloads / Fleet / Edge / Inference route / Audit ledger |
| **运营壳** | Kense Console（`apps/web`） | 可视化；不拥有业务真相 |
| **数据面咽喉** | Kense Gateway（由 Edge 快照驱动） | 昂贵调用执行；不接受 Console 当第二代理 |

**禁止：**

- 称 a3s-api 为「Kense 的控制面」或与 A3S Cloud「并列真相」  
- 在 a3s-api 新增与 Cloud 同名的可变权威（第二套 Org Grant、第二套 Route、第二套 Workload）  
- Console 长期以 mock 冒充运行平面权威而不标注「未接线」

**过渡期允许：**

- Console 继续调用 a3s-api 的**已裁定扩展域**（见 §3）  
- 平台域（Gateway / Fleet / Agents…）**目标**接线 A3S Cloud；未接线前 UI 必须失败闭合或明确「预览」，不得暗示双写成功

---

## 2. 两平面模型（必须写进所有架构图）

```text
┌─────────────────────────────────────────────────────────────┐
│  Management plane（管理面）                                    │
│  Console · CLI · Management MCP                               │
│       │                                                       │
│       ├─► A3S Cloud API   ← OS 期望态权威（主）              │
│       └─► a3s-api         ← 仅 §3 扩展域                     │
└─────────────────────────────────────────────────────────────┘
                              │ 编译 / 开通 / Grant
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Data plane（数据面）                                          │
│  Client (Work / IDE / Agent)                                  │
│       │  Capability Key + Gateway baseURL                     │
│       ▼                                                       │
│  Kense Gateway  ──► Inference / Tool / Market Listing / …         │
│       │ 限流 · 策略强制 · Usage 归因写入点                      │
│       └── 不代理管理面 CRUD；不解释 Flow Plan                    │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ 收敛
┌─────────────────────────────────────────────────────────────┐
│  Runtime plane                                                │
│  Workloads 期望态 → Fleet Claims → Box / Runtime · 回执         │
└─────────────────────────────────────────────────────────────┘
```

| 平面 | 谁说话 | 谁不说话 |
| --- | --- | --- |
| 管理面 | A3S Cloud（主）· a3s-api（扩展） | Gateway 不提供 Org/Deploy CRUD 权威 |
| 数据面 | Gateway | Console / a3s-api 不转发上游 body |
| 运行面 | Workloads · Fleet · Box | 产品域不直连容器/GPU API |

ARCHITECTURE §2.1 中「Gateway = 唯一入口：认证·授权·…接 Identity/Flow」的旧画法**以本节为准废止**：Gateway 是**数据面**咽喉，不是管理面唯一入口。

---

## 3. 职责对照表

### 3.1 A3S Cloud 必须拥有（IN）

| 功能域 | 拥有的真相 | 备注 |
| --- | --- | --- |
| 资源身份与授权 | Org · Principal · Membership · Resource Grant · Credential · 撤销 | 不含通讯录部门树 |
| 资源 Scope | Project · Environment | |
| 耐久编排 | Operations · Flow · WorkflowRun · HumanTask | |
| Agent 资产 | Agent / MCP / Skill 发布与执行证据 | |
| 推理控制面 | Route · 策略修订 · ACL 投影 · Usage ledger | serving 协作 PW0/Box |
| 运行收敛 | Workloads · Fleet · Edge 期望快照 | |
| 平台供给 | Sources · Artifacts · Assets（digest / 晋级） | |
| Connectors / Plugins | 执行与绑定契约 | |
| Data / S0 边界 | 命名空间与恢复契约 | |
| Audit · Outbox · Notifications | 证据与投递策略 | showback ≠ 账单 |
| **全局事件总线 · 消息队列** | NATS JetStream（`A3S_CLOUD_EVENTS` / `A3S_CLOUD_QUEUES`） | 见 [EVENT-BUS-AND-QUEUE.md](./EVENT-BUS-AND-QUEUE.md)；a3s-api `:4222` 仅 config fan-out |
| 管理面契约 | REST · CLI · Management MCP | **无** Dashboard |

延期仍属 Cloud 产品车道（不可迁到 a3s-api）：FaaS、Durable Cell、WEB0、PW0/I0 等 — 见 `apps/cloud/ROADMAP.md`。

### 3.2 a3s-api 允许拥有（扩展面 ONLY）

| 功能域 | 拥有的真相 | 与 Cloud 的关系 |
| --- | --- | --- |
| **Member（前台）** | 自然人账户 · MemberSession | 绑定到 Cloud Principal 经显式链接（未来）；不得替代 Grant |
| **企业通讯录** | Department 树 · 后台 User 挂靠 · 管理员角色目录 UX 所需读写 | **投影/主体来源**；资源授权仍以 Cloud Grant 为准 |
| **企业内部即时通讯（IM）** | Org 内会话/消息/已读游标/免打扰/置顶 · 系统号/产品号服务身份 · `/api/org/im` 实时通道 | 通讯录投影的消费方（成员资格=Org 成员）；**不拥有** Agent Runtime（Cloud `A1`/`AR0`）、外部 IM 桥接（ilink 独立）、语音视频媒体面；禁止跨租户通信 |
| **安装级配置中心** | 运营配置（非产品期望态） | 不得存放 Route/Workload/Grant 权威副本 |
| **模型目录只读/定价索引** | models.dev 类目录查询 | 可安装/可绑定的不可变产物与 Route 仍归 Cloud |
| **模型权重拉取作业（过渡）** | HF/ModelScope → 对象存储的**作业与本地索引** | 晋级为可部署制品后必须进入 Cloud Artifacts/Assets 或带 digest 准入；**禁止**长期作为「模型权威」 |
| **Git / OCI 协议适配（过渡）** | dumb/smart HTTP、Distribution `/v2` 便利面 | 与 Cloud Sources/Artifacts **digest 对齐**前不得自称平台供给权威 |
| **notes 等示范上下文** | 教学/脚手架 | 不升格为 OS 原语 |
| **成员邮箱（`mail`）** | 每个成员一个邮箱 | 不拥有 Grant、Agent Runtime、Workload、Route |
| **组织日程（`schedule`）** | 已登录成员在一个团队内的日程 | 不拥有 Grant、Agent Runtime、Workload、Route |
| **工作收件箱（`work_inbox`）** | 加入申请与审批列表 | 不拥有 Grant、Agent Runtime |
| **组织知识文件（`org_hub`）** | 用户中心知识文件（`/v1/api/org/hub/files`） | 不拥有 Grant、Agent Runtime |
| **成员工作文档（`workspace_documents`）** | Studio 作者项目、版本化 ACL 文档、不可变附件及编辑回执；项目标识仅组织作者内容 | 不建立 Cloud Project/Environment、Resource Grant、Credential、Agent Runtime 或 Workload 权威；原生插件执行仍经既有安装与租约边界 |
| **内容与安装包（`content` / `captcha` / `publication` / `app_release`）** | 文章、页面、公告、滑动验证、客户端发行包 | 不拥有 Grant、Route |
| **插件广场（`plugin`）** | 运营方发布给 Studio 的插件包 | 不拥有 Cloud 插件执行权威 |
| **成员记忆（`tobot_memory`）** | 每个成员会话一个 ToBot 长期记忆库 | 不拥有 Cloud Agent 记忆权威 |
| **组织模型供应（`model_service`）** | 供应商别名与已发布成员目录 | 不修订 Cloud 推理 Route |
| **仓库 CI 索引（`pipelines`）** | 工作流与运行记录，供控制台列出 | 执行仍是 Cloud Function；不拥有 Cloud Flow 日志 |
| **推理部署行（`inference`，过渡）** | 当前项目与环境的部署行；生产绑定要求 Cloud `artifact_digest` | 本地行不是 Workload 期望态 |

### 3.3 明确 OUT（两侧都不要做成「第二套」）

| 功能 | 归属 |
| --- | --- |
| Console IA / Dashboard | Kense `apps/web` |
| OEM 客户 · 渠道 · 订单 · 订阅 | Kense 商业投影（可后置服务） |
| Token Hub / 钱包 / 充值 | **禁止** |
| 行业方案 UI（Monitor…） | 解决方案 |
| 浏览器内授权/配额真相 | **禁止** |
| 请求体代理 | **禁止**（仅 Gateway 数据面） |

---

## 4. 跨仓协作契约（最低集）

在实现联邦前，下列契约必须被文档与类型命名，即使代码尚未接通：

| 契约 | 方向 | 内容 |
| --- | --- | --- |
| **SubjectLink** | kense User/Member → Cloud Principal | 稳定 ID 映射；禁止用邮箱当授权键 |
| **DirectoryProjection** | Department / 组 → Grant 主体引用 | 部门移动 ≠ 自动改 Project 成员 |
| **ArtifactAdmission** | kense 拉取产物 digest → Cloud Artifact/Asset | Cloud 只认 digest + 签名策略 |
| **EntitlementCompile** |（可选）市场开通 → InferenceAccess / Route 绑定 | 编译在 Cloud；Gateway 只读快照；Console 投影见 [ENTITLEMENT-COMPILE.md](./ENTITLEMENT-COMPILE.md) |
| **Work Connect** | Work / IDE 数据面 | [WORK-CONNECT.md](./WORK-CONNECT.md)：Gateway + 一把 Capability Key |
| **Error taxonomy** | 管理面 API | 作用域缺失、无 Grant、期望态冲突与数据面 429/预算熔断分码 |

**一致性规则：**

- 跨系统不共享可写表  
- Cloud 侧变更走既有幂等 + Outbox；a3s-api 不得「先写本地再假装 Cloud 已收敛」  
- 冲突时以 Cloud 资源期望态为准；通讯录冲突以 kense 通讯录为准，但**不能**覆盖 Grant

---

## 5. 迁移与停止条件（落实用）

交付波次见 [ROADMAP.md](./ROADMAP.md)。与波次对齐的停止条件：

| 现状（a3s-api） | 目标 | 停止条件 | 波次 |
| --- | --- | --- | --- |
| identity（Org/Dept/User/角色） | 保留通讯录；资源 Grant/Credential 权威迁向或对齐 Cloud Identity | 同 Org 无双写 Grant | R1→R3 |
| model_supply / model_catalog | 目录与拉取作业可留；部署绑定只认 Cloud | Console「模型部署」只引用 Cloud 修订 ID | R7 |
| git_store / oci_registry | 协议便利或迁入 Cloud Sources/Artifacts 路径 | 无第二套「平台镜像真相」 | R7 |
| config_center | 仅安装/运营配置 | ACL 中无 Route/Workload 副本 | R1+ |
| Console → `/api` 代理 | 扩展域保留；平台域改 A3S Cloud baseURL | `destinations` 平台叶子有真实 Cloud 客户端或明确预览态 | R2 |

新增 a3s-api 上下文前检查清单：

1. 该不变量是否已在 A3S Cloud 有所有者？有 → **禁止**新建权威，只做适配/投影。  
2. 是否仅为 Console UX / 通讯录 / 商业？是 → 可放 a3s-api 或未来 commercial 服务。  
3. 是否会教 Gateway / Fleet 听第二套期望态？会 → **拒绝**。

---

## 6. 文档权威序（本主题）

| 序 | 文档 |
| --- | --- |
| 1 | **本文**（控制面所有权与平面） |
| 2 | [ROADMAP.md](./ROADMAP.md)（交付波次与 EXIT；含 R4b） |
| 3 | [ARCHITECTURE.md](./ARCHITECTURE.md)（产品分层与 Console 功能架构） |
| 4 | [IDENTITY.md](./IDENTITY.md)（Member/User/Department） |
| 5 | [apps/api/docs/DDD.md](../../../api/docs/DDD.md) + [BOUNDARIES.md](../../../api/docs/BOUNDARIES.md)（api 内战术 + 扩展面清单） |
| 6 | `apps/cloud/docs/architecture.md` + `apps/cloud/docs/a3s-os-boundary.md`（Cloud 侧对偶声明） |
| 7 | [ax-inspired-agent-platform-plan.md](../../../../docs/ax-inspired-agent-platform-plan.md)（AX 借鉴跨仓排序草案；**服从** Cloud 门禁与本文，不改所有权） |

Console 导航实现仍以 `apps/web/src/shell/destinations.ts` 为准；**不得**用导航域切割覆盖本文的所有权裁定。交付顺序以 ROADMAP 为准，不以侧栏叶子数量为准。
