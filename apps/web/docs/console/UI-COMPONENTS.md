# Console 常用 UI 组件规划

> **地位：** 管理后台常用 UI 组件分层 · 库存 · 采用波次 · 反目标；冲突时以 [ARCHITECTURE.md](./ARCHITECTURE.md) + [PRINCIPLES.md](./PRINCIPLES.md) 为准。  
> **页面怎么拼：** [PAGE-UX.md](./PAGE-UX.md)（模式解剖 · DESIGN 绑定 · 新页门禁）；本文只管组件库存与采用债。  
> **实现现状证据：** `packages/ui/src/index.ts` · `apps/web/src/pages/*Page.tsx` · `apps/web/src/components` · `apps/web/src/shell`（截至本文修订）。  
> **交付边界：** 本文是规划与取舍；库内 P0–P2 已建成。下一优先是 **采用**，不是再堆控件。身份域细表见 §9。

## 1. 第一性原理（先问「为什么需要组件」）

Console **不是**业务真相源，是控制面 API 的人机壳（PRINCIPLES §1）。组件存在的唯一理由是：

| 原则 | 含义 | 对组件库的约束 |
| --- | --- | --- |
| **工作流对齐** | 操作者重复走「列表 → 详情 → 变更 → 证据」 | 优先覆盖 List / Detail / Editor / Matrix / Timeline / Wizard；不为每个 Activity 域造专用壳 |
| **一屏一事 · 主 CTA 唯一** | PRINCIPLES UX §6 | 页面骨架（Header / Toolbar / 分区）比装饰性 widget 更重要 |
| **状态非权威** | 不变量 #4 | 无「乐观永久本地源」；加载 / 空 / 错 / 禁 四态一等公民（prd/00 §4.3） |
| **危险可审计** | 不变量 #2–3 | Confirm / SecretReveal / Operation Toast 比华丽 Chart 优先 |
| **不复制机制** | 不变量 #5 | 不做前端重试引擎、权限判定引擎；组件只表达结果与意图 |
| **密度** | 管理表 ~40–44px | Table / Form 默认紧凑；产品详情可疏 |

**业界对标（取 outcome，不抄壳）：** AWS Console / Cloudflare / Vercel / Linear 管理面共有的是 **资源目录 + 作用域 + 破坏性确认 + 可追踪反馈**，不是 Ant Design / MUI 全量控件目录。

**DESIGN.md 色彩（Console 绑定）：** CTA 仅黑（`--color-primary`）；蓝仅 `--color-text-link`（`Button variant="link"` / 正文链）；`accent` ≡ `primary`。圆角 CTA `8px`、卡片 `12px`；Badge 用 pill。

## 2. 分层与放置

```text
L0  Design tokens / cn          → packages/ui（已有）
L1  Primitives（无业务语义）    → packages/ui
L2  Patterns（对齐六模式）      → packages/ui；首消费者可暂 apps/web，第 2 个无关页出现即晋升
L3  Shell-only（导航/作用域）   → apps/web/src/shell（勿进 ui）
L4  Domain composites（图表等） → apps/web/src/components（按域，勿过早抽象）
```

| 规则 | 含义 |
| --- | --- |
| **晋升** | ≥2–3 个互不相关页面复制粘贴，或已写入 PRINCIPLES §5 / prd/00 空态·危险操作表 → 升 L1/L2 |
| **拒绝** | 单页图表、单域一次性布局、第三方 Provider 品牌块、Overview KPI 装饰 → 留 L4 或页内 |
| **Identity L2** | PersonCell · InviteWizard · RoleCard 等已在库；再增身份专用件仍走同一门槛 |

## 3. 由页面模式推导的组件需求

| 页面模式（PRINCIPLES §5） | 必需组件能力 | 库内主要落点 |
| --- | --- | --- |
| **List** | PageHeader · Toolbar（Search/Filter/唯一 Primary）· Stat · DataTable · Empty（无数据 / 无匹配）· Row actions · Pagination | ListToolbar · FilterChip · DataTable · EmptyState · Stat |
| **Detail** | 标题元数据 · Tabs · 属性侧栏 · Status · Danger zone | ResourceMetaHeader · Tabs · DescriptionList · Drawer · DangerZone · Badge |
| **Editor** | FormField · Select/Combobox · Code/Diff · 校验摘要 · Submit → Operation 反馈 | FormField · Combobox · CodeBlock · DiffViewer · Toast(`operationId`) |
| **Matrix** | 可滚动网格 · 只读/编辑 · 批量条 | PermissionMatrix · CheckboxGroup |
| **Timeline** | 事件行 · 级别筛选 · 资源深链 | Timeline |
| **Wizard** | Steps · 可回退 · 结束页证据 ID | WizardShell · InviteWizard |
| **横切（prd/00 §4）** | Scope · Loading/Skeleton · ErrorBanner · Forbidden · Confirm · Toast | ScopeSwitcher(L3) · Skeleton · ErrorBanner · ForbiddenPage · ConfirmDialog · Toast |

## 4. 现状盘点

### 4.1 库内库存 — `@a3s/ui`

| 批次 | 组件 | 状态 |
| --- | --- | --- |
| 原有 | Button · Input · Textarea · Badge · Card · PageHeader · SectionHeader · Stat · Table · SearchSelect · Calendar · DateRangePicker · PageLoading · Logo · RingProgress · Reveal · ConfettiBurst | 库完成 |
| **Wave A / P0** | Dialog · ConfirmDialog · FormField · Select/NativeSelect · Checkbox · Switch · EmptyState · FilterChip · ListToolbar · Toast/InlineBanner · ErrorBanner · ForbiddenPage · DataTable · SecretReveal · CopyButton | **库完成**；全站 List 采用未齐 |
| **Wave B / P1** | Tabs · DescriptionList/KeyValue · Drawer · Pagination/CursorPager · Steps/WizardShell · Timeline · PermissionMatrix · Tree · DropdownMenu · Skeleton · Alert · DangerZone | **库完成**；Detail/Timeline/Dropdown 采用未齐 |
| **Wave C / P2** | Combobox · MultiSelect · DateTimePicker · CodeBlock · DiffViewer · FileDropzone · VirtualizedTable · CommandPalette | **库完成**；Editor 证据链采用未齐 |
| **Identity L2** | PersonCell · IdentityStatusBadge · RoleChipList · DirectorySplit · ResourceMetaHeader · CheckboxGroup · OrgMark · TreeSearchPanel · RoleCard · InviteWizard | **库完成**；身份页采用见 §9 |

**测试：** `packages/ui` → `bun test`（happy-dom + Testing Library）。

### 4.2 壳与 L3 / L4 — `apps/web`

| 位置 | 组件 | 状态 |
| --- | --- | --- |
| `shell/ScopeSwitcher.tsx` | 仅组织下拉 | L3；Project / Environment 未渲染 |
| `AdminPageShell` | → `PageHeader` | 委托 `@a3s/ui` |
| `NeedSessionState` | 「请先登录」 | L3；身份四页已用 |
| `components/` 图表 | ApiTrafficChart · TokenHeatmap 等 | **L4，永不升库**（除非官方站共用） |
| `lib/status.ts` | `statusTone` | 编排/运行页共用 helper；商业页仍有页内复制 |

### 4.3 页面采用矩阵（页面证据，非愿望）

行名是页面族，不是 ActivityBar 域名。现行轨道是运营、研发、平台、设置。

| Activity 域 | List 采用（证据页） | Detail / 其它 | 主要反模式（现状） |
| --- | --- | --- | --- |
| **壳** | — | ScopeSwitcher · Settings | — |
| **概览** | Overview 模块化 KPI（L4 图表） | — | 图表留 L4；勿升 `@a3s/ui` |
| **身份** | Orgs · Users · AccessControl：DataTable / RoleCard / InviteWizard | Orgs Directory · Login OrgMark | 产品延后见 §9.2 |
| **编排** | `FlowsPage`：ListToolbar · DataTable · EmptyState | `FlowDetailPage`：ResourceMetaHeader · Tabs · Timeline | — |
| **能力** | `MarketplacePage`：ListToolbar · MetaSummary · FilterChip · SearchSelect · EmptyState | Listing：ResourceMetaHeader · DescriptionList · ConfirmDialog；Entitled：DataTable | Inference：诚实 EmptyState（无假绿） |
| **供给** | `ModelsPage` · `SourcesPage`：ListToolbar · DataTable · EmptyState | Models Drawer | — |
| **运行** | Gateway · Fleet：ListToolbar · DataTable · EmptyState · MetaSummary | — | Workloads 路由重定向到网关，没有列表页 |
| **运营** | `EventsPage`：ListToolbar · FilterChip · **Timeline** · EmptyState | — | — |
| **商业** | Channels · Customers：ListToolbar · DataTable · FilterChip count | Channel Detail：Tabs · ResourceMetaHeader · DataTable · ConfirmDialog；Create：WizardShell | — |
| **占位目的地** | `PlaceholderPage`：AdminPageShell · EmptyState | — | 产品面未接通；UI 不再像坏页 |

## 5. 常用清单与优先级（重定义）

库内 P0–P2 **建设完成**。优先级改为 **采用波次**；仅当 §5.1 候选满足晋升门槛才新建件。

### 5.0 已建成（按模式索引）

| 模式 | 库完成件 | 采用状态 |
| --- | --- | --- |
| List | ListToolbar · FilterChip · DataTable · EmptyState · Stat · Pagination | 上表页面族的 List 主路径已齐 |
| Detail | ResourceMetaHeader · Tabs · DescriptionList · Drawer · DangerZone · Badge | Orgs · Flow · Channel · Market Listing · User Drawer |
| Editor | FormField · Select · Combobox · CodeBlock · DiffViewer · Toast(`operationId`) | Settings · 表单页；Secret/Diff/Operation 链仍稀缺 |
| Matrix | PermissionMatrix · CheckboxGroup | Roles 编辑用 CheckboxGroup；整页 Matrix 产品延后 |
| Timeline | Timeline | **Events · Flow journal** 已采用 |
| Wizard | WizardShell · InviteWizard | ChannelCreate · Users 邀请 |
| Overview | PageHeader · FilterChip · SearchSelect · L4 图表 | Home/Platform：**首屏 ≤4 模块**，其余进 `os-overview__below` |
| 横切 | ConfirmDialog · ErrorBanner · ForbiddenPage · Skeleton · ScopeSwitcher | Confirm/ErrorBanner 已铺开；Forbidden 仍按路由 |

### 5.1 Wave D — List 标准化采用（最高优先 · **零新组件**）

**采用件：** `ListToolbar` · `FilterChip` · `DataTable` · `EmptyState`（`no-data` / `no-match`）· `ErrorBanner` · `Stat` · 行操作 `ConfirmDialog` 或 `DropdownMenu`。

**目标页：**

| 页 | 路径证据 |
| --- | --- |
| Channels | `apps/web/src/pages/ChannelsPage.tsx` |
| Customers | `apps/web/src/pages/CustomersPage.tsx` |
| Marketplace / Entitled | `MarketplacePage.tsx` · `MarketplaceEntitledPage.tsx` |
| Flows | `FlowsPage.tsx` |
| Gateway · Fleet · Workloads | `GatewayPage.tsx` · `FleetPage.tsx` · `WorkloadsPage.tsx` |
| Events | `EventsPage.tsx`（表结构可先 DataTable；语义时间线见 Wave F） |

**验收：** 上述页不再依赖手写 `<Table>` 做资源目录；筛选空 ≠ 无数据空；错误可重试。

### 5.2 Wave E — Detail 闭环采用

**采用件：** `ResourceMetaHeader` · `Tabs` · `DescriptionList` · `Drawer`（轻量）· `DangerZone` · 状态 `Badge` / `IdentityStatusBadge` 模式。

**目标页：** `ChannelDetailPage` · `FlowDetailPage`；未来 Agents / Inference Detail（对齐 [wireframes/p1-products.md](./wireframes/p1-products.md) `[概览|修订|执行|访问]`）。

**验收：** Detail 有唯一主 CTA 区、属性可读、破坏性进 DangerZone/Confirm；不另造域专用 PageLayout。

### 5.3 Wave F — Editor / 证据 / 时间线采用

**采用件：** `SecretReveal` · `CopyButton` · Toast `operationId` · `CodeBlock` / `DiffViewer` · `Timeline` · `WizardShell`（已有 ChannelCreate）· `PermissionMatrix`（RBAC 页内挂载，产品时机）。

**目标：** Inference 密钥/策略、ACL 保存前 digest、Events/Audit/Run 时间线、变更成功反馈可跳转 Ops。

**验收：** 明文密钥不常驻；失败不本地假成功；事件流用 Timeline 而非再造竖表样式。

### 5.4 建议新增（仅候选 · 门槛严格）

第二无关消费者出现才晋升 `@a3s/ui`；否则页内或 `apps/web/lib`。

| 候选 | 证据 | 层级 | 不做则 |
| --- | --- | --- | --- |
| **ResourceStatusBadge** | `statusTone`：`lib/status.ts`（Flows/Fleet/Workloads）+ Channels/Customers 页内复制 | L2 | 先收敛到 `lib/status.ts` + `Badge` |
| **ResourceIdChip** | 线框资源 ID · Toast Operation 链 · 可复制 | L1 | `CopyButton` + mono 文本 |
| **RelativeTime** | W-P1 List「2m 前」等多处 | L1 | `Intl.RelativeTimeFormat` 页内 helper |
| **BulkActionBar** | Matrix / 多选 List（prd 批量） | L2 | ListToolbar 槽位临时按钮 |
| **ValidationSummary** | Editor ACL 校验列表（prd/00 §4.4） | L2 | `Alert` 列表 |
| **EditorSplit** | PRINCIPLES Editor 双栏 | L2 | 页内 CSS grid |

**永不升库：** Overview / 平台仪表盘 Chart · Heatmap · 词云等 L4。

## 6. 不做什么（防膨胀）

1. **不**引入第二套完整 UI 框架（Ant/MUI）覆盖全站——与现有 token/密度冲突。  
2. **不**为每个 Activity 域做 `XxxPageLayout`；统一 List/Detail 骨架（`AdminPageShell` + 模式件）即可。  
3. **不**把 Chart / Heatmap / 排行榜升进 `@a3s/ui`，除非官方站与 Console 共用。  
4. **不**在组件内实现授权判定或重试队列（不变量 #5）。  
5. **不**用 keep-alive 当数据权威；加载组件仍服务**冷**进入，暖恢复跳过过渡 loading。  
6. **不**做 TokenHub / 钱包 / 结算台专用控件壳（PRINCIPLES §7–8）。  
7. **不**在库已齐时优先「再造一波 P0 控件」——先 Wave D/E/F 采用。

## 7. 建议落地顺序

```text
Wave A–C（库内 P0–P2）     ✅ 已完成 — §4.1
Identity L2 + 身份页采用   ✅ 组件侧完成 — §9（产品延后与库脱钩）

Wave D  List 标准化采用    ← 当前最高优先（零新组件）
Wave E  Detail 闭环采用
Wave F  Editor / 证据 / Timeline 采用

候选 L2（§5.4）            仅当复制证据满足晋升门槛
```

实现 PR 以 Wave 为单位，并回写 §4.3 采用矩阵，避免清单与代码漂移。

## 8. 验收（本规划本身）

| 检查项 | 证据 |
| --- | --- |
| 推导自 PRINCIPLES §5 六模式 + prd/00 §4 空态/危险操作 | 本文 §1、§3 |
| 页面采用矩阵有页面文件证据 | 本文 §4.3 |
| 优先级 = 采用波次（D→E→F），非再列「立刻该有」库清单 | 本文 §5 |
| 候选新增有晋升门槛与「不做则」 | 本文 §5.4 |
| 反目标清晰 | 本文 §6 |
| 放置规则清晰（ui vs shell vs 页） | 本文 §2 |
| 身份域有独立附录且状态与代码一致 | 本文 §9 |

## 9. Identity pages component plan（附录）

> **范围：** Organizations · Users · Roles · Permissions · Login。  
> **Canon：** [IDENTITY.md](./IDENTITY.md) §5.2 · `prd/01` · `wireframes/p0-tenant-iam.md`。  
> **定位：** 身份 **directory · membership · RBAC** 采用矩阵；不替代 §5 全站波次。  
> **状态：** 规划组件抽取与页采用 **已完成**；下表「产品延后」不阻塞 Wave D。

### 9.1 第一性原理 → 三轴 UI

| 轴 | 对象 | Console 模式 | 主 UI |
| --- | --- | --- | --- |
| **Directory（人）** | Org · Department 树 · User 挂靠 | Master–Detail | DirectorySplit · Tree · TreeSearchPanel · 成员 DataTable |
| **Membership** | 邀请 · 主部门 · 状态 · AdminRole 绑定 | List + Wizard | ListToolbar · InviteWizard · PersonCell · IdentityStatusBadge |
| **RBAC** | AdminRole · 权限目录 · 矩阵 | Cards + List | RoleCard · CheckboxGroup · PermissionMatrix（页内挂载延后）· 深链 Permissions |

**不变量（组件层）：** 部门 ≠ Project/Env；组件不判权、不做重试引擎；筛选空态 ≠ 无数据空态；破坏性操作走 ConfirmDialog / DangerZone。

### 9.2 页面 × 组件矩阵

| 页面 | 已采用 | 抽取 / 新增 | 产品延后（非组件库） |
| --- | --- | --- | --- |
| **Organizations** | DirectorySplit · TreeSearchPanel · ResourceMetaHeader · MetaSummary · NavLinkList · DetailSection · Tabs · DataTable · PersonCell · IdentityStatusBadge · RoleChipList · DangerZone · ConfirmDialog · DropdownMenu · NeedSessionState · Toast | — | 部门负责人编辑（O2）· 工作空间列表（O3，Tab 占位已有）；规划见 [ORG-PAGE-UX.md](./ORG-PAGE-UX.md) |
| **Users** | ListToolbar · SearchSelect · FilterChip · DataTable · InviteWizard · Drawer+Tabs · ConfirmDialog · PersonCell · RoleChipList · IdentityStatusBadge · DropdownMenu · Toast · NeedSessionState | — | 批量改部门 · 活动时间线权威源 |
| **Roles + Permissions** | **AccessControlPage**（角色优先 · 系统/自定义分区 · 分组 Role Builder · 只读目录 · 真 PermissionMatrix 审计）· MetaSummary · RoleCard · ListToolbar · DataTable · Dialog · CheckboxGroup · ConfirmDialog · 用户页绑定深链 | — | 角色绑定成员数 · 管理范围（部门子树）· 可写矩阵批量编辑 |
| **Login** | Logo · OrgMark · FormField · SearchSelect · ErrorBanner · Alert | — | logo_url 真实图 |

### 9.3 身份 L2 清单（均已在库）

| 组件 | 层级 | 状态 |
| --- | --- | --- |
| PersonCell · IdentityStatusBadge · RoleChipList · CheckboxGroup · DirectorySplit · TreeSearchPanel · RoleCard · InviteWizard · OrgMark · ResourceMetaHeader · **MetaSummary · NavLinkList · DetailSection** | L2 `@a3s/ui` | ✅ |
| NeedSessionState | L3 `apps/web` | ✅ |

### 9.4 身份域曾有反模式（组件侧已退役）

1. ~~Permissions 手写 table~~ → DataTable。  
2. ~~Roles 页内边框表单~~ → Dialog。  
3. ~~Invite 单 Dialog~~ → InviteWizard + Toast 证据。  
4. 仍属产品/IA：页内 PermissionMatrix（W-P0-6）、部门负责人编辑、工作空间 Project/Env 列表（非树）。
5. ~~Roles|Permissions 分页~~ → `AccessControlPage` Tabs + 路由同步。
6. ~~User 无 Detail~~ → Drawer + Tabs（overview / roles / activity 占位）。

### 9.5 放置规则

| 件 | 放置 |
| --- | --- |
| 上表 Identity L2 | `packages/ui` |
| NeedSessionState | `apps/web` |
| Workspace / Grant 编辑器 | L4；不阻塞目录 L2 |

### 9.6 身份验收

| 检查项 | 证据 |
| --- | --- |
| Orgs 树+详情，不把 Project 画成部门子节点 | IDENTITY §5.2 · W-P0-1 |
| Users 筛选空 ≠ 邀请空 | EmptyState 变体 |
| 系统角色不可删；自定义删前确认 | ConfirmDialog + `is_system` |
| 不引入第二套 UI 框架；组件内无鉴权引擎 | §6 · PRINCIPLES #5 |
