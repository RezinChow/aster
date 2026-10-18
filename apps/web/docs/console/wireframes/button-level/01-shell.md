# 按钮级线框 — Shell / Scope / Settings / UserMenu

## 布局（展开）

```text
┌─SIDE──────────────────┬─MAIN─────────────────────────────────────┐
│ #S01 Logo             │  (page outlet)                           │
│ #S02 收起侧栏 ≡       │                                          │
│ #S03 Org▾ #S04 Proj▾  │                                          │
│ #S05 Env▾             │                                          │
│ #S10.. 导航 NavLink   │                                          │
│ #S20 用户菜单触发     │                                          │
└───────────────────────┴──────────────────────────────────────────┘
```

## 控件表

```text
#S01  [Kense Logo 图]  ·icon
      → 导航至 /
      enable: always
      a11y: aria-label=产品名

#S02  [收起侧栏]  ·icon
      → sidebarCollapsed=true，切 Activity Bar
      enable: always
      a11y: aria-label=收起侧边栏 · Tooltip

#S03  [当前 Org ▾]  ·secondary
      → 打开 Org 下拉（含搜索）
      enable: 至少 1 个可见 Org
      disable: 加载中 / 无 Org
      a11y: aria-haspopup=listbox

#S04  [当前 Project ▾]  ·secondary
      → Project 下拉（过滤自 #S03）
      enable: Org 已选
      disable: Org 未选 → Tooltip「先选择组织」

#S05  [当前 Env ▾]  ·secondary
      → Env 下拉；变更后刷新 outlet 数据，保留 path
      enable: Project 已选
      disable: Project 未选

#S10  [导航项：概览/网关/…]  ·ghost (NavLink)
      → 路由跳转；当前项 is-current
      enable: 有对应 read 权限；否则隐藏
      a11y: aria-current=page when active
      Tooltip(折叠态): 菜单名 · 黑底白字

#S20  [👤 本地用户]  ·ghost
      → toggle UserMenu；portal + fixed
      enable: always
      a11y: aria-expanded · aria-haspopup=menu
```

## Activity Bar（折叠）

```text
#A01  [LogoMark]  ·icon → / · Tooltip=产品名
#A02  [展开侧栏]  ·icon → sidebarCollapsed=false
#A10  领域图标（顺序固定）·icon
      概览 | 身份 | 编排 | 能力 | 供给 | 运行 | 运营 | 商业
      → 同域：展开侧栏；跨域：导航 defaultDestination
      Tooltip=领域名 · 黑底白字
#A20  [👤]  ·icon → UserMenu compact · Tooltip=用户名
```

侧栏仅渲染当前领域 `OS_NAV_GROUPS` 项（见 PRINCIPLES §4 / shell.md）。

## UserMenu 层

```text
#U01  [复制用户名 ⎘]  ·icon
      → clipboard；成功 1.2s 文案「已复制」
#U02  [设置]  ·menuitem → 关菜单 + 开 SettingsDialog
#U03  [浅色]  ·chip/segment → setTheme(light) · aria-pressed
#U04  [深色]  ·chip/segment → setTheme(dark)
#U05  [中文]  ·chip/segment → setLocale(zh)
#U06  [EN]    ·chip/segment → setLocale(en)
外点 / Esc → 关闭菜单（不关已打开的 Settings）
```

## SettingsDialog

```text
#T00  [backdrop]  ·ghost → 关闭对话框
#T01  [×]  ·icon → 关闭 · aria-label=关闭设置
#T1x  [左侧导航项 系统/个性化/…]  ·ghost
      → 切换右侧 section；当前 is-active + 蓝条
#T20  [工作区路径 input]  ·field 可编辑
#T21  [选择文件夹]  ·secondary
      → 调系统目录选择（Web 无能力则 Toast「请手动输入路径」）
#T22  [插件路径 + 选择文件夹]  同 #T21
Esc / #T00 / #T01 → 关闭；未自动保存（失焦或显式保存——v1 本地 state）
```
