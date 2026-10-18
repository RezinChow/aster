# 总 PRD — Kense OS Console

| 字段 | 值 |
| --- | --- |
| 产品 | Kense OS Console（`@a3s/web`） |
| 版本 | Design target v1 |
| 对照 | A3S Cloud bounded contexts & multi-tenant IA |
| 状态 | Draft for implementation |
| 相关 | [ROADMAP.md](../ROADMAP.md)（**交付波次权威**）· [CONTROL-PLANE-BOUNDARY.md](../CONTROL-PLANE-BOUNDARY.md) · [ARCHITECTURE.md](../ARCHITECTURE.md) · [PRINCIPLES.md](../PRINCIPLES.md) · [SIDEBAR.md](../SIDEBAR.md) · [wireframes/](../wireframes/) |
| 导航权威 | `destinations.ts`（ActivityBar 实装）；P0–P4 仅为**屏幕/PRD 切片**，不是开工顺序 |

## 1. 问题与目标

**问题：** Cloud 以 API/CLI/MCP 为管理面，运营商与租户管理员缺少一致、可审计的图形化运营路径。  
**目标：** 提供作用域感知、与控制面契约对等的 Console，覆盖租户身份、产品泳道、供给发布、运行边缘与运营商业化。

**成功标准：**

1. 任一变更可在 Audit 中找到主体、作用域、前后摘要与 Operation。  
2. Org Admin 可在不接触 CLI 的情况下完成邀请、授权、查看用量。  
3. Platform Operator 可完成排水、事件分诊、有界恢复。  
4. 所有 List 页支持搜索 + 至少一类筛选 + 空态。  
5. 不引入第二真相源（无本地「权威」mock 写入路径进入生产配置）。

## 2. 范围

### In scope（v1 目标态）

按 [ROADMAP.md](../ROADMAP.md) 波次交付的 Console 能力；屏幕规格见：

- [01-p0-tenant-iam.md](./01-p0-tenant-iam.md) — R1/R3  
- [02-p1-products.md](./02-p1-products.md) — R4/R5/Rx  
- [03-p2-supply.md](./03-p2-supply.md) — R7  
- [04-p3-runtime-edge.md](./04-p3-runtime-edge.md) — **R2**  
- [05-p4-ops.md](./05-p4-ops.md) — R6/R8  
- [06-inference-usage.md](./06-inference-usage.md) — R6/R6b  
- [08-marketplace.md](./08-marketplace.md) — R8  
- [07-channels.md](./07-channels.md) — R8 OEM  

交互可先接 mock，但 **必须标注预览**；关键路径 EXIT 要求真 API（见路线图）。

### Out of scope

- 控制面服务端实现与真实 Provider 符合性闸门  
- Desktop / Work 客户端  
- 营销官网  
- **Token Hub** 产品壳 / API·UI 兼容层  
- **Token Plan** 充值 · 余额 · 开票 · 结算（商业权威在外部服务；Console 仅套餐/席位投影 + Usage showback）  
- 省 / 市 / 区县地理代理（渠道仅 OEM，见 [07-channels.md](./07-channels.md)）  

TokenHub-class **outcomes** 的 Console 落点见 [06-inference-usage.md](./06-inference-usage.md) 与 [PRINCIPLES §7](../PRINCIPLES.md)。

## 3. 里程碑（服从交付路线图）

**开工顺序与 EXIT** 以 [ROADMAP.md](../ROADMAP.md) 波次 **R0–R8 / Rx** 为准（运行平面 R2 优先于堆砌全部 P1 泳道）。  
下表仅保留与旧 M0–M5 的对照，**不再作为并行权威**：

| 旧 ID | 映射 | 交付意向（UI） | 验收提示 |
| --- | --- | --- | --- |
| M0 | R1 | Shell 作用域 + IA | 切换 Org 后扩展域请求带 scope；平台域未接线须标预览 |
| M1 | R1+R3 | P0 通讯录可点通 | 邀请/用户/部门走 a3s-api；Grant/Env 联邦见 R3 |
| M2 | R4+R5+Rx | P1 泳道 | 仅 Agent/Workflow 关键路径接 Cloud；函数与耐久单元页已调 Cloud，不标预览 |
| M3 | R7 | P2 供给 | 晋级/绑定认 Cloud digest，禁止纯 mock 当真 |
| M4 | **R2（提前）** | P3 Gateway/Workload/Fleet | **优先**接 a3s-cloud；去 mock 权威 |
| M5 | R6+R8 | P4 用量/通知/客户 | Usage←Cloud；OEM 投影后置 |

成功标准补充：不引入第二控制面；平台域生产路径不经 a3s-api 伪造期望态。

## 4. 全局交互规格

### 4.1 Shell

- 展开侧栏：Logo · 作用域选择器 · **当前领域**导航 · 用户菜单  
- 折叠：ActivityBar **四域**（运营 / 研发 / 平台 / 设置）+ 底部署名头像  
- 设置：弹窗（系统/个性化/关于等），不占用路由  
- Tooltip：图标导航黑底白字组件  
- IA 权威：[PRINCIPLES §4](../PRINCIPLES.md) · `destinations.ts`

### 4.2 作用域选择器

```text
[ Org ▾ ] [ Project ▾ ] [ Env ▾ ]
```

- 变更 Env 刷新当前页数据，保留路由 path。  
- 无权限的 Org 不出现在列表。  
- Platform 角色可进入「安装视图」（无租户过滤的系统页）。

### 4.3 空态 / 加载 / 错误

页面模式与密度/CTA 门禁见 [PAGE-UX.md](../PAGE-UX.md)。

| 状态 | UI |
| --- | --- |
| Loading | 表格骨架或居中 spinner，不闪空态 |
| Empty（无数据） | 插画/标题 + 主 CTA（如有权限） |
| Empty（筛选无结果） | 「没有匹配结果」+ 清除筛选 |
| Error | 横幅 + 重试；401/403 引导重新登录或申请权限 |
| Forbidden | 全页说明缺失的 permission ID |

### 4.4 表单与危险操作

- 主表单：标签在上，辅助说明一行，错误贴字段。  
- 删除/禁用：Modal 确认，需输入资源名或勾选后果。  
- ACL 编辑：保存前显示 digest/diff；失败展示校验列表。

## 5. 模块索引（屏幕清单）

ActivityBar 不是下表的行。现行轨道是运营、研发、平台、设置。下表是分册屏幕目录。

| Activity 域 | ID | 模块 | 关键屏幕 |
| --- | --- | --- | --- |
| 壳 | S0 | Shell | AppShell, ScopeSwitcher, SettingsDialog, UserMenu |
| 身份 | P0.1–5 | Org · Users · Permissions · Credentials · Audit | Tree, InviteWizard, Matrix, Secrets, Audit/Ops |
| 编排 | P1.1–4 · TASK · P1.6 | Agents · Workflows · **Tasks** · Functions · Cells · Apps | List/Detail；**统一收件箱** `/tasks` |
| 能力 | P1.5 · P1.M · P4.U | Inference · Marketplace · Usage（摘要） | 见 06 / 08；已开通 = `/marketplace/entitled` |
| 供给 | P2.1–5 | Sources · Artifacts · Pipelines · Registries · Models | 构建与晋级 |
| 运行 | P3.1–3 | Gateway · Workloads · Fleet | Edge 快照、排水 |
| 运营 | P4.1–4 | Events · Usage · Notifications · System | Showback（非钱包） |
| 商业 | P4.5 · CH | Customers · Channels (OEM) | 席位投影、白标；无地理代理 |

交叉切片：`06` Inference/Usage · `07` Channels · `08` Marketplace（挂在对应域，不另开 ActivityBar 图标）。

## 6. 无障碍与国际化

- 图标按钮必须有 `aria-label`；Tooltip 不替代可访问名称。  
- 对话框 `aria-modal` + Escape 关闭 + 焦点陷阱。  
- 文案中英键齐全；数字与时间本地化。  

## 7. 度量（产品）

- 邀请到接受转化、危险操作确认取消率、列表筛选使用率、Operation 失败后「查看详情」点击率。
