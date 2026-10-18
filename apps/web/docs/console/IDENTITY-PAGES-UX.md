# 身份四页 UI/UX 验收（Orgs · Users · Roles · Permissions）

> **地位：** 实现验收清单；冲突时以 [PRINCIPLES.md](./PRINCIPLES.md) · [IDENTITY.md](./IDENTITY.md) · [DESIGN.md](../../../../DESIGN.md) · [ORG-PAGE-UX.md](./ORG-PAGE-UX.md) 为准。  
> **证据页：** `OrganizationsPage.tsx` · `UsersPage.tsx` · `AccessControlPage.tsx`（`RolesPage` / `PermissionsPage` 薄包装）。

## 第一性 → 落地

| 原理 | 落地 |
| --- | --- |
| List / Directory / 一屏一事 · 主 CTA 唯一 | Orgs：页头唯一 primary「新建子部门」；Users：邀请；AccessControl：新建角色 |
| 人轴 ≠ 资源轴 | 部门树不含 Project；工作空间 Tab 占位 |
| 筛选空 ≠ 无数据空 | EmptyState `no-match` / `no-data` |
| 危险可审计 | ConfirmDialog / DangerZone；审计深链 `/events` |
| 密度 | 工具栏控件 h-8；无原生 `<select>` |

## 页验收

| 页 | 状态 | 证据 |
| --- | --- | --- |
| **Organizations** | Wave O1 完成 | DirectorySplit · ResourceMetaHeader · MetaSummary · Tabs · NavLinkList · DangerZone；Org 生命周期进 DropdownMenu |
| **Users** | 完成 | ListToolbar · SearchSelect · FilterChip · InviteWizard · Drawer Tabs · ConfirmDialog；`?department=` 双向深链 |
| **Roles \| Permissions** | W-P0-5 完成 | `AccessControlPage` Tabs 路由同步 · RoleCard · MetaSummary · 权限 DataTable · 删角色 typed Confirm |

## 明确延后（非本目标阻塞）

- 部门负责人编辑 / 移动排序（ORG O2，需 API）
- 工作空间 Project/Env 列表（ORG O3）
- 页内 PermissionMatrix（W-P0-6）· RoleCard 绑定用户数
