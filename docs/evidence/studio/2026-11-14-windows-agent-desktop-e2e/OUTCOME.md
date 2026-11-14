# Windows `agent-desktop` 可视化 E2E 执行结果（2026-11-14）

仓库根目录：`D:\code\aster`　平台：Windows　工具：`agent-desktop` **1.2.0**
证据目录：`docs/evidence/studio/2026-11-14-windows-agent-desktop-e2e/`

> 本轮是 **Windows 适配执行**：只用 `agent-desktop` 观察/操作真实 Studio 窗口，主断言全部取自 AX JSON envelope。未使用 Playwright、未使用 runtime 桩套件冒充结果、未修改产品代码。磁盘/hash/日志/HTTP 仅作环境证据，不替代任何 UI 断言。

## 0. Summary

- 最终结论：**F01、F02、F08、F10、F11、F17 各 2 次独立 PASS，计入覆盖（6 条）**；F05 = BLOCKED；F14 = PARTIAL；F03/F04/F07 = SKIP；F06/F09/F12/F13/F15 = 按要求不测或不做严格达标承诺。

- 启动前门槛 1–7 全部通过；Phase 0 冒烟 S0–S4 全部通过后才进入 Phase 1。
- 计入覆盖的判定口径：**每条用例必须独立复跑 2 次 PASS**；FAIL 一律 fail-closed 归档，不放宽断言凑绿；BLOCKED / PARTIAL / SKIP 不计入覆盖，也不预支 MATRIX 的百分比。
- 全程 `commands.jsonl` 记录每条 `agent-desktop` 命令；合规审计见 §7。

## 1. 启动前门槛

| # | 检查 | 结果 | 证据 |
|---|---|---|---|
| 1 | `agent-desktop status` | `ok:true`，`platform:"windows"`，`version:"1.2.0"`，`permissions.accessibility.state:"granted"`（automation / screen_recording 为 `not_required`） | `phase0-S0-status.json` |
| 2 | `python3 -c "print(1)"` | 输出 `1`；解释器 `/c/Users/admin/.workbuddy/binaries/python/versions/3.13.12/python3` | 门槛命令输出 |
| 3 | `apps/studio` 对齐父仓 gitlink | 见 §1.1 | `build-context.log`、`user-wip-reasoning_effort.patch` |
| 4 | 仓库根 `just build-studio` | 见 §1.2 | `build-context.log` |
| 5 | 启动应用（路径 B） | 见 §1.3 | `launch-1.log` |
| 6 | `list-windows` 定位主窗 | `Studio.exe` / `Aster` / `w-85395480` / `pid 37164` | `phase0-S1-window.json` |
| 7 | `snapshot -i --compact` 与首启弹窗 | `complete:true`；无 dialog、无需关闭 | `phase0-S2-snapshot.json`、`phase0-S3-dialogs.json` |

### 1.1 门槛 3：gitlink 对齐与用户 WIP 保护

父仓 `Cargo.lock` 记录 `aster-studio 0.2.3`，而子模块旧 HEAD `07ffdfcf56f8a2a21efce49be17ed4aaf3142cbb` 的 `src-tauri/Cargo.toml` 是 `0.2.2`，父仓 gitlink 为 `944864f2775fd75609ea811f28b96e7b96b27552`。用户脏改动仅 `apps/studio/src-tauri/src/agent_plane/reasoning_effort.rs`。

处理顺序（先保全、再按干净树构建）：

1. 备份 WIP：`git -C apps/studio diff > user-wip-reasoning_effort.patch`，patch sha256 `ae7f4036225522042da4b8ee8e5bda1c3deb77aaedbfbaf522ede1f5fcc55a4f`。
2. `git -C apps/studio stash push -m "win-e2e-20261114: preserve reasoning_effort.rs WIP before gitlink align"` → `stash@{0}` / `6096098a089d289abec8a1b88ab98a30a78904ea`。
3. `git -C apps/studio checkout --detach 944864f2775fd75609ea811f28b96e7b96b27552`（`Cargo.toml` 变为 `0.2.3`，`package.json` 变为 `0.2.3`）。
4. 构建完成后收尾恢复，见 §8。

### 1.2 门槛 4：构建（只测本 checkout 编出的 `Studio.exe`）

命令（仓库根）：`just build-studio`

* 构建前：`2026-11-13 08:13:52 +0800`，`162071040` bytes，sha256 `2433e8ed98f88bf4d3a4a5ad23e1e310c21f2782c77d825f21f1255c5c828026`。
* **首次构建 FAIL（exit 101）**：`error: cannot update the lock file D:\code\aster\Cargo.lock because --locked was passed to prevent this`。根因即 §1.1 的版本不一致；未放宽 `--locked`、未改 `Cargo.lock`，而是按门槛 3 对齐子模块后重建。
* 对齐后重建成功：`Finished 'dev' profile ... in 9m 28s` 与 `Finished 'dev' profile ... in 4m 49s` 两个 marker。
* 构建后：`2026-11-14 08:14:41 +0800`，`162131968` bytes，sha256 `3d60401b9aa25ccf8436c563c0606e8080be7fb15986faaa9ba219e864b566bb`。
* 完整前后对比与两次构建日志：`build-context.log`。

### 1.3 门槛 5–6：启动与窗口标识

Windows 上 `just studio` 配方 `cd apps/studio && exec scripts/studio-shell.sh` 偏 Unix，因此采用**路径 B**：

```bash
cd /d/code/aster/apps/studio
ASTER_TENANT_SLUG=aster STUDIO_RENDERER_DEV=1 \
ASTER_STUDIO_INSTANCE=win-e2e-01 STUDIO_RENDERER_PORT=4318 \
node scripts/studio-dev.mjs
```

* 启动日志：`launch-1.log`；renderer dev server `127.0.0.1:4318`；`studio-webview-url http://127.0.0.1:4318/windows/main/index.html`。
* 日志中有 renderer 侧非致命信息（`IPC route is not available: backup.get_auto_sync_state`、bundled catalog warning），仅作环境证据，未替代任何 UI 断言。
* 首次主窗：`{"app_name":"Studio.exe","title":"Aster","id":"w-85395480","pid":37164,"visible":true,"minimized":false,"bounds":{"x":78,"y":78,"width":1456,"height":959}}`。
* **注意**：`studio-dev.mjs` 每次启动都会执行两次 `cargo build --locked`（本轮约 4–6 分钟）；这是 Phase 1 重启类用例耗时较长的原因，见 §3.4。

## 2. Phase 0 冒烟（全绿后继续）

| 项 | 断言 | 结果 | 证据 |
|---|---|---|---|
| S0 | `status` / `list-apps` | `ok:true`；`list-apps` 含 `{"name":"Studio.exe","pid":37164}` | `phase0-S0-status.json`、`phase0-S0-list-apps.json` |
| S1 | 主窗 `visible` | `visible:true`、`minimized:false`、`id:w-85395480` | `phase0-S1-window.json` |
| S2 | `snapshot -i --compact` `complete` + composer 可见 | `{"complete":true,"ref_count":14,"snapshot_id":"s3h9txvntjxf6"}`；`find --name 描述任务` → `total_matches:2`（textfield 带 `ref_id`，statictext 无 `ref_id`） | `phase0-S2-snapshot.json`、`phase0-S2-find-composer.json`、`phase0-S2-snapshot-full.json` |
| S3 | 首启弹窗 | `find` dialog → `total_matches:0`；另探测 `继续/稍后设置/跳过/开始使用/下一步/允许` 全为 0 → 无需关闭 | `phase0-S3-dialogs.json` |
| S4 | 截图非白屏 | `{"format":"png","width":1442,"height":952,"scale_factor":1.0}`，417893 bytes；目视可见侧栏「新建任务/连接器/技能/自动化/项目/最近」、Aster 标题、composer、「选择模型」 | `screenshots/phase0-S4-main-window.png`、`phase0-S4-screenshot.json` |

工作台 / 设置页 AX 控件普查：`ax-census.json`（`complete:true`，`ref_count:75`）、`ax-settings-census.json`（`complete:true`，`ref_count:109`）。关键控件：`textfield 描述任务…`、`menubutton 更多选项`、`menubutton 授权模式: 请求批准`、`menubutton 选择模型`、`switch 收起侧边栏 (checked)`、`button 设置`、`button 搜索设置...`、`switch 运行任务时保持系统唤醒`。

## 3. Phase 1

### 3.1 执行方式

`drive.py` / `restart_cases.py` 是**编排 harness，不是桩套件**：它们串行调用同一个 `agent-desktop-win32-x64.exe` CLI，所有 GUI 观察/动作（`snapshot/find/get/is/click/toggle/type/set-value/press/clear/restore/resize-window/close-app/list-windows/screenshot`）与全部断言都来自 AX JSON。进程启动/关闭属于环境准备，不作断言。

* 每次动作前重新 `find`/`snapshot` 取新鲜 `ref_id`；`STALE_REF` 重取、`ACTION_FAILED` 按 `disposition.retry` 处理（仅 `not_delivered` 安全时重试），未盲重试写动作。
* 用户要求「PowerShell 下所有 `ref_id` 必须单引号包裹」：本轮执行在 Git Bash / Python，按 Windows platform skill 不额外包裹字面单引号；本轮没有通过 PowerShell 调用 AX 动作。
* 最小化窗口一律先 `restore`（`commands.jsonl` 中 6 次），**未调用 `focus-window`**；headed 动作导致的窗口最小化是 Windows 常见现象。

### 3.2 逐条结果

| 用例 | 功能 | run 1 | run 2 | 结论 | 关键 AX 摘要 |
|---|---|---|---|---|---|
| F01 | 草稿跨页导航保持 | PASS | PASS | **2x PASS（计入覆盖）** | code=None; after='中文短句测试013CE9' |
| F02 | composer 中文输入与控件 | PASS | PASS | **2x PASS（计入覆盖）** | matches=1; role=menubutton |
| F03 | 流式消息/工具披露/引用 | - | - | SKIP（不计入） | Phase 2 无安全 synthetic model/MCP fixture |
| F04 | 消息虚拟列表与滚动记忆 | - | - | SKIP（不计入） | Phase 2 无安全 fixture |
| F05 | 模型选择 | BLOCKED | BLOCKED | BLOCKED（不计入） | nodes_before=70 nodes_after=70 selectable=[('menuitem', '系统')] |
| F06 | （结构不可达） | - | - | NOT TESTED（不计入） | 结构不可达，按硬规则不测 |
| F07 | 真实 ACP turn / MCP | - | - | SKIP（不计入） | Phase 2 无安全 fixture |
| F08 | 侧栏状态跨进程持久化 | PASS | PASS | **2x PASS（计入覆盖）** | windows=1; target=收起侧边栏 observed=收起侧边栏 states=['checked'] |
| F09 | （结构不可达） | - | - | NOT TESTED（不计入） | 结构不可达，按硬规则不测 |
| F10 | 设置搜索 | PASS | PASS | **2x PASS（计入覆盖）** | matches=1; value=None listbox_matches=0 clear_ok=True |
| F11 | 偏好跨进程持久化 | PASS | PASS | **2x PASS（计入覆盖）** | windows=1; target=True after=True states=['checked'] |
| F12 | （结构不可达） | - | - | NOT TESTED（不计入） | 结构不可达，按硬规则不测 |
| F13 | 首次运行/运行时组件/系统权限 | - | - | NOT TESTED（不计入） | 严格达标不承诺，最多 PARTIAL |
| F14 | 单实例/二次启动抽样 | PARTIAL | - | PARTIAL（单次抽样，不计入） | current_windows=1；4 次重启均 windows_after=1（详见 §6） |
| F15 | （结构不可达） | - | - | NOT TESTED（不计入） | 结构不可达，按硬规则不测 |
| F16 | （不在本轮范围） | - | - | NOT TESTED（不计入） | 不在本轮执行清单 |
| F17 | 窄窗口溢出抽样 | PASS | PASS | **2x PASS（计入覆盖）** | bounded_nodes=10; window_bounds={'height': 700.0, 'width': 900.0, 'x': 258.0, 'y': 51.0} sampled_bounded_nodes=10 severe=[] |

### 3.3 关键命令与 JSON 摘要（逐用例）

**F02 composer 输入**（`phase1-F02-run1.json` / `run2.json`）
`find --name 描述任务 --role textfield` → `focus → re-find → type --headed <中文短句>` → `get --property value` 独立回读 → `find --name <token>` 的 `total_matches>=1` 断言可见 → `find --name 更多选项/授权模式` 断言控件存在。两次结果：`value='中文短句测试02C776' method=type --headed matches=1`；`value='中文短句测试025C49' matches=1`。可见文本是 `statictext`（无 `ref_id`），因此可见性断言用 `find.total_matches` 而非带 ref 的过滤结果——这是 harness 修正，不是放宽断言。

**F01 草稿跨页保持**（`phase1-F01-run1.json` / `run2.json`）
`type --headed <token>` → `click 设置` → 断言 `button 返回应用` 存在 → `click 工作` → `get value` 断言草稿仍在。两次：`after='中文短句测试014D08'`、`after='中文短句测试013CE9'`。

**F10 设置搜索**（`phase1-F10-run1.json` / `run2.json`）
`click 设置` → `click 搜索设置...`(button) → 断言同一控件变为 `combobox` → `--headed type "网络"` → `get value == "网络"` → 断言 `listbox 设置搜索结果` 与 `option 网络搜索 网络搜索` 出现 → `click 清除` → 断言结果消失且设置导航恢复。两次各 9 条断言全 OK（`readback='网络'`, `listbox matches=1`, `option matches=1`, `clear_ok=True`）。
注意：**没有把恒存在的 `网络搜索` 分类按钮当作搜索结果**；结果断言指向搜索面板新增的 listbox/option 节点。

**F17 窄窗口溢出抽样**（`phase1-F17-run1.json` / `run2.json`）
`resize-window --width 900 --height 700` → `snapshot complete:true` → 从 `find` 的 per-match `bounds` 采样 10 个内容控件 → 与窗口 bounds 比较，超出 200px 才算严重溢出。两次：`window_bounds={'height':700,'width':900,'x':258,'y':51}`，`sampled_bounded_nodes=10`，`severe_overflow=[]`，随后恢复原尺寸。

**F05 模型选择**（`phase1-F05-run1.json` / `run2.json`）
`find --name 选择模型 --role menubutton` 存在、`click` 投递成功，但 `snapshot` 前后具名节点数均为 70，点击后没有任何 `radio/menuitem/listitem/option/checkbox` 形式的可选模型项（唯一 `menuitem` 是窗口系统菜单）。按计划「无稳定入口则记 BLOCKED」，两次一致 **BLOCKED**，不算 FAIL、不计入覆盖。

**F11 偏好跨进程持久化**（`phase1-F11-run1.json` / `run2.json`）
`click 设置` → `find --name 运行任务时保持系统唤醒 --role switch` → `toggle`（`delivered_verified`）→ 断言 `states.checked` 已翻转 → `agent-desktop close-app "Studio.exe" --force` → 用同一 `ASTER_STUDIO_INSTANCE=win-e2e-01` 的路径 B 重启 → `list-windows` 断言可见主窗恰好 1 个 → 重新 `click 设置` → `find` 断言 `states.checked == target`。两次方向相反、各自独立：

* run1 `WIN1134B4`：`before=True after=False target=False`，重启后 `states=[]`；`w-38470684/38264 → w-17105818/76252`。
* run2 `WIN11D4BE`：`before=False after=True target=True`，重启后 `states=['checked']`；`w-17105818/76252 → w-348261314/68176`。

**F08 侧栏状态跨进程持久化**（`phase1-F08-run1.json` / `run2.json`）
`find 收起侧边栏/展开侧边栏 --role switch` → `toggle` → 断言可访问名翻转 → `close-app --force` → 同实例重启 → `find` 断言重启后控件名仍等于 target。

* run1 `WIN087EFD`：`收起侧边栏 → 展开侧边栏`，重启后 `observed=展开侧边栏 states=[]`；`w-348261314/68176 → w-53939168/36304`。
* run2 `WIN08B48E`：`展开侧边栏 → 收起侧边栏`，重启后 `observed=收起侧边栏 states=['checked']`；`w-53939168/36304 → w-14091248/39756`。

**F14 单实例/二次启动抽样**（`phase1-F14-run1.json`）= **PARTIAL**
本轮 4 次「关闭再启动同实例」每次 `list-windows --app "Studio.exe"` 均 `windows_after=1`；F14 抽样时 `current_windows=1`（`w-14091248` / pid `39756`），并汇总这 4 条 `restart identity` 证据。**未**并发启动第二个实例、**未**触发产品 flock 的 `Claim::Busy` 分支、**未**验证更新通道/清单或退出守卫，因此只记 PARTIAL，不计入覆盖。

### 3.4 Windows 适配差异（与计划 §9 的偏离，均已如实标注）

1. **app 名带 `.exe`**：Windows 上为 `Studio.exe`；`wait --app "Studio"` 会 `APP_NOT_FOUND`，改用 `list-windows --app "Studio.exe"`。
2. **headed 输入与前台限制**：`type` 需 `--headed`（共 9 次）、`focus` 亦 headed（7 次）。计划 §8.3 的 frontmost 限制确实出现：部分 headed 动作返回 `ACTION_FAILED` 且窗口随后最小化。composer 采用 `focus → re-find → type --headed` 主路径，仅当前台拒绝未落地时回退 Windows UIA `set-value`；F01/F02 最终两次都以 `type --headed` 落地并通过独立 AX 回读 + 可见文本断言。
3. **设置搜索改输入路径**：计划建议 `set-value` 优先；已优先尝试，但 Windows UIA 上该 combobox 的 `set-value` 返回 `STALE_REF`（`ValuePattern.SetValue succeeded`、`delivered_unverified`、`retry:"unsafe"`）并销毁控件。按 disposition 不重试 unsafe 写动作，改为 `--headed type`，并**加强**断言为真实结果 listbox + option + 清空恢复。原始 FAIL 保留在 `phase1-F10-run1-initial-setvalue-FAIL.json`。
4. **`--compact` 快照折叠深层 Web 内容**：`snapshot -i --compact` 只暴露 14 个浅层节点，但 `find` 能遍历完整 `Chrome Legacy Window → document:Aster` 内容树。因此 F17 的 bounds 采样改用 `find` 的 per-match `bounds`（早期 `--compact` 树采样为 0，已归档在 `phase1-F17-run1-pre-bounds-sampling.json` 并收紧后重跑）。
5. **`get --property checked` 非法**：合法属性为 `text/value/title/bounds/role/states`；开关状态改用 `find` 的 `states:["checked"]` 与随状态翻转的可访问名（`收起侧边栏` ↔ `展开侧边栏`）。`toggle` 返回 `delivered_verified`。
6. **重启代价与进程模型**：`studio-dev.mjs` 每次启动都跑两次 `cargo build --locked`（约 4–6 分钟），且 `studio.on('exit')` 会 kill dev server。首次 F11 复跑因等待窗口超时 FAIL（`phase1-F11-run1-relaunch-timeout-FAIL.json`），随后把重启类用例放进**单个常驻 Python 进程**（避免 Popen 启动器在父进程退出时被回收）、把窗口等待放宽到冷构建完成，再干净复跑。
7. **无坐标点击**：`commands.jsonl` 中 `mouse-click` / 坐标动作 0 次；未出现 `AMBIGUOUS_TARGET` 需要消歧的场景。

### 3.5 Fail-closed：历史失败与弱证据归档（均未删除）

| 归档文件 | 原因 | 处置 |
|---|---|---|
| `phase1-F10-run1-initial-setvalue-FAIL.json` | `set-value` 在设置搜索 combobox 上 `STALE_REF` | 不重试 unsafe 写动作；改用 `type --headed` 并加强结果断言，干净复跑 2×PASS |
| `phase1-F17-run1-pre-bounds-sampling.json` | `--compact` 树使 `bounded_nodes=0`，溢出抽样未真正测量 | 收紧为 `find` bounds 采样（>=3 个控件），重跑 2×PASS |
| `phase1-F17-run1-timeout-FAIL.json` | `resize-window` 瞬时 `TIMEOUT` | 断言未改；干净独立复跑两次均 PASS |
| `phase1-F11-run1-relaunch-timeout-FAIL.json` | 重启后窗口等待超时（环境构建耗时，非产品断言） | 修正编排的进程生命周期与等待窗口，干净复跑 |

错误码分布（`commands.jsonl`）：`ACTION_FAILED` 24、`STALE_REF` 2、`TIMEOUT` 1；均按 disposition 处理，未放宽任何断言凑绿。

## 4. Phase 2（F03 / F04 / F07）：SKIP

按硬规则「仅当本机已有合成模型/MCP fixture 且能安全启动时执行，否则 SKIP，不临时发明不安全外部服务」做了只读扫描（`phase2-fixture-scan.txt`）：

* 仓库内只有 Playwright/单元测试 fixtures（`apps/studio/tests/e2e/*/fixtures`、`crates/*/fixtures` 等），**没有可安全启动的 synthetic model / MCP fixture**；`synthetic model` / `mock model` / `mcp fixture` 全文检索 0 命中。
* F05 已 BLOCKED（本实例没有配置模型服务，AX 无可选模型项），也印证无法发起真实 ACP turn。
* 结论：**F03 / F04 / F07 = SKIP**，不计入覆盖；未启动任何临时外部服务。

## 5. 截图与证据文件

* `screenshots/phase0-S4-main-window.png` — Phase0 S4 非白屏主窗（1442×952，417893 bytes）。
* `screenshots/probe-f02-after-restore.png`、`screenshots/probe-f02-setvalue.png` — Windows 输入路径探测（restore 后窗口、UIA `set-value` 写入可见）。
* `phase0-*.json`、`phase1-*.json`、`ax-*.json`、`f05-census.json`、`probe-*.json`、`probe-toggle.json` — AX JSON 证据。
* `build-context.log`、`launch-1.log`、`launch-restart.log`、`phase2-fixture-scan.txt`、`compliance-audit.txt`、`commands.jsonl` — 环境/命令证据。
* `drive.py`、`restart_cases.py`、`probe-ax.py`、`probe-toggle.py` — 编排与探测脚本（非产品代码）。

## 6. 窗口与进程标识汇总

| 阶段 | window-id | pid | 证据 |
|---|---|---|---|
| 首次启动 / Phase 0 | `w-85395480` | `37164` | `phase0-S1-window.json` |
| F01 run1 用例结束时 | `w-85395480` | `37164`（首次实例） | `phase1-F01-run1.json` |
| F01 run2 用例结束时 | `w-85395480` | `37164`（首次实例） | `phase1-F01-run2.json` |
| F02 run1 用例结束时 | `w-85395480` | `37164`（首次实例） | `phase1-F02-run1.json` |
| F02 run2 用例结束时 | `w-85395480` | `37164`（首次实例） | `phase1-F02-run2.json` |
| F05 run1 用例结束时 | `w-85395480` | `37164`（首次实例） | `phase1-F05-run1.json` |
| F05 run2 用例结束时 | `w-85395480` | `37164`（首次实例） | `phase1-F05-run2.json` |
| F08 run1 用例结束时 | `w-53939168` | （见下方重启行） | `phase1-F08-run1.json` |
| F08 run1 重启后新主窗 | `w-53939168` | `36304` | `before=[('w-348261314', 68176)] after=(w-53939168,36304) windows_after=1` |
| F08 run2 用例结束时 | `w-14091248` | （见下方重启行） | `phase1-F08-run2.json` |
| F08 run2 重启后新主窗 | `w-14091248` | `39756` | `before=[('w-53939168', 36304)] after=(w-14091248,39756) windows_after=1` |
| F10 run1 用例结束时 | `w-85395480` | `37164`（首次实例） | `phase1-F10-run1.json` |
| F10 run2 用例结束时 | `w-85395480` | `37164`（首次实例） | `phase1-F10-run2.json` |
| F11 run1 用例结束时 | `w-17105818` | （见下方重启行） | `phase1-F11-run1.json` |
| F11 run1 重启后新主窗 | `w-17105818` | `76252` | `before=[('w-38470684', 38264)] after=(w-17105818,76252) windows_after=1` |
| F11 run2 用例结束时 | `w-348261314` | （见下方重启行） | `phase1-F11-run2.json` |
| F11 run2 重启后新主窗 | `w-348261314` | `68176` | `before=[('w-17105818', 76252)] after=(w-348261314,68176) windows_after=1` |
| F14 run1 用例结束时 | `w-14091248` | `37164`（首次实例） | `phase1-F14-run1.json` |
| F17 run1 用例结束时 | `w-85395480` | `37164`（首次实例） | `phase1-F17-run1.json` |
| F17 run2 用例结束时 | `w-85395480` | `37164`（首次实例） | `phase1-F17-run2.json` |

## 7. 合规审计

`commands.jsonl` 全量记录每条 `agent-desktop` 调用（case / run / 命令 / `ok` / `error_code` / `snapshot_id`）。主要命令计数：`list-windows`、`find`、`get`、`clear`、`click`、`type`、`resize-window`、`snapshot`、`focus`、`restore`、`set-value`、`press`、`toggle`、`close-app`。

* `mouse-click` / 坐标动作：**0**
* `focus-window`：**0**（最小化一律 `restore`）
* Playwright / runtime 桩：**0**
* `--headed`：**16**（7 `focus` + 9 `type`），均为 Windows 必需的自然输入路径
* 主断言来源：`snapshot/find/get/is/click/toggle/...` 的 AX JSON；磁盘/hash/日志仅作环境证据。

## 8. 收尾

### 8.1 应用 / 窗口 / 端口

`--case ALL` 批次结束后，由该批次启动的 `studio-dev.mjs` 随父 Python 进程退出，`Studio.exe` 自行结束。补发 `agent-desktop close-app "Studio.exe" --force` 返回 `APP_NOT_FOUND`（`disposition: not_delivered / retry: safe`，即已无目标进程）；复查：

* `agent-desktop list-windows --app "Studio.exe"` → `{"ok":true,"data":[]}`
* `netstat -ano | grep 127.0.0.1:4318` → 无监听

因此本测试占用的窗口、进程与端口 `4318` 已全部释放；**未结束任何用户无关进程**，未做批量删除。

### 8.2 用户 WIP 恢复（回到执行前状态）

```bash
git -C apps/studio checkout --detach 07ffdfcf56f8a2a21efce49be17ed4aaf3142cbb
git -C apps/studio stash pop stash@{0}
```

* `HEAD is now at 07ffdfcf5 Merge pull request #10 ...`；`Dropped stash@{0} (6096098a089d289abec8a1b88ab98a30a78904ea)`。
* 复查 `git -C apps/studio status --short` → ` M src-tauri/src/agent_plane/reasoning_effort.rs`；`git diff --stat` → `1 file changed, 39 insertions(+)`，与 `user-wip-reasoning_effort.patch`（sha256 `ae7f4036…`）一致。
* 父仓 `git status --short` → ` M apps/studio`（子模块指针恢复为执行前值）、`?? docs/evidence/studio/2026-11-14-windows-agent-desktop-e2e/`（本轮新增证据）。
* 用户原有的 `stash@{1..}` 未改动。

> 说明：`target\studio\aster\debug\Studio.exe` 仍是本轮按 gitlink `944864f2` / 干净树构建出的二进制（sha256 `3d60401b…`）；源码工作树已恢复用户原始状态。若后续继续开发，请按需重新构建。

### 8.3 证据保留

证据目录内所有 JSON、日志、截图、脚本、模板（`OUTCOME.template.md`）与 **4 份 FAIL / 弱证据归档**均保留，未删除、未改写历史失败结论。`commands.jsonl` 记录全部 `agent-desktop` 调用。

## 9. Explicitly not claimed

* **不声称** F06 / F09 / F12 / F15 的任何覆盖——按计划结构不可达，本轮按要求完全不测。
* **不声称** F13 严格达标——本轮未执行 F13，最多只能按计划记 PARTIAL，且不承诺。
* **不声称** F14 严格达标：仅做「二次启动后仍为单主窗」的 AX 抽样（PARTIAL），**不声称** 产品 flock / `Claim::Busy` 分支、更新通道/清单、退出守卫（`MainExitGuard`）被验证。
* **不声称** F05 模型选择覆盖——BLOCKED（无可选模型 AX 入口/无配置模型服务）。
* **不声称** F03 / F04 / F07 覆盖——SKIP（无安全 fixture）。
* **不声称** F01 / F02 / F10 / F17 是「完整功能覆盖」：本轮只执行本计划规定的抽样/子集断言。F02 覆盖中文输入回读 + 控件存在，**未**覆盖斜杠命令、附件、队列；F10 覆盖设置搜索输入/真实结果/清空恢复，**未**覆盖命令面板、深链、快捷键、空态文案；F17 仅窄窗口 resize + 溢出抽样，**未**覆盖 100/125/200% 缩放矩阵与主题切换；F01 仅草稿跨页往返，**未**覆盖空草稿不落盘、切 Tab 状态保持。
* **不声称** 磁盘 / HTTP / ACL 回读等价于 UI 断言：本轮未使用 ACL 作为断言，ACL/日志/hash 全部只作环境证据。
* **不声称** 修改过产品代码；未改动 `Cargo.lock`、未放宽 `--locked`、未放宽任何断言。
* **不声称** 任何覆盖率数字或「x/17」结论；本文件不预支 MATRIX 的统计口径，也不把历史 Playwright/runtime 桩结果计入本轮。
