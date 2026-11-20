# T2026-11-20 Studio 逐页面性能优化（进行中）

## P0 基线度量 — 完成

- 目标：生产渲染层也能显式采集逐页性能，且指标不污染默认运行。
- 改动：
  - `apps/studio/src/renderer/services/pagePerformance.ts`：`isPagePerformanceEnabled()`，dev 恒开；生产仅 `?perf=1` 或 `localStorage['aster:perf']='1'` 开启。`recordPageRender` / `startPageNavigation` / `finishPageNavigation` 全部走该门控；`clearPagePerformance()` 重置缓存。
  - 生产环境暴露 `window.__asterPagePerformance()`，供端到端验证读取逐页 commits / render / navigation 数据。
  - 测试新增生产 query flag、storage flag 两例。
- 验证：
  - `node node_modules/vitest/vitest.mjs run --project renderer src/renderer/services/__tests__/pagePerformance.test.ts` → 7/7 PASS。
  - 完整 `tsc -p tsconfig.web.json` 仍有 309 个既有错误（workInbox 等），`pagePerformance` 相关错误 0。
  - 基线数字见 `baseline.json`。
- 口径：切页 P95 <100ms；滚动掉帧 <5%；输入延迟 <30ms；导航 <300ms；空闲 10s CPU 增量 <2 核。%≠Pass。

## P1 全局骨架 — 完成

- i18n：`homeSlashCatalog.tsx` 对动态 slash 描述先 `i18n.exists(key)`，未翻译命令直接用 ACP catalog 描述，不再产生 `workbench.composer.slash.flush/dream` missing key。13/13 测试通过。
- IPC：`studioMainBridge.js` 对 `backup.get_auto_sync_state`、`skill.list_local`、`window.main.set_minimum_size`、`window.get_init_data`、`navigation.protocol_dispatch_ready` 返回惰性合法结构（`pendingNotifications: []` / `{ success: true, data: [] }` / `null`），不再落 `ROUTE_NOT_FOUND`。桥接测试 59/59 通过。
- 布局抖动：`WebviewSurface.tsx` 在写 guest/overlay plane 的 opacity、pointer-events、left/top/width/height 前比对现有值，避免无变化样式写入触发 ResizeObserver 回声。WebviewSurface 测试 4/4 通过。
- 无限动画审计：现存 20+ 处 `infinite` 动画均绑定具体状态/面板（spinner、shimmer、bot avatar、thinking dots），隐藏标签由 `Activity mode="hidden"` 清理 effect，无全局常驻动画循环；本轮不改，避免把状态指示动画一起关掉。
- 验证：`i18n-check.ts` 25266 条通过；根 `git diff --check` 仅既有 `.kstudio/skills/README.md` 尾随空格，Studio 子模块 diff check 干净。
- 限制：IPC 返回惰性数据表示当前宿主不提供这些能力，只消除启动错误噪声，不新增备份/skill 功能；release 宿主构建仍被本机 SwiftPM 沙盒阻挡。

## P2 高频页面 — 完成

- 首页星空画布 `WorkbenchStarfield.tsx`：
  - 星数上限 180 → 96（小屏下限 70 → 48），绘制上限 30 fps → 15 fps。
  - framebuffer 上限 1600×1200 → 1200×900，清屏/填充面积约 -44%。
  - 保留 reduced-motion 静态绘制、`active=false` / `document.hidden` / 设置浮层 / 窗口失焦时的暂停。
  - `WorkbenchStarfield.test.tsx` 5/5 PASS（含新节流断言：16ms 跳帧、70ms 绘制一次）。
- 星空装饰层 `aster-theme.css`：移除覆盖整层的 `mask-image`。canvas 每帧重绘会让全层 mask 被反复合成；背景 radial-gradient 本身已做透明衰减，`::before` 的静态 mask 保留。
- Trace 瀑布图 `TracePage.tsx`：默认 List 视图，改为 `React.lazy(() => import('./TraceWaterfallView'))` + `Suspense`，只有切到 Waterfall 才加载 affect 组件 barrel；`TracePage.test.tsx` 9/9 PASS（新增“初始不挂载瀑布图、切换后才加载、切回卸载”断言）。`TraceWaterfallView.test.tsx` 5/5 PASS。
- 校核：消息列表已有 `MessageVirtualList` / `chatVirtualizerRuntime` 虚拟化，不重复引入。
- 回归：`asterTheme.test.ts` 4 例中 3 通过、1 例既有失败——第 46 行期望移除 inline style 后 `--cs-theme-primary` 为空，但 `.dark` class 仍提供 `#f5f5f5`；与本次 P2 改动无关，未改该断言。

## P3 重页面 — 完成（收敛范围）

调研结论：Monaco（`WorkspaceCodeEditor.tsx` 动态导入 + `monacoCodeEditor.tsx` 完整 dispose）、PDF/PDFium（插件懒加载 + `getDocument` 时才建 worker + unmount 时 abort/destroy）、Pyodide（`PyodideService.initialize()` 仅在 `runScript()` 调用，无常驻 worker）都已有正确加载/释放逻辑；不重复优化。

- 图谱静态布局 `knowledgeGraph.ts`：`graphLayoutFrames()` 新增 `{ finalOnly: true }`，`layout()` 只取收敛后的最终帧。此前无论静态还是动画都复制并归一化全部 40 帧；静态路径现在零额外复制与归一化，最终坐标完全不变。
  - 回归：`knowledgeGraph.test.ts` 新增断言“静态帧 === 动画第 40 帧、`noteGraph` 节点坐标一致”；`knowledgeGraph.test.ts` + `KnowledgeGraphLayer.test.tsx` 共 10/10 PASS。
  - `KnowledgeGraphView.test.tsx` 2 例失败为既有问题（`getByRole('status')` 匹配到多个元素）；已临时回退布局改动复跑，失败一致，确认与本次优化无关。
- 未做（风险中，留待后续单独排期）：
  - 知识页 `KnowledgeNotesPage.tsx` 的 `visible.map` / `VaultFileTree` 全量渲染：需固定行高与滚动容器，涉及树折叠、键盘导航与 `treeScrollTop` 滚动恢复，改动面大。
  - 图谱 O(N²) 斥力步数降级与 SVG 虚拟化：会改变大图最终布局与可访问性 hit targets。
  - Pyodide 在页面卸载时 terminate：单例被多个 CodeBlockView 共享，会中断其他正在执行的代码。
  - PDFium `FPDF_DestroyLibrary()`：需处理并发工具作业与下次加载延迟。

## P4 长尾与端到端验证 — 完成

- 生产渲染层构建：`env -u NODE_OPTIONS -u BASH_ENV node node_modules/@rsbuild/core/bin/rsbuild.js build` 成功，2.84s。仅 3 处既有 `Critical dependency` 动态导入警告（`pdfToolsPdfium.ts` / `pyodide.worker.ts` / `file-type`），无新增错误。
- Studio 启动：debug 宿主 + production renderer（`STUDIO_RENDERER_DEV=0`）成功启动。日志确认 `studio-main-window focused=true visible=true`、`studio-page-load` 完成、`studio-webview-url http://127.0.0.1:4318/windows/main/index.html`；启动期仅 1 条既有 warn（`Bundled catalog resources path is not ready`）。
- HTTP 验证：`http://127.0.0.1:4318/windows/main/index.html?perf=1` → 200，1.2ms。
- 负载参考：启动后 1 分钟 loadavg `4.65`（5 分钟 `5.98`），低于 P0 基线中的 dev renderer 11–13 与 production renderer 7.63。受整机其他进程影响，仅作方向性参考，不作为指标门控结论。
- 全量回归：P0–P3 共 10 个测试文件 **112/112 PASS**。其中修正 `asterTheme.test.ts` 一处既有错误断言：移除 inline style 后 `.dark` class 仍提供变量值，应断言 `#f5f5f5` / `#111112` 而非空字符串。
- 类型检查：`tsc -p tsconfig.web.json --noEmit` 共 354 个既有错误（workInbox 等），本次改动文件 0 错。
- diff check：主仓仅既有 `.kstudio/skills/README.md` 尾随空格；Studio 子模块干净。
- 未做（明确边界）：
  - `just hermetic-perf-e2e` 是 Core/ACP/TUI 的 Rust 侧套件（50+ suites），与本次 Studio 渲染层改动无对应关系，未跑；%≠Pass。
  - 浏览器内 `window.__asterPagePerformance()` 指标复测需要 webview 内 JS 执行通道，当前环境无浏览器自动化能力，未采集；P0 已用 7 个单测覆盖采样门控本身。
  - 设置族懒加载 / 列表上限属长尾项，收益低，本轮不改以避免启动后再次重建。
  - release 宿主构建仍被本机 SwiftPM 沙盒阻挡，本轮只验证 debug 宿主 + production renderer。

## 第二轮：组件级深度优化（用户 /k-yolo「继续深度优化每个组件」）— 完成

范围锁定为 Studio 组件级性能（用户选择），不含 affect 复刻组件库。方法：两轮 Explore 审计（渲染反模式 + 消息/工具热点），只改经代码证据确认成立的点，逐项配回归单测，既有失败用临时回退复跑举证。

### C0 热点画像
- 确认成立 5 个组件级反模式；另审计出消息链路 8 处 + 工具结果 4 处 + 上下文面板 1 处 render 期重复计算。
- 排除项（有据）：store selector 已全部稳定化（useCache shallowEqual / org catalog Map / agent runtime 引用）；MessageList 12 个 context 已 useMemo；消息链路主要组件已 memo。

### C1 高频共享组件渲染收敛
- `ThemeProvider.tsx`：`toggleTheme` 改 `useCallback`，ThemeContext value 改 `useMemo`。该 context 有 60+ consumer，此前每次 Provider 重渲染都向全体扇出新对象。新增 `ContextIdentityProbe` 测试断言无关重渲染时 value 引用不变；为反映真实行为，测试用稳定 setter（mock 默认每次给新 `vi.fn()`），并在 afterEach 恢复默认 mock 实现。6/6 PASS。
- `MessageGroup.tsx:390`：传给 memo 的 `MessageGroupMenuBar` 的内联箭头提取为 `useCallback(handleMultiModelMessageStyleChange)`。该文件自定义比较器在流式更新时频繁返回 false，内联箭头会击穿子级 memo。MessageGroup + MenuBar 测试 49/50 PASS（1 例既有失败）。
- `KnowledgeCompileAgentRun.tsx:96`：`ComposerContextProvider` 的展开 value 改 `useMemo`（上游 `composerContext` 已 memo，依赖稳定）。流式 turn 下避免整个 Composer 子树重渲染。7 例测试 6/7 PASS（1 例既有失败，回退举证）。
- `MainExitGuard.tsx:127`：`retry` 改 `useCallback`、value 改 `useMemo`；7/7 PASS。

### C2 消息与工具结果组件
- `BashOutputTool.tsx`：parseBashOutput（每次 new DOMParser 解析整段输出）+ 4 个 truncateOutput 合入单个 `useMemo([output])`。此前无 memo、无 useMemo，50K+ 输出的流式每 tick 同步阻塞重解析。新增 `BashOutputTool.memo.test.tsx`：spy DOMParser.parseFromString，断言同 output 重渲染只解析 1 次、output 变化才重解析。1/1 PASS。
- `AgentExecutionTimeline.tsx:31`：`isToolPartAwaitingApproval`（遍历所有消息所有 part）改 `useMemo([partsMap, toolCallId])`，partsMap 为稳定 context 快照。3/3 PASS。
- `ToolHeader.tsx`：`getActivityLabels`（每次 20 个 t() 调用，单次渲染经 getCommandActivity→getReadableToolActivity 多次触达）改为按 `t` 引用 WeakMap 缓存 active/idle 两版；react-i18next 换语言产生新 `t`，自动失效。23 例 22/23 PASS（1 例既有失败，回退举证）。

### 验证
- 完整回归集 16 个测试文件 **142/143 PASS**；唯一失败 `KnowledgeCompileAgentRun` 既有用例，已回退举证与本次改动无关。
- `tsc -p tsconfig.web.json --noEmit` 共 354 个既有错，本轮改动文件 0 错。
- 生产渲染层构建 2.86s 成功；Studio 子模块 diff check 干净；主仓仅既有 `.kstudio/skills/README.md` 尾随空格。

### 未做（有据，非遗漏）
- `FileTreeRow` 加 memo：args 由 UI 包共享 `TreeRow` 每次 render 新建（`tree-row.tsx:35`），单纯 memo 无效；要修需改共享 TreeView，影响全部消费者，超出低风险范围。
- M1/M2/M4/M5/M8（引用投影/subagent 状态/工具组候选的重复全量 parts 扫描）：单点可修但需引入 parts 索引或复用 WeakMap，改动面与回归风险高于本轮 quick-win 口径，留待单独排期。
- 消息链路既有的稳定化设计（MessageLayer 有意不比较回调、messageProps 展开浅比较）保持不动。
- 未 commit/push；%≠Pass。

## 第三轮：重复全量扫描与输出处理收敛（用户「继续深度优化」）— 完成

承接第二轮留档的 M 系列硬骨头。关键前提经代码确认：`useStableMessagePartsLayers.ts:90-161` 在 parts 内容不变时替换式复用 partsMap 对象引用，因此以 partsMap 为 WeakMap key 安全、内容变即自动失效。

### D0/D1 parts 扫描索引化
- `toolResponse.ts`：`findToolPartByCallId` 改为 `WeakMap<partsMap, Map<toolCallId, ToolApprovalMatch>>` 索引（35 行 → 一次 O(N) 建索引 + O(1) 查）。这同时修复 M5（ToolBlockGroup 的 k 个 item 各扫全量 partsMap）与上一轮的 AgentExecutionTimeline 审批判断、useToolApproval。首个匹配语义保留、跳过无 approvalId 的 part。新增 `toolResponse.test.ts` 两例：跨消息查找/首个匹配/跳过无审批 part、partsMap 引用变化后失效。27/27 PASS。
- `MessagePartsRenderer.tsx` M1：`citationProjectionByPart` 的 filter 改用共享 `getCachedCitations()`（复用 `referenceCitationsCache`），消除同一 references 数组在投影过滤与 text 渲染各转换一次。`case 'text'` 补充“缓存项缺 citationReferences 时补齐”逻辑，避免投影预热后 text 分支拿不到 partId 绑定的引用视图。新增 `citationCache.test.ts`（mock convertReferencesToCitations 计次）：同数组只转换 1 次、identity 复用、undefined 不转换。MessagePartsRenderer 全量 94/94 PASS。

### D2 工具输出重复处理
- `ReadTool.tsx` T3：normalizeOutputString + getOutputStats(Blob) + truncateOutput + stripLineNumbers 的派生链合入单个 `useMemo([output, hasError])`。此前每次 render（流式每 tick）对全文跑 4 遍。新增 `ReadTool.memo.test.tsx`：spy Blob 构造，断言同 output 重渲不重复计算、output 变化才重算。1/1 PASS；AgentToolRenderer 54/54 PASS。
- T4（registry 重复 JSON.parse）：完成态才重复、收益低，且缓存 ReactElement 有风险，未做。
- M2/M4/M8（subagent 状态多次扫描）：需引入跨组件共享的 task-event 索引，改动面超出本轮口径，留待单独排期。

### 验证
- 完整回归 21 个测试文件 **320/321 PASS**；唯一失败 `KnowledgeCompileAgentRun` 既有用例（前两轮已回退举证）。
- `tsc -p tsconfig.web.json --noEmit` 354 个既有错，本轮改动文件 0 错（过程中发现并修掉一个自引入的 `truncatedOutput` 未用变量）。
- 生产渲染层构建 2.81s 成功；Studio 子模块 diff check 干净。
- 未 commit/push；%≠Pass。

## 第四轮：全量组件第一性原理审计与优化（用户「每一个组件都需要根据第一性原理深度优化」）— 完成

统一口径：`component render cost = render_count × per_render_cost`，不无差别给组件加 memo/cache。静态信号只是候选，必须逐项人工复核事件处理器、effect、useMemo、模块初始化等误报。

### F0 全量静态审计
- 临时脚本 `/tmp/aster-component-audit.py` 扫描 `apps/studio/src/renderer/**/*.tsx`：scanned=1317，candidate_files=85，clean_files=1232；signals：S2_expensive_outside_memo=112、S3_map_inline_element=3、S1_provider_inline_value=0（S1 已被前几轮清零）。
- 两组 Explore 独立复核 110 个候选：**误报率 86%**（组 A 30 中 27 误报、组 B 80 中 67 误报）。误报主因：heavy 调用位于 click handler / effect / useMemo 内，或数据规模极小。确认成立 16 处，本轮落地其中 6 处高价值项。

### F1 高危候选优化（全部为行为等价的 useMemo 缓存）
- `OrgMemberTable.tsx`：全量成员 filter（每行 join+lowercase+includes，数千成员）改 `useMemo([optimistic.rows, needle, departmentNames, t])`；编辑弹窗的整棵部门树构建/排序 `departmentTreeOptions()` 从 content prop 内联调用改 `useMemo([departments, editTarget, departmentNames, liveEditTarget])`，dialog 常闭时不再随无关 render 重建。
- `WorkspaceAnalysisMap.tsx`（≥500 节点窗口模式）：`categoryNodeIds` / `flowNodes` / `flowNodeIds` / `flowEdges` 全部 `useMemo`。关键收益是 `flowNodes` 引用稳定后，相机 effect（依赖 flowNodes）不再随无关 render 重复触发 `fitBounds`。
- `TaskConversationMessage.tsx:1588` `TaskFence`：`jsonRenderFromJson(code)` + `JSON.parse(code)`（KB–MB 级 JSON）合入单个 `useMemo([code, normalized, isIncomplete])`。因组件内有条件 return，memo 提到首个条件分支之前（hooks 规则）；保留 form 分支优先级、parse 失败降级与 `!isIncomplete` 守卫，逐字等价。
- `KnowledgeNotesPage.tsx`：`VaultFileTree` 的 `filterVault(nodes, needle, names)`（搜索时递归整棵 vault 树）改 `useMemo`；`ConceptReadingRail` 的 `conceptDocument` + sources flatMap + `conceptOutlinks` + `conceptDiagnostics` 三次全量 markdown 解析合并为一个 `useMemo([markdown, fromFile, files])`；`KnowledgeNotesWorkspace` 的 `conceptDocument(conceptMarkdown).title` 抽为 `conceptTitle` memo（`conceptPath ?? ''` 兜底类型，使用点已由 truthy 守卫保证非空）。

### 未做（有据，非遗漏）
- 低收益候选：`PlanEditorWindow.tsx:443/445/475/738`、`OrgMemberTable.tsx:334/977`（完成态 roles filter），改动模式相同但收益低于风险，暂不扩大。
- 静态复核确认的其余 10 处中，多数位于低频弹窗/完成态分支或已由前几轮 WeakMap 缓存覆盖；不重复投入。
- M2/M4/M8 跨组件 task-event 索引、知识页全量列表虚拟化、图谱 O(N²) 降级等结构性优化仍留待单独排期，超出「行为等价缓存」本轮口径。

### 验证
- 功能回归：四个改动文件相关测试 + Org 测试两批；本轮改动引入 0 个新失败。所有的失败（KnowledgeNotesPage 51 + shiki worker withContext 1 + OrgPage 3）均用 `git stash` 回退到无改动基线复跑，数字逐项一致，确认为既有失败与本次改动无关。
- `tsc -p tsconfig.web.json --noEmit` 共 309 个既有错（较改动前 310 减少 1：修掉自引入的 `noteTitle(conceptPath)` 类型错误）；本轮改动文件 0 新增错误，剩余 `TaskConversationMessage.tsx` 198/199/223 三错在改动行（1592+）之外，为既有错误。
- 生产渲染层构建 2.82s 成功；Studio 子模块 diff check 干净；主仓仅既有 `.kstudio/skills/README.md` 尾随空格。
- 未 commit/push；%≠Pass。
