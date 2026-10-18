# Kense OS — 平台服务运营差距分析

| 字段 | 值 |
| --- | --- |
| 地位 | 架构附录（服从 [ARCHITECTURE.md](./ARCHITECTURE.md)） |
| 问题 | OS **自营/运营**下列服务时，相对第一性原理与业界参照还缺什么 |
| 范围 | (1) Work 依赖：模型网关 · 联网检索 · 文档解析 (2) 类 AIsa 能力市场 (3) 类 World Monitor 方案 API |
| 非范围 | 把 Work UI、Monitor 地图/情报业务、AIsa 数据转售中介做成 OS 内核 |

---

## 0. 第一性与分层（先钉死）

```text
Kense Work（一等客户端）
其它智能体 / IDE / SDK（同契约）
        │  只持 Capability Key · 调契约
        ▼
Kense OS（本分析主体）
  Gateway + Inference + Marketplace + Functions/Fleet + Usage/Audit
        │
        ├─ 一等平台 Listing（A3S-hosted：search / parse / model…）
        └─ 方案 Provider（Monitor API 等）──► 仍是 Listing，不是 OS 业务模块
```

| 原则 | 含义 |
| --- | --- |
| **OS 运营 ≠ OS 实现业务 UI** | 运营面在 Console（市场/推理/用量/机群）；Work 是消费者 |
| **一切昂贵调用过 Gateway** | 模型、检索、解析、方案 API 同一咽喉：鉴权·限额·标价·归因 |
| **可替换后端** | 检索/解析可换 Provider；契约（SKU、schema、envelope）稳定 |
| **方案 API 是 Provider** | Monitor 类产品提供数据面；OS 提供登记、开通、计量、信任 |
| **不做第二壳** | 无 Token Hub / 钱包；showback + 硬顶即可 |

**对照现状：** 推理的路由列表、部署列表和创建部署已走 Cloud。市场浏览仍是本地目录。控制面真执行（策略、护栏、一钥）、Work 绑定、一等平台 Listing、方案发布流水线多数仍缺。

---

## 1. Work 依赖的三项平台服务

Work（文档专家剖面）要「连得上、调得动、算得清、封得住」。三项都应为 **Marketplace Listing + Gateway 执行**，而不是 Settings 里的孤岛开关（今日 `settings.webSearch` 仅桌面偏好占位，见 PRINCIPLES「桌面能力不进核心导航」——**运营真相应在能力面，不在设置页**）。

### 1.1 统一模型网关

| 维度 | 业界参照（AIsa / LiteLLM 类） | OS 已有（设计） | **缺口（机制 + 运营）** | 优先级 |
| --- | --- | --- | --- | --- |
| 协议面 | OpenAI-compatible chat/embeddings | Inference 路由/策略 PRD | **对外稳定 API 版本契约**、SDK/Work 默认 baseURL 文档、流式与工具调用一致性闸门 | P0 |
| 路由 | 加权、回退、冷却 | 路由与部署列表、创建部署已接 Cloud | 策略与 **Work 剖面默认路由绑定**仍缺 | P0 |
| 密钥 | 一钥多模型 | Capability/Inference Key 设计 | Key 升格为跨 Market+Inference；**Work 注入/轮换 UX**（非第二授权引擎） | P0 |
| 限额熔断 | Key 硬顶 + 取消 in-flight | INF-Q + Flow cancel 规划 | Gateway 触顶 **联动 Run/会话取消**；Work 可读错误码 | P0 |
| 护栏 | pre/post | INF-G | 文档场景默认护栏包；payload 不落盘策略 | P1 |
| 观测 | 逐笔 token | Usage showback | Work 会话 ↔ Usage 相关 ID；诊断试探 | P1 |
| 供给 | 模型目录 | Models + Inference | 私有化权重/本地模型上架到市场 kind=model | P1 |

**机制结论：** 模型网关运营落在 **能力 → 推理** + **市场（model Listing）**；缺的是 **契约稳定、Key 一统、熔断闭环、Work 默认绑定**，不是再做一个「Work 专用网关控制台」。

### 1.2 联网检索服务

| 维度 | 业界参照 | OS 已有 | **缺口** | 优先级 |
| --- | --- | --- | --- | --- |
| 产品形态 | 检索 API / MCP tool（Exa、Perplexity…） | 市场可挂第三方 tool Listing（mock） | **A3S-hosted `search.*` 一等 Listing**（或官方 Provider 模板）+ schema | P0 |
| 运营 | 目录标价、健康、allowlist 域 | Market 浏览/开通 mock | Provider 健康探测、**域名/区域 allowlist 策略**、结果过滤策略 revision | P0 |
| 证据 | 引用链接 | envelope 规划 | 强制 `source`/`url`/`as_of`；Work 引用块契约 | P0 |
| 计量 | 按次 | Usage 设计 | kind=tool 按次 ledger；与模型 token 分列 | P0 |
| 安全 | 不训练、出站控制 | Gateway allowlist 规划 | **出站代理策略**、PII 红线、私有化「禁外网」模式 | P0 |
| 执行 | 同步/异步 | Function/Cell | 长检索用 Durable Function；超时与重试在 Gateway 非浏览器 | P1 |

**机制结论：** 检索是 **Tool Listing**，不是 Console 新导航域。Settings「联网搜索」应降级为客户端偏好，**权威开通在市场已开通**。

### 1.3 文档解析服务

| 维度 | 业界参照 | OS 已有 | **缺口** | 优先级 |
| --- | --- | --- | --- | --- |
| 产品形态 | parse PDF/Office → markdown/结构 | 无独立 PRD | **`parse.document` Listing**（同步+异步 job）+ MIME/大小限额 | P0 |
| 运行 | 沙箱解析 worker | Fleet/Box 概念 | **专用 Workload 画像**（CPU/内存/隔离）、队列、病毒扫描钩子 | P0 |
| 多模态 | 图/表/OCR | 无 | 可选 OCR 后端 Listing；失败可部分成功契约 | P1 |
| 隐私 | 文档不用于训练 | 声明级 | **租户数据面绑定**（对象存储前缀、TTL、删除证明） | P0 |
| 与 Work | 打开附件即解析 | 无 | Work → 上传凭证（短时）→ job id → 回调/轮询；权限=Entitlement | P0 |
| 计量 | 按页/按 MB/按次 | 无 | Quote 维度进市场标价；Usage 归因 | P0 |

**机制结论：** 解析是 **平台 Function/Cell + Market Listing**；运营看 **供给发布、机群容量、开通与用量**，不做「解析业务台」。

### 1.4 Work 横切（一把 Key）

| 不变量 | 说明 |
| --- | --- |
| **接入契约** | Gateway + 一把 Capability Key；Work 与其它智能体同契约；不要求进入各上游控制台 |
| **一钥** | 仅 `Capability Key` + Gateway `baseURL`；模型/检索/解析/方案 API 共用 |
| **开通在 Console** | 管理员在市场「已开通」增删 Listing；客户端侧能力集随之变化 |
| Connect 片段 | 一键配置 Work / 其它 Agent：baseURL、Key、默认路由提示 |
| 错误语义 | `entitlement_missing` / `spend_capped` / `upstream_degraded` / `policy_denied` |
| 审计 | 每次调用可追 Principal + Listing + Usage；同一 Key 全链路 |

---

## 2. 类 AIsa 能力市场 — 运营差距

已有：[prd/08-marketplace.md](./prd/08-marketplace.md)、Console mock（浏览 · 侧栏已开通 · 详情）。相对 AIsa「一把 Key · 目录 · 标价 · 硬顶 · 自动回退」：

### 2.1 已覆盖（设计层）

- Provider / Listing / Entitlement / Quote 概念  
- 一目录多 kind；开通与停用  
- 不做钱包（刻意）  
- 侧栏：市场 · 已开通 · 推理  

### 2.2 仍缺的功能与机制

| # | 缺口 | 机制要点 | 优先级 |
| --- | --- | --- | --- |
| M1 | **控制面权威** | Entitlement 不可变 revision、Gateway 强制集合、无 UI 假计数 | P0 |
| M2 | **Capability Key 真一统** | 一钥 = entitled ∩ grants；与 Inference Key 合并落地 | P0 |
| M3 | **调用前标价执行** | 目录展示 + 请求前 Quote 校验；超预算拒绝 | P0 |
| M4 | **硬顶熔断** | Key/Env spend cap → 拒绝 + **cancel Run** | P0 |
| M5 | **Provider 运营面** | 添加向导、同步、信任、停用级联、健康探测。向导在密钥非空时可提交，凭证留在本地，不是 Cloud 权威 | P0 |
| M6 | **适配器运行时** | OpenAPI / MCP / AIsa-proxy **真流量**；重试/回退策略在 Gateway | P0 |
| M7 | **SKU allowlist** | 防 5000+ 刷屏；镜像策略 | P1 |
| M8 | **Skill 双轨** | Listing ↔ Registry 安装联动 | P1 |
| M9 | **OEM 目录过滤** | Channels 白标可见子集 | P1 |
| M10 | **Connect 分发** | 给 Work/Claude Code 等的一键配置（非 OS 导航膨胀） | P1 |
| M11 | **结算** | 供应商对账 | **OOS**（外部商业） |

**与 AIsa 差异（战略）：** OS 市场是 **治理面**（可私有化、可 OEM）；不必自建公开 API 集市品牌，但机制上要达到「一钥、标价、硬顶、回退」。

---

## 3. 类 World Monitor 的解决方案 API — 运营差距

**边界：** Monitor（或同类）= **解决方案**；OS = 让方案 API **可发布、可开通、可计量、可溯源地被 Work/Agent 调用**。

### 3.1 方案侧应自备（不进 OS）

- 信号域、相关面、地图/Brief UI、情报方法论  
- 业务语义评分与内容运营  

### 3.2 OS 应为「方案 API」提供的平台机制

| # | 能力 | 现状 | **缺口** | 优先级 |
| --- | --- | --- | --- | --- |
| S1 | **方案 Provider 入驻** | 模板规划（WM） | 官方「Solution Provider」档案：OpenAPI/MCP 包、版本、SLA、责任联系人 | P0 |
| S2 | **Listing 批量上架** | mock 数条 | 从方案仓库 **同步工具目录**（tools/list）；JMESPath/投影支持 | P0 |
| S3 | **证据 envelope** | 文案级 | Gateway 校验可选强制：`source`/`as_of`/`confidence`；缺字段策略 | P0 |
| S4 | **只读默认** | 原则有 | Listing 标注 `mutation=forbid`；试探写操作默认拒绝 | P0 |
| S5 | **多源去抖/限流钩子** | 事件唤醒规划 | 方案事件 → OS Event ingress（可选）供 Agent 订阅唤醒——**无行业标签** | P1 |
| S6 | **发现面** | 无 | `/llms.txt`、agent bootstrap、MCP 同源 REST（方案可挂 OS Edge） | P1 |
| S7 | **租户交付** | Channels OEM | 方案 API 随 OEM 白标暴露；目录过滤 | P1 |
| S8 | **方案≠Market 壳** | 已强调 | Console **不**内嵌 Monitor 地图；深链方案控制台即可 | — |

**机制结论：** 「解决方案 API」在 OS 的完整形态是：**Solution Provider → 同步 Listings → Entitlement → Gateway → Usage**，外加 provenance 与只读护栏。缺的是 **入驻/同步/强制契约**，不是再造一个态势产品。

---

## 4. 合并优先级（运营建设序）

```text
P0 闭环（Work 能安心调）
  1. Gateway 真执行：鉴权 · Entitlement · 标价校验 · 限额 · Usage
  2. Capability Key 一统 + Work Connect 片段
  3. Inference 路由绑定文档剖面
  4. 一等 Listing：search.* · parse.document（+ worker 画像）
  5. Solution/WM Provider 同步 + envelope/只读策略
  6. Provider 运营向导（健康/信任/停用级联）

P1 强化
  护栏包 · 异步 parse/search · Skill↔Registry · OEM 目录过滤
  发现面 llms.txt · 事件订阅钩子 · 私有化禁出站模式

OOS
  钱包/开票 · 方案业务 UI · 桌面设置充当开通权威
```

---

## 5. Console 信息架构影响（防过度设计）

| 服务 | Console 落点 | 不新增 |
| --- | --- | --- |
| 模型网关 | 能力 → 推理（+ 市场 model） | 「Work 网关」导航 |
| 联网检索 / 文档解析 | 市场 Listing + 已开通；用量归因 | 「检索台」「解析台」业务页 |
| 能力市场 | 已有市场/已开通 | Token Hub |
| 方案 API | Provider=解决方案；深链方案控制台 | Monitor 嵌进 OS |

修订 PRINCIPLES：桌面 Settings 中的联网/文献仅为 **客户端偏好**；**开通与配额权威在 Marketplace / Inference**。

---

## 6. 验收问题（用于判断「运营就绪」）

1. Work **只配置一把 Kense Key**，能否完成：补全（model）+ 检索（search）+ 附件解析（parse），且三次调用都进同一 Usage ledger？  
2. 停用某一 Listing 后，Work 是否立即收到 `entitlement_missing`，且 Audit 有 Entitlement 修订？**同 Key 下其它已开通能力仍可用？**  
3. 支出硬顶触达后，是否拒绝新调用并取消进行中的 durable Run？  
4. 登记 Monitor 类方案 API 后，工具是否自动出现在市场、带来源字段、默认可只读开通，且 **仍用同一把 Key** 调用？  
5. OEM 白标租户是否只见被允许的方案 Listing 子集？  
6. Work / 文档中是否出现「去 OpenAI / 检索商单独申请 Key」的引导？（期望：**否**）

全部为「是」才视为本附录范围内的运营机制达标。
