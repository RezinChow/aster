# 工作流设计器 · 开发路线图与进度账本

| 字段 | 值 |
| --- | --- |
| 地位 | 交付计划(服从 [ROADMAP.md](./ROADMAP.md) R5 波次与 [CONTROL-PLANE-BOUNDARY.md](./CONTROL-PLANE-BOUNDARY.md)) |
| 范围 | `apps/web` 工作流设计器与 Workflows 产品面 |
| 上游闸门 | a3s `W0`(workflow-evolution-plan §4.5 已裁定 Designer 边界)· GA-2 窄路径 |
| 状态 | v1(2026-09-28);T0 全部完成,M1-α/M1-3 完成,其余按闸门排队 |

## 0. 第一性原理(裁定用)

1. 设计器是管理面:提交期望态(definition/revision),消费投影(catalog/descriptor),不执行、不拥有真相。
2. 闭环完整性定义「完成」:表达 → 校验 → 试验 → 持久化 → 发布 → 运行观测 → 治理迭代。
3. 一个不变量一个所有者:catalog/descriptor/语义 digest 归 Cloud;设计器只拥有表现层 digest(位置/分组/注释/视口)。
4. 跟闸门不跟冲动;mock 必须标注预览,失败闭合;未 Verified 能力不出 CTA。

## 1. 阶段与进度

### T0 · 编辑器诚实性与自洽(不依赖闸门)— ✅ 全部完成(2026-09-28)

| 项 | 交付 |
| --- | --- |
| T0.1 草稿保护 | embedded 模式启用 localStorage 草稿键;保存后 `clearDraft`;Surface 按 repoId 重挂载 |
| T0.2 预览标注 | 顶栏「预览 · 未接控制面」徽标;保存 toast 诚实化(`eng.flow.savedPreview`) |
| T0.3 试运行诚实化 | `WAITING_NODE_TYPES` 走查暂停(`waiting` + `pausedAt`),画布/轨迹/检查器全链路状态;历史不记暂停 run |
| T0.4 DSL 导入 | document 面板可编辑;`importPlaygroundDocument` 反解;未知类型/畸形 JSON 失败闭合 |
| T0.5 全图校验 | `validatePlaygroundGraphStructure`:no_start/multiple_starts/unreachable/dead_end/unknown_start_node;`start_node_id` 节点选择器(表现层注入 DropdownInput)+ 存在性校验 |
| T0.6 表达式编译期校验 | `steps.*` 引用编译期报 `graph.unknown_reference` |

### M1 · R5-α 观测接真 — ✅ 本仓范围完成

| 项 | 状态 |
| --- | --- |
| Workflow REST 客户端(只读 + 幂等写) | ✅ `src/lib/workflowApi.ts`;`cloudControlPath` 新增 workflow 映射(经 `tryCloudControl` 直连 `/cloud-api`,web 侧自足);线格式 snake/camel 双兼容解析器;幂等键写函数(publish/revise/start/pause/cancel/resume)已测、待发布流 UI 消费 |
| `/admin/workflows` 去 mock(WF-1/2) | ✅ FlowsPage/FlowDetailPage 经 `useOptionalCloudScope` 消费 shell 项目作用域:cloud ready → 真实 runs/详情 + journal 时间线;不可用 → 标注「预览数据」的 mock 回退,失败闭合 |
| HumanTask 收件箱(WF-3) | ⏸ 客户端就绪(`listCloudHumanTasks`);`/tasks` 统一收件箱页属 R4 波次 |
| 修订对比/操作(WF-4/5) | ⏸ 等 M2(发布流)与 W0.5 认证(操作 CTA 分期) |

### M2 · 发布流(依赖 Cloud W0.3 公开可用性)— ⏸ 排队

保存切权威(publish/revise 幂等提交,客户端已备)→ 发布 diff/确认/回滚 → 语义/表现 digest 分离落库 → 画布↔Run 互链 → pause/resume CTA 跟 W0.5。

### M3 · 步骤生态(依赖 W0.4/A1.3/MCP0.5/I0.2)— ⏸ 排队

catalog 投影驱动节点目录(零目录代码扩节点);Agent 步骤接 R4 资产;结构化 AI 编辑(revision-bound patch + 诊断 + 显式 review)。

### M4 · 运营与韧性(依赖 W0.5)— ⏸ 排队

迁移/重放完整操作面、补偿可视化、恢复证据只读投影。

## 2. 依赖事实(2026-09-28 核查)

- shell 已有 Cloud 项目作用域(`useCloudScope`/`CloudScopeContext`):`projectId`/`cloudReady`/`projectOptions` 已就位,页面经 `useOptionalCloudScope` 消费;R3 剩余工作在 Cloud 侧联邦验证。
- `/cloud/*` 经 `apiRequest → tryCloudControl` 直连 `/cloud-api`(rsbuild 代理 → :18080);workflow 路径映射已加入 `cloudControlPath`,无需 a3s-api 适配器。
- Cloud `W0` 闸门:W0.1 冻结、W0.2 Verified、W0.3 大半实现但整体 In progress and unavailable;发布流 UI(M2)在此之前保持排队。

## 3. 测试基线

- `bun test`(apps/web):T0+M1 范围全绿(flow-designer/lib/pages);`src/pages/org/hub` 存在并行工作流的 TDD 红灯,不属于本计划。
- `packages/flow/packages/ui`:`vitest run` 全绿(127,含 schema 编辑器空状态即添加动作的 4 个新用例)。

## 4. 通用验收(承 ROADMAP §6)

无第二权威 · 平台域只打 A3S Cloud · 无静默 mock · 未 Verified 不出 CTA · 仅引用闸门状态。
