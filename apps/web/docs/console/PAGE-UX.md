# Console 页面 UI/UX 规范

> **地位：** 管理后台**页面级**交互与视觉规范；冲突时以 [ARCHITECTURE.md](./ARCHITECTURE.md) · [PRINCIPLES.md](./PRINCIPLES.md) 为准，视觉 token 以仓库根 [DESIGN.md](../../../../DESIGN.md) + `packages/ui/src/styles.css` 为准。  
> **分工：**  
> - 本文 = **页面模式怎么拼、密度/CTA/空错危险态怎么表现**  
> - [UI-COMPONENTS.md](./UI-COMPONENTS.md) = 组件库存与采用波次  
> - [IDENTITY-PAGES-UX.md](./IDENTITY-PAGES-UX.md) · [ORG-PAGE-UX.md](./ORG-PAGE-UX.md) = 身份域落地与组织页波次  
> **实现壳：** `AdminPageShell` → `PageHeader`；控件落 `@a3s/ui`。

---

## 1. 第一性原理（页面为什么长这样）

Console 是控制面 API 的人机壳，不是营销站，也不是第二真相源（PRINCIPLES §1–2）。

| # | 原理 | 对页面的推论 |
| --- | --- | --- |
| P1 | **任务重复 · 效率优先** | 优化第 50 次操作，不优化首屏「惊艳」；密度默认紧凑，装饰让位于扫描 |
| P2 | **列表 → 详情 → 变更 → 证据** | 每种页面模式只服务工作流中的一段；禁止一页同时当仪表盘 + CRUD + 矩阵 |
| P3 | **一屏一事 · 主 CTA 唯一** | 页头至多一个 filled primary；次要动作 outline / ghost / 菜单 |
| P4 | **状态非权威** | Loading / Empty / Error / Forbidden 一等公民；UI 缓存可丢，不可当账本 |
| P5 | **破坏可追踪** | 删除/停用进 Confirm / DangerZone；成功反馈尽量带 Operation / 审计深链 |
| P6 | **不复制机制** | 组件与页面不实现重试引擎、授权引擎；只表达 API 结果与意图 |
| P7 | **人轴 ≠ 资源轴** | Directory 树只放 Department；Project/Env 不得画成部门子节点（IDENTITY） |

**业界取 outcome（不抄壳）：** AWS Console / Cloudflare / Vercel / Linear 管理面共有的是 **资源目录 + 作用域 + 破坏确认 + 可追踪反馈 + 可扫描表密度**；不是 Ant Design 全量控件目录，也不是营销站 hero / 96px section rhythm。

---

## 2. DESIGN.md → Console 绑定（营销 vs 控制面）

[DESIGN.md](../../../../DESIGN.md) 同时描述营销站与 Console kit。**Console 只继承 token 与控件方言，不继承营销布局。**

| DESIGN 来源 | Console 采用 | Console **不**采用 |
| --- | --- | --- |
| 黑 CTA `{colors.primary}` · 蓝仅正文链 | ✅ 唯一 filled primary；`Button variant="link"` 仅链 | 蓝底按钮、紫/靛品牌色、渐变 CTA |
| Inter · JetBrains Mono | ✅ 全站；ID/密钥/权限键用 mono | 另起展示字体 |
| CTA `rounded.md` 8px · 卡片 12px · Badge pill | ✅ | CTA 做成 full pill |
| `data-table*` · `tree` · `pagination` | ✅ DataTable / Tree / Pagination | 手写 `<table>` 当资源目录（采用波次内应迁） |
| 控件高：页头 CTA 40px；工具栏/表 chrome 32px | ✅ `Button` md / sm；`SearchSelect` sm；`FilterChip` | 工具栏混用原生 `<select>` 或高低不一 |
| Hero 天空蓝渐变 · 设备合成 · 96px section | — | **禁止**出现在 Console 内容区 |
| 营销 max-width ~1200 / 多栏 feature grid | — | Console 内容区跟 shell 主栏走；仪表盘模块 ≤ 4 |

**Token 真相源：** `packages/ui/src/styles.css`（`--color-primary` = 黑；`--color-text-link` = 仅链；`--control-h` / `--control-h-sm`）。

---

## 3. 全局页面铬（所有模式共用）

### 3.1 页骨架

```text
AdminPageShell
├── PageHeader（title · description · actions）
├── [可选] MetaSummary / ResourceMetaHeader（企业条 / 资源条）
├── [可选] ErrorBanner
├── 主体（按下表模式）
└── [可选] Dialog / Drawer / ConfirmDialog
```

| 区 | 规则 |
| --- | --- |
| **PageHeader.actions** | 至多 **一个** `Button` default/primary（filled 黑）；其余 `outline` / `ghost` / `DropdownMenu` |
| **description** | 一句职责；不写操作手册 |
| **主栏间距** | `AdminPageShell` 默认 `space-y-3`（12px 节奏）；勿叠 96px 营销 section |
| **图标按钮** | 必须 `aria-label`；Tooltip 不替代名称（prd/00 §6） |

### 3.2 控件密度

| 场景 | 高度 | 组件 |
| --- | --- | --- |
| 页头主 CTA / Dialog 主提交 | 40px（`size` 默认 md） | `Button` |
| List 工具栏 · 表筛选 · 树搜索 · FilterChip | 32px（`sm`） | `ListToolbar` · `SearchSelect` · `FilterChip` · `Input` sm · `TreeSearchPanel` |
| 表行 | ~40–44px | `DataTable` |
| 详情正文 / Overview 模块 | 可疏一档 | 仍用同一 token，勿另起字号体系 |

### 3.3 颜色与语义（页面层）

| 用途 | 规则 |
| --- | --- |
| Primary CTA | 仅黑 fill |
| 次要 / 取消 | `outline` 或 `ghost` |
| 破坏 | `ConfirmDialog` tone=danger；按钮用 **error 描边**，禁止玫瑰色块 / 蓝底 |
| 选中行 / FilterChip active / Tree selected | ink @ ~8% 或 `surface-strong` — **永不** text-link 蓝 |
| 状态 | `Badge` / `IdentityStatusBadge`；颜色表达状态，不表达品牌 |

### 3.4 四态（prd/00 §4.3）

| 状态 | 必须 | 禁止 |
| --- | --- | --- |
| **Loading** | Skeleton / DataTable `loading`；形状贴近最终表 | 先闪 Empty 再出数据 |
| **Empty · 无数据** | `EmptyState` `no-data` + 可选主 CTA | 「暂无数据」无动作无解释 |
| **Empty · 无匹配** | `EmptyState` `no-match` + 清除筛选 | 与无数据共用同一文案 |
| **Error** | `ErrorBanner` + 重试 | 静默失败；把 403 画成空表 |
| **Forbidden** | `ForbiddenPage` / 明确缺 permission | 假装有数据 |

### 3.5 危险与证据（prd/00 §4.4）

| 级别 | 交互 |
| --- | --- |
| 可逆次要（重命名） | Dialog 表单 |
| 破坏（删 / 停用 / 吊销） | `ConfirmDialog`；高危要求 **输入资源名/代码** |
| 详情内破坏 | `DangerZone` 置底，不与主 CTA 并列 |
| 成功 | `Toast`；有 Operation ID 则展示并可深链 Audit/Events |
| Secret | `SecretReveal` 仅创建瞬间；关闭后永不回显 |

---

## 4. 页面模式目录

PRINCIPLES §5 六模式 + Console 已落地的 **Directory（Master–Detail）** + **Overview（仪表盘）**。选模式看**操作者任务**，不看域名字。

| 模式 | 何时用 | 典型页 |
| --- | --- | --- |
| **List** | 扁平资源目录；搜索/筛选/分页 | Users · Models · Customers |
| **Directory** | 树 + 同屏详情；反复在兄弟节点间切换 | Organizations（部门） |
| **Detail** | 单资源深读；多 Tab；权威变更在此或子路由 | Marketplace Listing · Channel · User Drawer |
| **Editor** | 策略/定义/ACL；提交前校验或 diff | 路由策略 · 权限矩阵编辑态 |
| **Matrix** | 主体 × 能力格点；只读或批量 | Permissions matrix（W-P0-6） |
| **Timeline** | 事件/审计/流水线回放 | Events · Pipeline · Audit |
| **Wizard** | 多步创建；结束页要证据 | Invite · Channel create |
| **Overview** | 安装/职责仪表盘；模块 ≤ 4 | `/` · 运营/平台仪表盘 |
| **Cards+Tabs 目录** | 同一对象的两种投影（卡片目录 + 表目录） | AccessControl（Roles \| Permissions） |

---

## 5. 模式规格

### 5.1 List（资源目录）

**解剖**

```text
PageHeader                          [次要…] [唯一 Primary]
ListToolbar  搜索 | 筛选(SearchSelect/FilterChip) | [可选批量条]
[可选 MetaSummary — 勿与 FilterChip 计数三重重复]
ErrorBanner?
DataTable | 卡片栅格
  empty → EmptyState(no-data | no-match)
行操作 → 右锚 DropdownMenu（破坏项后置）
```

**规则**

1. 默认带作用域（PRINCIPLES 不变量 #1）；Platform 全局视图须明示。  
2. 搜索 + **至少一类**筛选（prd/00 成功标准）。  
3. 行主标识左置（名/邮箱/ID）；状态用 Badge；操作右锚。  
4. 分页是导航，**禁止**黑 CTA fill（DESIGN `pagination`）。  
5. 统计优先进 FilterChip `count` 或单行 MetaSummary；**禁止**再叠三格 Stat 重复同一数字。  
6. 行点击 → Detail / Drawer；勿在行内堆多个 primary。

**组件：** `ListToolbar` · `FilterChip` · `SearchSelect` · `DataTable` · `EmptyState` · `DropdownMenu` · `Pagination`

**验收**

- [ ] 全页仅一个 filled primary  
- [ ] 筛选空 ≠ 无数据空  
- [ ] 无原生 `<select>` 作筛选器  
- [ ] 工具栏控件同高 32px  

---

### 5.2 Directory（Master–Detail）

**解剖**

```text
PageHeader                          [唯一 Primary：如新建子部门]
ResourceMetaHeader?（只读企业条 · Org 生命周期进 ⋯ 菜单）
DirectorySplit
├── TreeSearchPanel（树 · URL ?dept=）
└── Detail
    ├── ResourceMetaHeader flush + MetaSummary
    ├── [编辑][深链] outline — 不与页头抢 primary
    ├── Tabs（成员 | 子节点 | 工作空间…）
    └── DangerZone?（非根）
```

**规则**

1. 左栏选中与 URL 同步；刷新后仍选中同一节点。  
2. 未选中时详情为明确空提示，不是半残表单。  
3. 编辑进 Dialog；**禁止**详情首屏常驻重命名 Input。  
4. 树禁止混入另一轴对象（人树 ≠ Project）。  
5. 宽屏并排；窄屏可叠（保留返回列表心智）。  
6. 详情内同动作若页头已有 primary，详情侧用 outline 或去掉。

**组件：** `DirectorySplit` · `TreeSearchPanel` · `ResourceMetaHeader` · `MetaSummary` · `NavLinkList` · `DetailSection` · `Tabs` · `DangerZone`

**验收**

- [ ] 首屏一眼是「当前节点 + 主投影表/列表」  
- [ ] Org/租户生命周期不抢通讯录 primary  
- [ ] 无 Stat + DescriptionList 数字三重展示  

---

### 5.3 Detail（单资源）

**解剖**

```text
PageHeader / ResourceMetaHeader     [主 CTA：发布/保存/开通] [次要]
Tabs：Overview | Revisions | Activity | Access | …
├── Overview：DescriptionList + 摘要
├── 其它：表 / 时间线 / 授权
└── DangerZone（停用/删除）
```

**规则**

1. 标题区：名 · 状态 Badge · 关键 meta（范围/更新时间）；勿再复制一整行 Stat。  
2. Tab 只放**同一资源**的投影；不把无关全局列表塞进 Tab。  
3. 属性用 `DescriptionList`；长表用 DataTable。  
4. 从 List 进来保留返回路径（路由或 Drawer 关闭）。  
5. User 类可用 **Drawer** 作轻 Detail；重资源用整页。

**组件：** `ResourceMetaHeader` · `Tabs` · `DescriptionList` · `DangerZone` · `Drawer`

**验收**

- [ ] 主 CTA 唯一且与破坏区分离  
- [ ] Tab 不晋升为侧栏叶子（PRINCIPLES §4.1）  

---

### 5.4 Editor（策略 / 定义）

**解剖**

```text
PageHeader                          [取消 outline] [保存 primary]
双栏：表单或 CodeBlock | 校验摘要 / DiffViewer
提交 → Toast(+ operationId) 或 ErrorBanner 字段级
```

**规则**

1. 标签在上；错误贴字段（prd/00 §4.4）。  
2. ACL/策略保存前尽量展示 digest/diff。  
3. 失败展示校验列表，禁止「假成功」。  
4. 只读态与编辑态切换明确；系统强制项锁定。

**组件：** `FormField` · `Input` · `SearchSelect` · `Combobox` · `CodeBlock` · `DiffViewer` · `Toast`

---

### 5.5 Matrix（主体 × 能力）

**解剖**

```text
PageHeader                          [取消] [保存]（编辑态）
工具条：搜索主体 / 筛选能力
PermissionMatrix 或等价网格
只读默认；进入批量编辑才可改
```

**规则**

1. 行 = 主体，列 = 能力；系统强制用锁/禁用，不可静默改。  
2. 大矩阵要可横滚；表头 sticky。  
3. 与「权限目录 List」分工：Matrix 管绑定，List/Cards 管浏览。

**组件：** `PermissionMatrix` · `CheckboxGroup` · `ListToolbar`

---

### 5.6 Timeline（事件流）

**解剖**

```text
PageHeader                          [导出?]
ListToolbar：时间 · 级别 · 主体 · 资源
Timeline（非再造竖表样式）
行 → 深链资源 / Operation
```

**规则**

1. 时间倒序默认；级别用语义色，非品牌色。  
2. 运营 Events 页应优先 Timeline，而不是裸 Table 冒充事件流（UI-COMPONENTS 采用债）。  
3. 详情可用 Drawer 展 digest。

**组件：** `Timeline` · `ListToolbar` · `FilterChip` · `Drawer`

---

### 5.7 Wizard（多步创建）

**解剖**

```text
Dialog 或 整页
Steps：1…n · 可回退
末步确认摘要
成功页：证据 ID / 一次性 Secret · [完成] · 可选深链
```

**规则**

1. 每步一事；校验挡在「下一步」。  
2. 成功页是工作流终点，不是再跳空白 List。  
3. 邀请/密钥类：成功瞬间可复制，关闭后不可回显。

**组件：** `WizardShell` · `InviteWizard` · `Steps` · `SecretReveal` · `CopyButton`

---

### 5.8 Overview（仪表盘）

**解剖**

```text
PageHeader（无或弱 CTA）
≤ 4 个模块：各一 verdict / KPI + 深链权威 List
禁止首屏堆砌统计墙
```

**规则**

1. 一屏一事：每模块一个主问题（PRINCIPLES §6.1）。  
2. KPI 是**投影**；数字可点进权威页，不在仪表盘写第二账本。  
3. 图表留 L4；不升 `@a3s/ui`（UI-COMPONENTS）。  
4. 假绿禁止：无数据时显式「不可用」，不用装饰性绿点。

---

### 5.9 Cards + Tabs 目录（双投影）

用于**同一权威对象**的两种浏览方式（例：AdminRole = 角色卡片 \| 权限键表）。

**规则**

1. 共享 PageHeader / MetaSummary / 唯一 Primary。  
2. Tabs 与路由同步（`/roles` ‖ `/permissions`），避免两套状态。  
3. 切换 Tab 可清空搜索，但不要丢未保存 Dialog。  
4. 卡片栅格与表共享同一数据源；禁止两套 mock。

**组件：** `Tabs` · `RoleCard` · `MetaSummary` · `ListToolbar` · `DataTable`

---

## 6. 反模式（页面级）

| 反模式 | 为什么坏 | 正确做法 |
| --- | --- | --- |
| 页头多个 filled 黑按钮 | 破坏 P3 | 一个 primary + outline/菜单 |
| 营销天空蓝渐变 / 大 hero | 错用 DESIGN 营销层 | 白/canvas 内容区 |
| 蓝底 CTA / 紫主题 | 违反 DESIGN | 黑 CTA · 蓝仅链 |
| 原生 `<select>` 作筛选 | 密度与无障碍不一致 | `SearchSelect` |
| Stat 卡片 + DescriptionList + Meta 重复计数 | 噪音 | 单一摘要来源 |
| 筛选空 = 无数据空 | 误导 | EmptyState 变体 |
| `window.confirm` | 不可审计、无 typed confirm | `ConfirmDialog` |
| 部门树挂 Project | 破两轴 | 工作空间分区/Tab |
| 分页做成 primary 按钮 | 导航≠CTA | secondary Pagination |
| 每域造 PageShell | 碎片化 | `AdminPageShell` + 模式组合 |

---

## 7. 域 × 模式速查

| Activity 域 | 默认模式 | 备注 |
| --- | --- | --- |
| 概览 | Overview | 模块 ≤ 4；深链权威页 |
| 身份 · 组织 | Directory | 见 ORG-PAGE-UX |
| 身份 · 用户 | List + Drawer Detail + Wizard | InviteWizard |
| 身份 · 角色/权限 | Cards+Tabs | AccessControlPage |
| 编排 / 能力 / 供给 / 运行 / 商业 List | List | 采用债见 UI-COMPONENTS §4.3 |
| 运行/编排 Detail | Detail | Tabs + DangerZone |
| 运营 · 事件 | Timeline | 宜迁出裸 Table |
| 凭证创建 | Wizard + SecretReveal | — |
| 审计 | Timeline / List | 行 → Operation |

---

## 8. 无障碍与国际化（页面最低线）

- 图标-only 控件：`aria-label`  
- Dialog / Confirm：`aria-modal` · Escape · 焦点陷阱  
- Tabs：`tablist` / `tab` / `tabpanel`；Directory 树键盘 ↑↓←→  
- 中英 `MessageKey` 齐；数字 tabular；时间本地化  
- 触控：主 CTA ≥ 40px；工具栏 32px 可接受于桌面优先 Console

---

## 9. 验收清单（规范本身 + 新页门禁）

**本文完成标准**

- [x] 绑定 DESIGN.md → Console（采用 / 不采用表）  
- [x] 全局铬：CTA · 密度 · 四态 · 危险  
- [x] 覆盖 List / Directory / Detail / Editor / Matrix / Timeline / Wizard / Overview / Cards+Tabs  
- [x] 反模式与域速查  
- [x] 挂入 Console 文档权威序  

**新页 / 改版门禁（实现时勾选）**

- [ ] 选定且只选定一种主模式（可叠加 Dialog/Drawer，不混第二主模式）  
- [ ] 全页 ≤ 1 filled primary  
- [ ] 四态齐全；筛选空 ≠ 无数据空  
- [ ] 破坏路径 Confirm/DangerZone；无 `window.confirm`  
- [ ] 控件高度：工具栏 32 · 页头 CTA 40；无原生 select 筛选  
- [ ] 色：黑 CTA · 蓝仅链 · 选中非蓝底  
- [ ] 组件优先 `@a3s/ui` 模式件；不新造域 PageShell  

---

## 10. 相关文档

| 文档 | 关系 |
| --- | --- |
| [DESIGN.md](../../../../DESIGN.md) | 视觉 token / Console kit 映射 |
| [PRINCIPLES.md](./PRINCIPLES.md) | 不变量 · IA · 六模式定义 |
| [UI-COMPONENTS.md](./UI-COMPONENTS.md) | 组件分层与采用债 |
| [prd/00-master.md](./prd/00-master.md) §4 | 空态 / 危险 / Shell |
| [IDENTITY-PAGES-UX.md](./IDENTITY-PAGES-UX.md) | 身份四页验收 |
| [ORG-PAGE-UX.md](./ORG-PAGE-UX.md) | 组织 Directory 波次 |
