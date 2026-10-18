# 按钮级线框 — P0 租户 · 身份 · 凭证 · 审计

## Organizations

```text
#O01  [新建 Project]  ·primary
      → 打开 Wizard
      enable: workspace.admin
      disable: 无权限 → 隐藏

#O02  [树节点 Org/Project/Env]  ·ghost
      → 选中；Env 同步 ScopeSwitcher #S05
#O03  [打开工作台]  ·row → 切到 Overview 且 Env=该环境
#O04  [编辑配额]  ·secondary → Drawer；保存 #O05
#O05  [保存配额]  ·primary
      → POST；loading「保存中」；成功 Toast + Audit
      confirm: 降低配额且 used>new 时 Modal「将阻止新任务」
#O06  [归档组织]  ·danger
      confirm: 输入 Org 名 · primary=危险「归档」
```

## Users List

```text
#US01 [导出]  ·secondary → 建 Operation；Toast 含「查看」链到 Ops
#US02 [邀请用户] ·primary → InviteWizard
#US03 [搜索 input] ·field → debounce 200ms 过滤
#US04 [全部|活跃|已邀请|已禁用] ·chip 互斥 → 过滤
#US05 [编辑] ·row → UserDetail
#US06 [更多 ▾] ·row → 菜单：
        #US06a 重新邀请 · enable: status=invited
        #US06b 禁用 ·danger · confirm「禁用后立即失效」
        #US06c 启用 · enable: status=disabled
```

## Invite Wizard

```text
#IW1  [下一步] ·primary · enable: 邮箱合法
#IW2  [上一步] ·ghost
#IW3  [取消] ·ghost → 关；有脏数据 confirm「放弃邀请？」
#IW4  [发送邀请] ·primary · loading「发送中」
      → 成功页 #IW5
#IW5  [查看审计] ·secondary → Audit 过滤 invitation id
#IW6  [完成] ·primary → 关向导回列表
```

## User Detail

```text
#UD01 [← 返回] ·ghost → /users
#UD02 [禁用]/[启用] ·danger/secondary 互斥按状态
#UD03 [编辑角色] ·secondary → 角色多选 Drawer
#UD04 Tabs [概览|成员关系|凭证|审计] ·tab
#UD05 [保存角色] ·primary · confirm 若移除最后 Org Admin
```

## Permissions

```text
#P01 [审计日志] ·secondary → /audit?source=permissions
#P02 [新建角色] ·primary → RoleCreate
#P03 [角色|权限] ·tab
#P04 [搜索] ·field
#P05 作用域 chips ·chip（权限 Tab）
#P06 [编辑] ·row → RoleDetail
#P07 [权限矩阵] ·row → Matrix
#P08 Matrix [取消] ·ghost → 丢弃
#P09 Matrix [保存] ·primary · loading
      enable: 有 diff；系统强制格不可点
#P10 [删除角色] ·danger · enable: kind=custom && members=0
      confirm: 输入角色名
```

## Credentials & Secrets

```text
#K01 [API Keys|Secrets] ·tab
#K02 [创建密钥] ·primary → 创建表单
#K03 [创建] ·primary · loading
#K04 [复制] ·secondary（一次性明文 Modal）
#K05 [我已保存] ·primary → 关 Modal；明文销毁
#K06 [吊销] ·danger · confirm「吊销后不可恢复」
#K07 [轮转 Secret] ·secondary → 新版本；旧版 deprecated
#K08 [复制前缀] ·ghost · 仅前缀非全文
```

## Audit & Ops

```text
#AU01 [导出] ·secondary → Operation
#AU02 筛选控件 ·field/chip
#AU03 行点击 → Detail Drawer
#AU04 [打开 Operation] ·row → /ops/:id
#OP01 [取消任务] ·danger · enable: cancellable
      confirm: 「取消后不可恢复进度」
#OP02 [重试] ·secondary · enable: failed && retryable
```
