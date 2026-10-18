# PRD P0 — 租户范围 · 身份 · 凭证 · 审计

对齐 Cloud：`Identity`、`Organizations and Projects`、`Operations`（Audit/Idempotency/Operation）。  
**用户与组织** = 管理后台「组织架构 → 成员与部门」（部门树 + 用户挂靠 + 管理员角色）。权威叙述：[IDENTITY.md](../IDENTITY.md)。

> **术语（法定）：** **Member** = 前台；**User** = 后台（企业通讯录中的人）。  
> **Department** = 部门（人）；**Project / Environment** = 资源工作空间（OS 特有，≠ 部门）。  
> **AdminRole** = 授在 User 上的 Console 管理权限（管理员不是另一种账户）。

## 1. Organizations（用户与组织 + 工作空间）

### 1.0 两轴（通讯录 vs 工作空间）

| 轴 | 对象 | 对齐 |
| --- | --- | --- |
| **通讯录** | Org → **Department 树** → **User** | 「成员与部门」 |
| **工作空间** | Org → **Project** → **Environment** | OS 资源 Scope（非通讯录） |

组织页主轴 = **部门树**；工作空间为同 Org 下分区/入口，禁止把 Project 画成部门子节点。

### 1.1 用户故事

- 作为 Org Admin，我希望维护部门树并为用户指定主部门（入职挂靠）。  
- 作为 Org Admin，我希望在同一企业下管理 Project/Env 工作空间与配额。  
- 作为 Platform Admin，我希望创建/停用 Org（企业），并设置配额上限。

### 1.2 功能需求

| ID | 需求 | 优先级 |
| --- | --- | --- |
| ORG-D1 | 部门树：创建/重命名/移动/排序/删除（删前迁出用户） | P0 |
| ORG-D2 | 部门详情：负责人、成员数、子部门；可选同步「部门视角成员列表」 | P0 |
| ORG-D3 | 每个 Org 自动具备根部门；不可删除根部门 | P0 |
| ORG-1 | 同 Org 下浏览 Project / Environment 工作空间 | P0 |
| ORG-2 | 创建 Project / Environment（向导） | P0 |
| ORG-3 | Env 详情：配额、默认策略摘要、关联路由数 | P0 |
| ORG-4 | 删除/归档工作空间需二次确认且校验「非最后 Owner」 | P0 |
| ORG-5 | 配额编辑产生 Audit + 可选 Operation | P0 |
| ORG-6 | 创建/停用 Org（企业）；停用后 UserSession 不可登录该企业 Console | P0 |

### 1.3 验收

- 组织页能完成「建三级部门 → 邀请用户进主部门」无进入 Project 表单。  
- ScopeSwitcher 切 Project/Env 后面包屑一致；切 Org = 切企业。  
- 无管理权限时隐藏创建部门/工作空间按钮。

---

## 2. Users（用户管理 · 通讯录成员）

### 2.1 用户故事

- 邀请用户进入企业：指定**主部门**、可选额外部门、可选 AdminRole。  
- 按部门筛选成员；调整部门与主部门。  
- 禁用/离职后立即反映在会话与凭证上。

### 2.2 功能需求

| ID | 需求 | 优先级 |
| --- | --- | --- |
| USR-1 | List：搜索、状态、**部门筛选**、Stats、行操作 | P0 |
| USR-2 | Invite Wizard：邮箱/Member、**主部门**、角色（AdminRole）、可选消息 | P0 |
| USR-3 | User Detail：部门归属、AdminRole、资源 Grant 摘要、最近审计、绑定 Member | P0 |
| USR-4 | 禁用/启用/重新邀请/**离职（resigned）** | P0 |
| USR-5 | 批量改部门 / 批量选择（v1.1） | P1 |
| USR-6 | 主部门必填；department_ids 含 primary | P0 |

### 2.3 验收

- 邀请提交返回 invitation id，可在 Audit 检索。  
- 无主部门不可提交邀请。  
- 筛选无结果走「清除筛选」空态，而非「邀请用户」主空态。

---

## 3. Permissions（权限管理）

### 3.1 双平面 + 管理员角色模型

| 平面 | 内容 |
| --- | --- |
| Platform | `platform_owner` 等安装级角色 |
| Tenant · **AdminRole** | 谁能进 Console、管理哪些**部门子树**/企业设置（管理员角色 + 管理范围） |
| Tenant · 资源角色 | Org/Project/Env 上的运营角色（Admin/Operator/Developer/Viewer/Security）与资源 Grant |

### 3.2 功能需求

| ID | 需求 | 优先级 |
| --- | --- | --- |
| PERM-1 | Tabs：管理员角色 / 资源角色 / 权限目录 | P0 |
| PERM-2 | AdminRole Detail：绑定用户、权限勾选、**管理范围（全公司/部门子树）**、系统角色只读 | P0 |
| PERM-3 | Permission Matrix：角色 × 权限 | P0 |
| PERM-4 | Resource Grant 编辑（Project/Env/Node；主体可为 User / Department / Group） | P0 |
| PERM-5 | 平台角色管理（仅 Platform Owner） | P0 |
| PERM-6 | Support / break-glass 申请与审批视图 | P1 |
| PERM-7 | 无任一 Console AdminRole 的 User 不能获取 UserSession | P0 |

### 3.3 验收

- 系统角色不可删除；自定义角色删除前显示绑定用户数。  
- Matrix 保存失败时展示控制面校验错误，不本地「假成功」。  
- 管理范围外的部门在组织树对只读管理员隐藏或禁用写操作。

---

## 4. Credentials & Secrets

### 4.1 功能需求

| ID | 需求 | 优先级 |
| --- | --- | --- |
| SEC-1 | API Key 列表：名称、前缀、范围、最后使用、吊销 | P0 |
| SEC-2 | 创建 Key：一次性明文 Modal，关闭后不可再看 | P0 |
| SEC-3 | Secrets 列表：名称、版本、轮转、引用计数 | P0 |
| SEC-4 | 新版本密钥写入；旧版本标记 deprecated | P0 |
| SEC-5 | 推理 Key / MCP Credential 分类型入口 | P1 |

### 4.2 验收

- 网络响应与前端状态均不出现完整 secret（除创建瞬间受控展示）。  
- 吊销后列表状态 ≤ 2s 内更新（或 optimistic + 失败回滚）。

---

## 5. Audit & Operations

### 5.1 功能需求

| ID | 需求 | 优先级 |
| --- | --- | --- |
| AUD-1 | Audit 流：时间、主体、动作、作用域、结果 | P0 |
| AUD-2 | 筛选：动作类型、主体、资源、级别 | P0 |
| AUD-3 | Detail：请求摘要、digest、关联 Operation | P0 |
| OPS-1 | 长时 Operation 列表：进度、可取消（若 API 支持） | P0 |
| OPS-2 | 从任意提交成功 Toast 跳转 Operation | P0 |

### 5.2 验收

- 完成一次「邀请用户」后，Audit 与 Ops 均可定位到同一 correlation。
