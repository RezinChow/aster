# Kense OS — Member（前台）/ User（后台）· 用户与组织

| 字段 | 值 |
| --- | --- |
| 地位 | **身份架构权威**（Identity Canon）；控制面所有权服从 [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md)；其余服从 [ARCHITECTURE.md](./ARCHITECTURE.md) · [PRINCIPLES.md](./PRINCIPLES.md) |
| 范围 | Member/User 登录平面 + **企业通讯录「用户与组织」**（部门树 · 用户挂靠 · 管理员角色） |
| 模型 | 企业组织架构：**成员与部门**；通讯录 Department / User（Employee） |
| 状态 | Design target v1 |
| 实现落点 | a3s-api `contexts/member/` · `contexts/identity/` + `apps/auth`（人的证明）+ Console `prd/01`；**资源 Grant / Project / Env 权威在 a3s-cloud** |
| 产品面 | Member：`apps/official`；User / 组织：`apps/web` Console |

---

## 0. 法定术语

| 术语 | 平面 | 含义 | 业界对照 |
| --- | --- | --- | --- |
| **Member** | **前台** | 自然人产品账户；可加入多个企业 Org | 个人产品账号（可加入多企业） |
| **User** | **后台** | **某 Org 通讯录中的人**；挂在部门下；可被授管理员角色以进 Console | 企业内 **用户 / 员工（Employee）** |
| **Org** | 后台 | 企业容器（≈ 租户）；其下有组织架构 + 资源工作空间 | **企业 / 租户** |
| **Department** | 后台 | Org 内组织架构节点；可嵌套；默认有根部门 | **部门** |
| **UserSession** / **MemberSession** | 各平面 | 人机会话，不可互换 | 管理后台登录 vs 客户端登录（概念分离） |
| **AdminRole** | 后台 | 授在 User 上的**管理后台权限包**（谁能进 Console、管哪些范围） | **管理员角色**（企业设置 → 管理员权限） |
| **Project / Environment** | 后台 | **资源工作空间**（OS 特有）；**不是**通讯录部门 | 无通讯录对等物；勿与部门混名 |

```text
Member = 前台用户
User   = 后台用户（企业通讯录中的人）
```

**禁混用：**

| 禁止 | 正确 |
| --- | --- |
| 用部门树冒充 Project/Env | 部门=人；Project/Env=资源范围 |
| 把管理员做成第二套账户类型 | 管理员 = User + AdminRole |
| 称前台账户为 User | Member |
| 无部门归属的「裸 User」作为常态 | User **必须**属于 ≥1 个 Department（主部门必填） |

---

## 1. 用户与组织（核心）

### 1.1 企业通讯录结构

```text
企业（Tenant）
└── 组织架构
    ├── 根部门
    │   └── 部门树（多级）
    │         ├── 部门负责人
    │         └── 用户（可属多部门，排序第一 = 主部门）
    ├── （可选）用户组
    └── 管理员角色 → 绑定到用户（管理后台权限 ≠ 另一套账号）
```

管理后台入口心智：**组织架构 → 成员与部门**（部门页签 + 成员页签），而不是「组织」与「用户」两套无关产品。

### 1.2 Kense 映射

```text
Installation                          ← 一次 OS 部署（私有化/托管实例）
└── Org（企业）                       ← 租户 / 企业边界
    ├── 通讯录（用户与组织）
    │   ├── Department 树（含根部门）
    │   ├── User ──挂靠── Department（多对多，primary 必有）
    │   ├── UserGroup（可选，v1.1）
    │   └── AdminRole 绑定在 User 上
    └── 资源范围（OS 特有，≠ 通讯录）
        └── Project → Environment
```

| 概念 | Kense | 说明 |
| --- | --- | --- |
| 企业 / 租户 | **Org** | 客户企业边界；Installation 下可多 Org（Managed 多租户） |
| 部门 | **Department** | 人的组织树；Console「组织」页主内容 |
| 用户 / 员工 | **User** | 通讯录实体；Console「用户」页 |
| 主部门 | `primary_department_id` | 创建 User 时必选 |
| 部门负责人 | `Department.leader_user_ids[]` | 部门 leaders |
| 管理员角色 | **AdminRole** + 管理范围 | 决定能否登录 Console、可管子树部门/资源 |
| 个人账号入企 | **Member** → 邀请/绑定 → **User** | 同一人可在多 Org 各有一个 User |
| （无通讯录对等） | **Project / Env** | 控制面资源 Scope；授权用 Grant，不替代部门 |

### 1.3 两轴：人 vs 资源（必须拆开）

| 轴 | 对象 | 用来干什么 | Console |
| --- | --- | --- | --- |
| **人（通讯录）** | Department · User · AdminRole | 谁在企业里、行政归属、谁能管后台 | 组织 + 用户 + 权限 |
| **资源（OS 特有）** | Project · Environment · Grant | 工作负载/配额/路由落在哪 | 组织页可链到工作空间；ScopeSwitcher 切 Project/Env |

**不变量：** 部门移动用户 ≠ 自动改 Project 成员；资源授权走 Grant / 角色，可**引用**部门或用户组作为主体（按部门授权），但部门本身不是 Env。

### 1.4 第一性原理（保留双登录）

| # | 原理 | 推论 |
| --- | --- | --- |
| 1 | **使用 ≠ 治理。** Member 用能力；带 AdminRole 的 User 治控制面。 | Session 分离；无 AdminRole 的 User 默认不能进 Console（可仅作通讯录/Key 主体）。 |
| 2 | **用户属于组织。** User 挂在部门下，不是漂浮账号表。 | 邀请入职必选部门；列表支持按部门筛选。 |
| 3 | **管理员是角色不是人种。** | 禁用 User 即失去 Console；撤销 AdminRole 即可降权。 |
| 4 | **Session ≠ Capability Key。** | 同前。 |
| 5 | **气隙可无 Member，不可无 User。** | 本地目录仍维护部门+用户。 |

```text
前台 Member：跨企业的自然人账户。
后台 User：某企业 Org 通讯录中的人；
         获得 AdminRole 后运营 Console。
```

---

## 2. 限界上下文

```text
 Member（前台）                         identity（后台 · 用户与组织）
┌──────────────┐     入职邀请/绑定      ┌────────────────────────────────┐
│ Member       │ ───────────────────► │ Org                            │
│ MemberSession│                      │  ├─ Department 树               │
└──────────────┘                      │  ├─ User ←── departments[]      │
       │ 持有 Key 投影                 │  ├─ AdminRole 绑定              │
       ▼                              │  ├─ Project → Env（资源）        │
    Gateway ◄──── Capability Key ──── │  └─ Grant / Credential          │
                                      └────────────────────────────────┘
                                              ▲
                                       UserSession（Console）
```

| BC | 职责 |
| --- | --- |
| **member** | 注册登录、MemberSession、我的 Key/开通投影 |
| **identity** | Org、Department、User、AdminRole。登录资格（active、`console.login`）由这里裁定 |
| **auth** (`apps/auth`) | 口令、第二因素、两种人机会话、OIDC 证明、forward-auth。不拥有目录，不写 Grant |

---

## 3. 通用语言

### 3.1 前台

| 术语 | 定义 |
| --- | --- |
| **Member** | 前台账户 AR |
| **MemberSession** | 前台会话 |
| **MyCredentialView** / **MyEntitlementView** | 对后台已签发数据的投影 |

### 3.2 后台 · 用户与组织

| 术语 | 定义 |
| --- | --- |
| **Org** | 企业；含且仅含一套通讯录根 |
| **Department** | 部门节点；`parent_id`（根的 parent 为哨兵）；可有 leaders |
| **User** | 企业内用户；`department_ids[]` + `primary_department_id`；可选 `member_id` |
| **UserGroup** | 用户组（P1）；授权主体之一 |
| **AdminRole** | 管理角色（权限集 + 管理范围：全部 / 指定部门子树） |
| **UserSession** | Console 会话；要求 User 活跃且具备至少一个允许登录 Console 的 AdminRole（或 Platform 等价物） |
| **Project / Environment** | 资源工作空间 |
| **Grant / Credential** | 资源授权与机机凭证 |
| **Principal** | 授权主体投影：`user` \| `department` \| `group` \| `service` \| `system` |

### 3.3 废弃

| 旧称 | 处理 |
| --- | --- |
| OrgMembership（模糊） | 拆成 **部门归属** + **AdminRole** + **资源 Grant** |
| EndUser / Office / MemberTeam | 作废；入企即 User |
| 用 Organization 页只表达 Project/Env | 组织页 **主轴改为部门树**；Project/Env 为同 Org 下「工作空间」分区或详情入口 |

---

## 4. 前台 Member

### 4.1 聚合

```text
Member (AR)
  ├── member_id · status · primary_email · factors[] · profile
  └── disabled ⇒ MemberSession 全失效；不自动创建任何 Org 的 User

MemberSession (AR)
  └── cookie 与 UserSession 隔离
```

### 4.2 用例

| 用例 | 说明 |
| --- | --- |
| `RegisterMember` / `AuthenticateMember` | official |
| `AcceptOrgInvite` | 入职某 Org → 创建 User + 部门挂靠（+ 可选 AdminRole） |
| `ListMyOrgs` | 我加入的企业列表（Member 视角） |
| `ListMyCredentials` | Key 投影 |

### 4.3 API / UI

`contexts/member/` · UI：`apps/official`

---

## 5. 后台 · 用户与组织（战术）

> 交互细则见 [prd/01](./prd/01-p0-tenant-iam.md)。本节定聚合与不变量。

### 5.1 聚合

```text
Org (AR)
  ├── org_id · name · status
  ├── root_department_id
  └── invariants: 必须存在根部门；删 Org 前迁空 User/资源

Department (AR)
  ├── department_id · org_id · parent_id · name · order
  ├── leader_user_ids[]
  └── 不可把节点挂到其他 Org；删部门前迁出 User

User (AR)
  ├── user_id · org_id · member_id?
  ├── status: active | invited | disabled | resigned
  ├── primary_department_id · department_ids[]  # 第一/主部门必在集合内
  ├── profile（姓名、邮箱、工号 employee_no…）
  ├── local_auth?                              # 气隙
  └── invariants:
        · primary ∈ department_ids
        · 同一 org 内 member_id 唯一（若绑定）
        · disabled/resigned ⇒ UserSession 失效；Credential 按策略吊销

AdminRole (AR)
  ├── role_id · permissions[] · scope: all | department_subtree(ids)
  └── 系统角色不可删

AdminRoleBinding
  └── user_id × role_id（谁是管理员）

Project / Environment / Grant / Credential  — 资源轴，见 prd/01 后文

UserSession (AR)
  └── 登录 Console 当且仅当 User.active 且存在允许 console.login 的 AdminRoleBinding
      （Platform 级角色同理，挂在 Installation）
```

### 5.2 Console IA（成员与部门）

| 侧栏 | 心智 | 内容 |
| --- | --- | --- |
| **组织** | 部门页签 + 组织树 | 左：Department 树；右：部门详情 / 负责人 / **下属工作空间（Project·Env）入口** |
| **用户** | 成员页签 | 列表；筛选部门；邀请；主部门；状态；是否管理员 |
| **权限** | 管理员角色 | AdminRole 定义与绑定；资源 Grant 矩阵可同域 |
| **凭证 / 审计** | （OS 扩展） | Capability Key · Audit |

推荐组织页信息架构：

```text
组织
├── [部门树]
│     └── 选中部门 → 成员摘要 · 负责人 · 子部门
└── [工作空间]（同 Org，非部门子节点冒充）
      └── Project → Env（配额、策略）
```

### 5.3 登录与授权

```text
Console 登录
  → UserSession
  → User（org 通讯录）
  → AdminRoleBinding ∩ 管理范围
  → 可管理的部门子树 / 资源 Grant
```

无 AdminRole 的普通 User：留在通讯录，可持有 Capability Key（若被签发），**不能**进 Console 运营壳。

### 5.4 与 Member 绑定

| 用例 | 说明 |
| --- | --- |
| `InviteUser` | 指定 Org、主部门、可选 AdminRole；邮件/链接由 Member 兑换 |
| `BindMember` | User.member_id 绑定 |
| `ChangeUserDepartments` | 调部门；校验主部门 |
| `ResignUser` | 离职；保留审计主体，停用登录与 Key |
| `IssueCapabilityKey` | 后台签发 |

### 5.5 API

```text
contexts/identity/
  domain: Org · Department · User · AdminRole · Project · …
  interfaces/http: /orgs · /departments · /users · …
```

---

## 6. 独立证明服务

口令哈希和两种会话只存在于 `apps/auth` 自己的库。a3s-api 在登录和每次校验时提交准入结果（主体、是否 active、User 平面是否仍有 `console.login`），并保留 `a3s_ms_` / `a3s_us_` 前缀。停用或离职使下一次校验失败。证明里只有主体、平面、组织、认证时间和认证方式，没有 AdminRole，也没有 Grant。Cloud 把该服务当作 OIDC issuer，再用现有 SubjectLink 把目录主体解析成 Principal。

---

## 7. 部署形态

| 形态 | Member | 用户与组织 |
| --- | --- | --- |
| Managed | 自助注册 | Org 通讯录；InviteUser；BindMember |
| BYOC | 可关自助 | 目录同步（IdP/HR 同步）优先 |
| 气隙 | 可关 | 本地维护 Department + User + AdminRole |

---

## 8. 安全不变量

1. MemberSession ⇄ UserSession 不可互换。  
   - HTTP：企业中心 **`/api/org`** + Bearer `a3s_ms_…`；管理后台 **`/api/admin`** + Bearer `a3s_us_…`。  
   - 服务端校验 token 前缀；错平面一律 401。  
2. 无 AdminRole 不可 Console。  
3. Capability Key 只经 Gateway。  
4. 部门权限范围裁剪列表与操作（管理范围）。  
5. Key 明文仅创建瞬间展示。

---

## 9. 与现码 / 文档

| 已有 | 调整 |
| --- | --- |
| Console「组织」偏 Project/Env | **主轴改为部门树**；工作空间降为同页分区（见 prd/01 · 线框修订） |
| Console「用户」 | 保持 = **User**；补强部门筛选与主部门 |
| ScopeSwitcher Org/Project/Env | 保留资源切换；Org 切换=切企业 |
| `prd/01` | 按本文拆「通讯录」与「工作空间」 |
| 误用 OrgMembership | → 部门归属 + AdminRole + Grant |

---

## 10. 验收（设计）

| ID | 要求 |
| --- | --- |
| F1 | 存在 Org → Department 树 → User 挂靠（主部门）的通讯录同构 |
| F2 | 管理员 = User + AdminRole，非第三账户类型 |
| F3 | Project/Env 不作为部门子类型 |
| F4 | Member=前台、User=后台，且 User 属于组织 |
| F5 | Console IA 表达「成员与部门」一体心智 |
| D1–D3 | Session / Key 分离等同前 |

---

## 11. 实现路标

| 步骤 | 状态 |
| --- | --- |
| 1. `member` 注册登录 → official / web 企业中心 | **已落地** `POST /api/org/members/register\|login`（`a3s_ms_`）· official LoginPage · web `/org/login\|register` |
| 2. Console 登录 + User 会话 + User | **已落地** 管理后台 `/admin/login` · `POST /api/admin/identity/sessions`（`a3s_us_`）。口令和会话在 `apps/auth`，目录只做准入 |
| 3. Org + 根部门 + Department CRUD | **已落地** seed + `…/departments` · OrganizationsPage 部门树 |
| 4. User 邀请（主部门）+ 列表筛选 | **已落地** `…/users` · UsersPage |
| 5. AdminRole + console.login 门禁 | **已落地** seed `super_admin`；无角色不可发 UserSession |
| 6. Project/Env 工作空间挂接 | 未做（资源轴，后续） |
| 7. Credential / Capability Key | 未做（后续） |
| 8. 气隙本地目录同步 | 未做（后续） |

演示种子：Org `官方组织` · User `admin@local` / `Admin123!`。
