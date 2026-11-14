# Windows `agent-desktop` 可视化 E2E 复跑结果（2026-11-14 rerun）

仓库根目录：`D:\code\aster`　平台：Windows　工具：`agent-desktop` **1.2.0**
证据目录：`docs/evidence/studio/2026-11-14-windows-agent-desktop-e2e-rerun/`
执行计划：`同目录上一轮的 E2E-TEST-PLAN.md`（`docs/evidence/studio/2026-11-14-windows-agent-desktop-e2e/OUTCOME.md` 所在目录）
首轮结果：`docs/evidence/studio/2026-11-14-windows-agent-desktop-e2e/OUTCOME.md`

> 本轮是**按新测试计划真实复跑**：只用 `agent-desktop` 观察/操作真实 Studio 窗口，主断言全部取自 AX JSON envelope。未使用 Playwright、未使用 runtime 桩套件、未修改产品代码。磁盘 hash / 日志 / git 只作环境证据。
> **本轮使用独立证据目录，上一轮所有历史证据（含 4 份 FAIL / 弱证据归档）完全未改动。**

---

## 0. Summary

- 最终结论：**F02、F08、F10、F11、F17 各 2 次独立 PASS（计入覆盖 5 条）**；**F01 两次独立 FAIL（真实回归，不计入）**；F05 = 2×BLOCKED；F14 = PARTIAL；F03/F04/F07 = SKIP；F06/F09/F12/F13/F15/F16 = NOT TESTED。
- 启动前门槛 1–7 与 Phase 0 S0–S4 全部通过后才进入 Phase 1。
- **与首轮的关键差异 —— 被测对象不同，必须并列阅读**：
  | 项 | 首轮（同日 08:14） | 本轮（14:27） |
  |---|---|---|
  | 子模块源码 | 全树对齐父仓 gitlink `944864f2`（0.2.3） | 保持用户工作树 `07ffdfcf5`（0.2.2），**仅把两个 version 字段对齐 0.2.3** 以通过 `--locked` 构建 |
  | renderer | 含 `cc0a7bd09` 草稿保持修复 | **不含**该修复 |
  | `Studio.exe` sha256 | `3d60401b…` | `c247c742…`（本轮重新构建） |
  | F01 | 2×PASS | **2×FAIL** |
- 因此 **F01 的两次 FAIL 是真实、可复现、有静态根因的产品行为差异**，不是 harness 缺陷，也不是环境抖动。按 fail-closed 保留，**未通过换被测对象或放宽断言凑绿**。
- 全程 `commands.jsonl` 记录 **1271** 条 `agent-desktop` 命令；合规审计见 §7。

---

## 1. 启动前门槛

| # | 检查 | 结果 | 证据 |
|---|---|---|---|
| 1 | `agent-desktop status` | `ok:true`、`platform:"windows"`、`version:"1.2.0"`、`accessibility.state:"granted"` | `phase0-S0-status.json` |
| 2 | `python3 -c "print(1)"` | 输出 `1` | 门槛命令输出 |
| 3 | `apps/studio` 与父仓 gitlink | 见 §1.1（有明确偏离，已如实标注） | `user-wip-reasoning_effort.patch`、`build-context.log` |
| 4 | 仓库根 `just build-studio` | `BUILD_EXIT=0`，见 §1.2 | `build-context.log` |
| 5 | 启动应用（路径 B） | 见 §1.3 | `launch-1.log` |
| 6 | `list-windows` 定位主窗 | `Studio.exe` / `Aster` / `w-162401792` / `pid 8684` | `phase0-S1-window.json` |
| 7 | `snapshot -i --compact` 与首启弹窗 | `complete:true`；6 个 onboarding token 全 0 | `phase0-S2-snapshot.json`、`phase0-S3-dialogs.json` |

### 1.1 门槛 3：WIP 保护、gitlink 对齐尝试与偏离

用户 WIP 仅 `apps/studio/src-tauri/src/agent_plane/reasoning_effort.rs`（39 行插入）。处理顺序：

1. 备份：`git -C apps/studio diff > user-wip-reasoning_effort.patch`，sha256 `ae7f4036225522042da4b8ee8e5bda1c3deb77aaedbfbaf522ede1f5fcc55a4f`（与首轮完全一致，证明 WIP 未变）。
2. `git -C apps/studio stash push -m "win-e2e-rerun: preserve WIP before gitlink align"` → `stash@{0}` / `0dbf5ef5`。
3. **全树 `git -C apps/studio checkout --detach 944864f2` 失败**：
   `fatal: cannot opendir 'packages/ui/node_modules/.pnpm/@babel+core@7.29.7/node_modules/@babel/code-frame': No such file or directory`。
   根因是 pnpm 符号链接指向 workspace 根 `/d/code/aster/packages/ui/...` 的断链，git 遍历工作树时报错；不是源码问题。
4. 改用 **pathspec 定点操作**绕开 node_modules：`git -C apps/studio checkout HEAD -- src-tauri/src/agent_plane/reasoning_effort.rs`（成功，工作树变干净）。
5. 静态确认 `07ffdfcf5..944864f2` 之间 `src-tauri/Cargo.toml` **只差 version 一行**（`0.2.2 → 0.2.3`），`package.json` 只差 version + 一个 script；59 个文件差异全在 renderer TS 层。
6. 因此只把 `src-tauri/Cargo.toml` 与 `package.json` 的 `version` 对齐为 `0.2.3`（与父仓 `Cargo.lock` 一致），**未改 `Cargo.lock`、未去掉 `--locked`、未做全树 checkout**。

> **偏离声明**：本轮没有按计划 §3.1 做「全树 gitlink 对齐」，renderer 源码保持用户工作树 `07ffdfcf5`。理由：① pnpm 断链使全树 checkout 不可行；② 用户要求「测本 checkout」，保留用户工作树是更真实的被测对象；③ 版本对齐已足以让 `--locked` 构建通过。**该偏离直接导致 F01 与首轮结果不同（见 §3.4）**，必须并列阅读，不得把两轮数字混算。

### 1.2 门槛 4：构建（本轮重新构建）

命令（仓库根）：`just build-studio`，耗时 5m16s，`BUILD_EXIT=0`（`Finished 'dev' profile ... in 1m 07s` + `in 3m 22s`）。

| | mtime | size | sha256 |
|---|---|---|---|
| 构建前 | 2026-11-14 08:14:41 +0800 | 162131968 | `3d60401b9aa25ccf8436c563c0606e8080be7fb15986faaa9ba219e864b566bb` |
| 构建后 | 2026-11-14 14:27:37 +0800 | 162131456 | `c247c7422b729d93b44c12985fce37930a7187dbeb40cb3a91cc7807164719d0` |

**本轮测试的是刚由本 checkout 编出的 `Studio.exe`**，符合硬规则。

### 1.3 门槛 5–6：启动与窗口标识

```bash
cd /d/code/aster/apps/studio
ASTER_TENANT_SLUG=aster STUDIO_RENDERER_DEV=1 \
ASTER_STUDIO_INSTANCE=win-e2e-01 STUDIO_RENDERER_PORT=4318 \
node scripts/studio-dev.mjs
```

* 日志 `launch-1.log`：`client dev server on 127.0.0.1:4318 (hot reload)`、`native build cache D:\code\aster\target\studio\aster`。
* 首次主窗：`{"app_name":"Studio.exe","title":"Aster","id":"w-162401792","pid":8684,"visible":true,"minimized":false,"bounds":{"x":26,"y":26,"width":1456,"height":959}}`。
* `studio-dev.mjs` 每次启动跑两次 `cargo build --locked` + 起 rsbuild dev server；本轮 F11/F08 重启批次单次冷启动约 3–4 分钟（后台任务 `HlyWkN` 整批 23m52s）。

---

## 2. Phase 0 冒烟（全绿后继续）

`phase0.py` 一次完成 S0–S4 并附控件普查，`phase0-summary.txt` 输出 `PHASE0_L3: PASS`。

| 项 | 断言 | 结果 | 证据 |
|---|---|---|---|
| S0 | `status` / `list-apps` | `ok:true`、`1.2.0`、`accessibility granted`、`list_apps_ok=True` | `phase0-S0-status.json`、`phase0-S0-list-apps.json` |
| S1 | 主窗 visible | `visible:True`、`minimized:False`、`w-162401792` / `pid 8684` | `phase0-S1-window.json` |
| S2 | `snapshot -i --compact` `complete` + composer | `complete=True`、`snapshot_id=s1g2t0wbeuh089`、`composer_matches=2` | `phase0-S2-snapshot.json`、`phase0-S2-find-composer.json` |
| S3 | 首启弹窗 | `继续/稍后设置/跳过/开始使用/下一步/允许` 全为 0 | `phase0-S3-dialogs.json` |
| S4 | 截图非白屏 | `png 1442×952`、415139 bytes；目视可见 Aster 标题、侧栏「新建任务/连接器/技能/自动化/项目/最近」、composer「描述任务，输入 /…」、「请求批准」、「选择模型」、「选择项目 当前目录」 | `screenshots/phase0-S4-main-window.png`、`phase0-S4-screenshot.json` |

**AX 控件普查**（确认 harness 断言与当前 renderer 兼容）：
* 工作台 `ax-census.json`：`描述任务 2`、`设置 1`、`选择模型 1`、`更多选项 1`、`授权模式 1`、`收起侧边栏 1`、`新建任务/连接器/技能/自动化/项目/最近` 均在。
* 设置页 `ax-settings-census.json`（`probe_settings.py`，导航后已还原工作台）：`搜索设置 1`、`运行任务时保持系统唤醒 2`、`网络搜索 1`、`返回应用 1`。
* 结论：控件名与 harness 一致，F01 的 FAIL 不是控件名漂移导致。

---

## 3. Phase 1

### 3.1 执行方式

`drive.py` / `restart_cases.py` 是**编排 harness，不是桩套件**：串行调用同一个 `agent-desktop-win32-x64.exe` CLI，所有 GUI 观察/动作与全部断言都来自 AX JSON。进程启动/关闭属环境准备，不作断言。

* 每次动作前重新 `find` 取新鲜 `ref_id`；`STALE_REF` 重取；按 `disposition.retry` 处理，未盲重试 unsafe 写动作。
* 本轮全程在 Git Bash / Python 执行，按 Windows platform skill **不额外包裹字面单引号**（单引号规则仅 PowerShell）。
* 最小化窗口先 `restore`；**未调用 `focus-window`**。
* 重启类用例在**单个常驻 Python 进程**内执行（避免 Popen 启动器随父进程退出被回收），`wait_window(attempts=600)`。

### 3.2 逐条结果

| 用例 | 功能 | run 1 | run 2 | 结论 | 关键 AX 摘要 |
|---|---|---|---|---|---|
| F01 | 草稿跨页导航保持 | **FAIL** | **FAIL** | **2x FAIL（不计入）** | `after='描述任务，输入 / 使用指令或技能，@ 选择工作区文件\n'`（草稿被重置为 placeholder） |
| F02 | composer 中文输入与控件 | PASS | PASS | **2x PASS（计入）** | `value='中文短句测试02BDA2' method=type --headed matches=1`；`更多选项/授权模式` menubutton 存在 |
| F03 | 流式消息/工具披露/引用 | - | - | SKIP | 无安全 fixture |
| F04 | 消息虚拟列表与滚动记忆 | - | - | SKIP | 无安全 fixture |
| F05 | 模型选择 | BLOCKED | BLOCKED | BLOCKED | `nodes_before=41 nodes_after=41 selectable=[('menuitem','系统')]` |
| F06 | （结构不可达） | - | - | NOT TESTED | 按硬规则不测 |
| F07 | 真实 ACP turn / MCP | - | - | SKIP | 无安全 fixture |
| F08 | 侧栏状态跨进程持久化 | PASS | PASS | **2x PASS（计入）** | `target=收起侧边栏 observed=收起侧边栏 states=['checked']` |
| F09 | （结构不可达） | - | - | NOT TESTED | 按硬规则不测 |
| F10 | 设置搜索 | PASS | PASS | **2x PASS（计入）** | `readback='网络'`、`设置搜索结果` listbox 1、`网络搜索 网络搜索` option 1、清空后 `listbox_matches=0` |
| F11 | 偏好跨进程持久化 | PASS | PASS | **2x PASS（计入）** | run1 `before=True after=False target=False`；run2 `before=False after=True target=True`，重启后回读一致 |
| F12 | （结构不可达） | - | - | NOT TESTED | 按硬规则不测 |
| F13 | 首次运行/组件/权限 | - | - | NOT TESTED | 严格达标不承诺 |
| F14 | 单实例/二次启动抽样 | PARTIAL | - | PARTIAL | `current_windows=1`；4 次重启均 `windows_after=1` |
| F15 | （结构不可达） | - | - | NOT TESTED | 按硬规则不测 |
| F16 | 错误态/无障碍 | - | - | NOT TESTED | 不在本轮执行清单 |
| F17 | 窄窗口溢出抽样 | PASS | PASS | **2x PASS（计入）** | `window_bounds=900×700`、`sampled_bounded_nodes=9/10`、`severe_overflow=[]` |

重启批次 `phase1-ALL.stdout.log`：`ALL RESULTS: ["PASS","PASS","PASS","PASS","PARTIAL"]`，`ALL_EXIT=0`。

### 3.3 关键命令与 JSON 摘要

* **F02**：`find --name 描述任务` → `--headed focus` → 重取 ref → `--headed type <中文 token>` → `get --property value` 独立回读 → `find --name <token>` 的 `total_matches>0` 可见性断言 → `find` 控件存在。两次 token 独立。
* **F10**：`click 设置`(button) → `click 搜索设置...`(button) → 断言同控件变 `combobox` → `--headed type "网络"` → `get value == "网络"` → 断言 `listbox 设置搜索结果` 与 `option 网络搜索 网络搜索` 出现 → `click 清除` → 断言结果消失且 `--exact "网络搜索"` 分类按钮重现。两次各 9 条断言全 OK。**未把恒存在的分类按钮当搜索结果**。
* **F17**：`resize-window --width 900 --height 700` → `snapshot complete` → 从 `find` per-match `bounds` 采样 13 个具名内容控件（≥3）→ 与窗口 bounds 比较，超出 200px 才算严重溢出 → 恢复原尺寸。
* **F11**：`click 设置` → `find 运行任务时保持系统唤醒 --role switch` → `toggle`（`delivered_verified`）→ 断言 `states.checked` 翻转 → `close-app --force` → 同实例路径 B 重启 → `list-windows` 断言恰好 1 个可见主窗 → 重新进设置 → `find` 断言 `states.checked == target`。两次方向相反。
* **F08**：`find 收起侧边栏/展开侧边栏 --role switch` → `toggle` → 断言可访问名翻转 → `close-app --force` → 同实例重启 → `find` 断言重启后控件名 == target。
* **F14**：仅 `list-windows` 单主窗抽样 + 汇总 4 条 `restart identity`。**未**并发起第二实例、**未**触发 flock / `Claim::Busy`、**未**验证更新通道/清单或 `MainExitGuard`。

### 3.4 F01 两次 FAIL：根因与 fail-closed 处置（本轮最重要发现）

**AX 事实**（`phase1-F01-run1.json` / `run2.json`）：
```
OK   F01 draft entered - value='中文短句测试014582'      # 输入确实落地
OK   F01 settings click delivered
OK   F01 settings page reached (返回应用 button present)
OK   F01 work click delivered
FAIL F01 draft survived cross-page round trip - after='描述任务，输入 / 使用指令或技能，@ 选择工作区文件\n'
```
两次 token 独立（`014582` / `01CF75`）、结果一致、失败点相同。输入回读、设置页到达、返回点击全部 OK，故**不是输入路径、不是 ref 失效、不是断言写错**。

**静态根因**（只读 git 证据，`f01-root-cause.txt`）：`07ffdfcf5..944864f2` 之间存在提交
`cc0a7bd09 fix(sidebar): keep home composer draft when leaving Settings via the Work button`，
修改 `src/renderer/components/app/sidebarShortcuts/runtime.tsx`：把 `workspaceSurfaceUrl()` 重构为 `latestWorkspaceTab()`，让「工作」按钮**返回已挂载的 workspace tab** 而不是改写 Settings overlay tab，从而保留 per-tab home composer draft；并新增 2 条单元测试。当前工作树 `07ffdfcf5` 不含该提交，所以从设置页点「工作」会重建工作台组件、草稿被重置。

**与首轮对照**：首轮全树对齐 `944864f2`（含该修复）→ F01 2×PASS；本轮保留 `07ffdfcf5`（缺该修复）→ F01 2×FAIL。两轮用的是**不同被测对象**，差异完全由该提交解释。

**fail-closed 处置**：
* 两次 FAIL 的原始 JSON 与两轮 stdout 日志已复制到 `f01-fail-archive/`，**保留不删**，主目录 `phase1-F01-run1.json` / `run2.json` 即为正式 FAIL 结论。
* **未**放宽任何断言、**未**改判定口径、**未**删失败记录。
* **未**为了凑绿而把 renderer 换成 `944864f2` 重跑（那等于换被测样本掩盖缺陷）。根因诊断只做只读静态分析，不作 UI 断言。
* 结论：在当前用户工作树上 F01 **不计入覆盖**；若需要恢复 F01，应由用户决定是否把子模块推进到含 `cc0a7bd09` 的版本，而不是由测试侧改样本。

### 3.5 Windows 适配差异（与首轮一致，均已复验）

1. app 名带 `.exe`；`--app "Studio"` 会 `APP_NOT_FOUND`，统一用 `Studio.exe`。
2. `type` 需 `--headed`（本轮 6 次）、`focus` 亦 headed（4 次）；headed 动作可能使窗口最小化，观察前先 `restore`，不用 `focus-window`。
3. 设置搜索 combobox 上 `set-value` 会 `STALE_REF` + `retry:unsafe`；本轮直接用 `--headed type` 并断言真实结果 listbox/option（首轮已归档该 FAIL）。
4. `snapshot --compact` 折叠深层 Web 内容；F17 的 bounds 采样必须用 `find` per-match `bounds`。
5. `get --property checked` 非法；开关状态读 `find.states` 与随状态翻转的可访问名。
6. `studio-dev.mjs` 每次启动两次 `cargo build --locked` + 起 dev server；重启批次必须单常驻 Python 进程。
7. 长用例一律后台执行 + stdout 日志（本轮非重启批次 6m51s、重启批次 23m52s）。

### 3.6 Fail-closed 归档清单（均未删除）

| 归档 | 原因 | 处置 |
|---|---|---|
| `f01-fail-archive/phase1-F01-run1.json`、`run2.json` | F01 两次真实 FAIL | 保留正式 FAIL 结论，不放宽断言、不换样本 |
| `f01-fail-archive/phase1-nonrestart-run1.stdout.log`、`run2.stdout.log` | 两轮完整 stdout | 原样保留 |
| `f01-fail-archive/commands-prealign.jsonl` | 非重启批次 301 条命令快照 | 已复制回主 `commands.jsonl` 继续追加，副本保留 |

错误码分布（`commands.jsonl`，1271 条）：`ACTION_FAILED 16`、`TIMEOUT 4`、`STALE_REF 1`；均按 disposition 处理，未放宽断言。

---

## 4. Phase 2（F03 / F04 / F07）：SKIP

只读扫描 `phase2-fixture-scan.txt`：全仓检索 `synthetic model|mock model|mcp fixture` 的 22 条命中全部是 Playwright 连接器 harness、Rust 单元测试支持代码、ADR/测试计划文档与第三方 inference 库的术语，**不是可独立安全启动的服务**；`model_server.py` 存在但需 Playwright harness 驱动，`capability_mcp.py` 不存在。F05 已 BLOCKED（本实例无可选模型 AX 节点，无法发起真实 turn）。

结论：**F03 / F04 / F07 = SKIP**，不计入覆盖；本轮未启动任何临时外部服务。

---

## 5. 截图与证据文件

* `screenshots/phase0-S4-main-window.png` — 非白屏主窗（1442×952，415139 bytes）。
* `phase0-*.json`、`phase0-summary.txt`、`ax-census.json`、`ax-settings-census.json`、`settings-census-summary.json` 相关输出 — Phase 0 与控件普查。
* `phase1-*.json`、`phase1-nonrestart-run{1,2}.stdout.log`、`phase1-ALL.stdout.log`、`phase1-ALL.exit` — 逐用例结果。
* `f01-fail-archive/` — F01 两次 FAIL 与命令快照归档。
* `build-context.log`、`launch-1.log`、`launch-restart.log`、`phase2-fixture-scan.txt`、`f01-root-cause.txt`、`compliance-audit.txt`、`results-summary.txt`、`commands.jsonl` — 环境/命令/审计证据。
* `phase0.py`、`probe_settings.py`、`audit.py`、`drive.py`、`restart_cases.py` — 编排与探测脚本（非产品代码）。
* `worktree-anomaly.txt`、`worktree-anomaly-2.txt` — §8.3 工作树异常诊断。

---

## 6. 窗口与进程标识汇总

| 阶段 | window-id | pid | 说明 |
|---|---|---|---|
| 首次启动 / Phase 0 | `w-162401792` | `8684` | 首次实例 |
| F01 / F02 / F05 / F10 / F17 run1+run2 | `w-162401792` | `8684` | 同一实例内独立 token 复跑 |
| F11 run1 重启后 | `w-322896246` | `47860` | `before=[('w-162401792',8684)] windows_after=1` |
| F11 run2 重启后 | `w-40174798` | `16800` | `before=[('w-322896246',47860)] windows_after=1` |
| F08 run1 重启后 | `w-24707994` | `3232` | `before=[('w-40174798',16800)] windows_after=1` |
| F08 run2 重启后 | `w-331747382` | `53428` | `before=[('w-24707994',3232)] windows_after=1` |
| F14 run1 抽样时 | `w-331747382` | `53428` | `current_windows=1`，汇总 4 条 restart identity |

重启链：`w-162401792/8684 → w-322896246/47860 → w-40174798/16800 → w-24707994/3232 → w-331747382/53428`。

---

## 7. 合规审计

`compliance-audit.txt` / `audit.py` 基于 `commands.jsonl` 全量统计：

| 项 | 值 |
|---|---|
| 记录命令总数 | **1271** |
| 主要命令 | `list-windows 1004`、`find 174`、`get 26`、`click 20`、`clear 16`、`type 6`、`snapshot 6`、`focus 4`、`resize-window 4`、`toggle 4`、`close-app 4`、`press 2`、`restore 1` |
| 错误码 | `ACTION_FAILED 16`、`TIMEOUT 4`、`STALE_REF 1` |
| `mouse-click` / 坐标动作 | **0** |
| `focus-window` | **0** |
| Playwright / runtime 桩 | **0** |
| `--headed` | **10**（6 `type` + 4 `focus`），均为 Windows 必需输入路径 |

主断言来源全部是 `snapshot/find/get/is/click/toggle/...` 的 AX JSON；磁盘 hash、日志、git 只作环境证据。

---

## 8. 收尾

### 8.1 应用 / 窗口 / 端口

重启批次结束后 `studio-dev.mjs` 随父 Python 进程退出，`Studio.exe` 自行结束（首轮启动任务以 exit 1 结束符合 `studio.on('exit')` 设计，非异常）。复查：

* `agent-desktop list-windows --app "Studio.exe"` → `{"ok":true,"data":[]}`
* `netstat -ano | grep 127.0.0.1:4318` → 无 `LISTENING`（仅 `TIME_WAIT`，属正常释放）

本测试占用的窗口、进程与端口 `4318` 已全部释放；**未结束任何用户无关进程**，未做批量删除。

### 8.2 用户 WIP 恢复（回到执行前状态）

1. 把 `src-tauri/Cargo.toml`、`package.json` 的 `version` 由 `0.2.3` 改回 `0.2.2`。
2. `git -C apps/studio stash pop stash@{0}` → `Dropped stash@{0} (0dbf5ef5…)`。
3. 完整性校验（逐字节）：
   * patch sha256 `ae7f4036225522042da4b8ee8e5bda1c3deb77aaedbfbaf522ede1f5fcc55a4f`
   * 当前 `git -C apps/studio diff | sha256sum` → **同值**
   * `1 file changed, 39 insertions(+)`，仅 `reasoning_effort.rs`。
4. 子模块 HEAD 仍为 `07ffdfcf5`（detached，与执行前一致）；用户原有 `stash@{1..}` 顺延后未改动。

> `Studio.exe` 仍是本轮 14:27 由「版本对齐后的工作树」构建的二进制（sha256 `c247c742…`）；源码工作树已恢复为 `0.2.2` + 用户 WIP。若后续继续开发，请按需重新构建。

### 8.3 工作树异常（发现但不处置）

收尾时父仓 `git status --short` 除 `M apps/studio` 与新增证据目录外，另出现 **445 条 ` D packages/ui/...`**（`worktree-anomaly*.txt`）。事实：

* 缺失集中在 `packages/ui/icons/**`（434 个 svg）、`docs/`（6）、根目录配置（3）、`.storybook`（2）；`packages/ui/README.md`、`src/`、`package.json`、`pnpm-lock.yaml` 等**仍在**。
* 子模块 git 目录为独立的 `D:/code/aster/.git/modules/studio`，本轮 stash / pathspec checkout 不可能触及父仓 index；`.git/index` mtime 为 `07:00:21`，早于本轮全部操作。
* `build-context.log` / `launch-1.log` 无任何 `pnpm install` / 删除动作；1271 条 `commands.jsonl` 中涉及 `packages/ui` 的记录为 **0**；本轮所有文件写入仅限 `apps/studio` 两个 version 字段与本证据目录。

**判定：非本轮操作造成，成因未定（可能为用户既有工作树状态或外部进程）。未执行任何恢复、删除或 `git restore`，以免覆盖用户意图。** 若确属误删，可由用户自行执行 `git restore -- packages/ui` 恢复；是否需要恢复请用户确认。

### 8.4 证据保留

本目录所有 JSON、日志、截图、脚本、模板与 `f01-fail-archive/` 全部保留，未删除、未改写历史结论。上一轮证据目录 `2026-11-14-windows-agent-desktop-e2e/` 完全未改动。

---

## 9. Explicitly not claimed

* **不声称** F01 通过或计入覆盖：本轮两次独立 **FAIL**，是当前工作树 `07ffdfcf5` 的真实缺陷（缺 `cc0a7bd09`）。
* **不声称** 两轮结果可混算：首轮与本轮被测对象不同（gitlink 全树对齐 vs 用户工作树版本对齐），F01 差异已如实归因，不预支任何「x/17」数字。
* **不声称** F06 / F09 / F12 / F15 的任何覆盖（结构不可达，按要求不测）；F13 严格达标不承诺。
* **不声称** F14 严格达标：仅「二次启动后仍为单主窗」AX 抽样（PARTIAL），**不声称** flock / `Claim::Busy`、更新通道/清单、退出守卫被验证。
* **不声称** F05 覆盖（BLOCKED：无可选模型 AX 节点 / 无配置模型服务）；**不声称** F03 / F04 / F07 覆盖（SKIP：无安全 fixture）。
* **不声称** F02 / F10 / F17 是完整功能覆盖：F02 未覆盖斜杠命令/附件/队列；F10 未覆盖命令面板/深链/快捷键/空态；F17 未覆盖 100/125/200% 缩放矩阵与主题切换。
* **不声称** 磁盘 / HTTP / git / 日志回读等价于 UI 断言：本轮未使用 ACL 或静态分析作断言，`cc0a7bd09` 仅作根因解释（evidence）。
* **不声称** 修改过产品代码；未改动 `Cargo.lock`、未放宽 `--locked`、未放宽任何断言、未换被测样本凑绿。
* **不声称** 处理过 `packages/ui` 的 445 个删除标记：未恢复、未删除、未 `git restore`。
* **不声称** 任何覆盖率数字，也不把历史 Playwright / Gate A / runtime 桩结果计入本轮。
