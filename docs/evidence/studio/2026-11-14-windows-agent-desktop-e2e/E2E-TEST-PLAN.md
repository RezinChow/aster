# Aster Studio · agent-desktop 可视化端到端测试计划（整合版 / Windows 可执行）

| 项 | 值 |
|---|---|
| 文档类型 | **可执行测试计划（runbook）**，不是规划稿、不是结果报告 |
| 版本 / 日期 | v1.0 / 2026-11-14 |
| 适用平台 | Windows（关键处标注 macOS 差异） |
| 工具版本 | `agent-desktop` **1.2.0**（命令参数已于本日逐条 `--help` 复核） |
| 口径来源 | `docs/evidence/studio/2026-11-12-business-function-coverage/MATRIX.md`（F01–F17 分母）<br>`.../AGENT-DESKTOP-E2E-PLAN.md`（规划基线、用例规格） |
| 实测基线 | 同目录 `OUTCOME.md`（2026-11-14 Windows 执行结果） |
| 被测对象 | `target\studio\aster\debug\Studio.exe`，必须为本 checkout 构建 |
| 编排 harness | 同目录 `drive.py`、`restart_cases.py`、`probe-ax.py`、`probe-toggle.py`（**编排脚本，非桩套件**） |

> 本计划把 F01–F17 台账口径、本轮 Windows 真实命令序列、AX 断言、平台踩坑、判定规则与落证规范固化为一份**照着就能跑**的文档。所有命令均取自本轮实测或本日 `--help` 复核，未经验证的写法不写入。
>
> **占位符约定**：命令模板中的 `<id>` / `<ref>` / `<EV>` / `<path>` 与命名规范中的 `<Fxx>` / `<n>` 是**运行时变量**（window-id、AX ref、证据目录绝对路径、截图路径、功能编号、复跑序号），执行时替换为实际值；它们不是未完成的 TODO。具体取值见 §2.1、§4 与 §8.2。

---

## 0. 文档定位与阅读顺序

| 文档 | 角色 | 何时读 |
|---|---|---|
| `MATRIX.md` | **口径与分母**：F01–F17 共 17 条、最低执行面、什么不计覆盖 | 开始前定口径 |
| `AGENT-DESKTOP-E2E-PLAN.md` | **规划基线**：可测性分类 A/B/C/D、§9 用例规格、§10 数字路径 | 设计用例时 |
| **本文件** | **执行 runbook**：门槛 → 冒烟 → 用例 → 判定 → 落证 → 收尾 | 每一轮复跑时 |
| `OUTCOME.md` | **结果**：本轮 Windows 实测的结论、证据、失败归档 | 对账与复盘时 |

旧 `AGENT-DESKTOP-E2E-PLAN.md` 是 macOS 视角的「覆盖率提升规划」，含大量待裁决与已失效的 macOS 阻塞项，**不适合直接照跑**；本文件不改动它，只在其口径上补齐可执行性。

---

## 1. 目标、范围与判定口径

### 1.1 目标

在**真实 Tauri 窗口**上，仅用 `agent-desktop` 的 AX 观察/动作能力，对 F01–F17 中可测功能做可视化端到端验证；每条计入覆盖的用例独立复跑 2 次 PASS；产出自洽、可审计的 `OUTCOME.md` 与证据集。**不改产品、不改口径凑绿**。

### 1.2 硬规则（不可放宽）

1. 只测本 checkout 构建出的 `Studio.exe`；构建前后记录 mtime / size / sha256。
2. **主断言必须来自 AX**（`snapshot` / `find` / `get` / `is` / `click` / `toggle` / … 的 JSON envelope）。磁盘 hash、日志、HTTP、ACL、进程列表只能作 evidence。
3. 禁止坐标点击、`mouse-click`、`focus-window` 作为常规动作；禁止 Playwright / runtime 桩冒充结果。
4. PowerShell 下所有 `ref_id` 用**单引号**包裹；Git Bash / Python 下不额外包字面引号。
5. Windows 上 `type` 需 `--headed`；设置类输入框优先尝试 `set-value`，失败按 disposition 降级（见 §5.4）。
6. 每条计入覆盖的用例必须**独立复跑 2 次 PASS**；FAIL fail-closed。
7. 不测 F06 / F09 / F12 / F15（结构不可达）；F13 / F14 最多 PARTIAL，不承诺严格达标。
8. 不杀用户无关进程；只清理 Aster/Studio 窗口与本测试占用端口。

### 1.3 判定口径（逐用例）

| 结论 | 定义 | 是否计入覆盖 |
|---|---|---|
| **PASS** | 全部 AX 主断言成立，且**两次独立复跑**均成立 | ✅ 计入 |
| **FAIL** | 任一 AX 主断言不成立；fail-closed，归档保留，禁止放宽断言或改判定凑绿 | ❌ 不计 |
| **BLOCKED** | AX 入口稳定存在，但产品/环境未提供任何可断言对象（如 F05 无可选模型项） | ❌ 不计（不算 FAIL） |
| **PARTIAL** | 只完成抽样/子集断言，不承诺严格达标（F13 / F14 上限） | ❌ 不计 |
| **SKIP** | 前置条件不满足（如无安全 fixture），用例不执行 | ❌ 不计 |
| **NOT TESTED** | 按硬规则排除（结构不可达 / 不在本轮清单） | ❌ 不计 |

> **「独立复跑」= 重新取 `ref_id`、使用新 token、重新走完整动作链**，不是同一 snapshot 上重复断言。重启类用例还须是**新的应用进程与 window-id**。

### 1.4 不预支统计

本计划不产出「x/17」覆盖率数字，也不把历史 Playwright / Gate A / runtime 桩结果计入。是否计入 MATRIX 台账由口径裁决决定，不在执行侧。

---

## 2. 被测对象与依赖

### 2.1 环境

| 依赖 | 实测值 / 要求 |
|---|---|
| 仓库根 | `D:\code\aster` |
| 构建产物 | `D:\code\aster\target\studio\aster\debug\Studio.exe`（本轮基线：162131968 bytes，sha256 `3d60401b9aa25ccf8436c563c0606e8080be7fb15986faaa9ba219e864b566bb`，2026-11-14 08:14:41 +0800） |
| `agent-desktop` 可执行文件 | `C:\Users\admin\.workbuddy\binaries\node\versions\22.22.2-6\node_modules\agent-desktop\bin\agent-desktop-win32-x64.exe` |
| `node` | `C:\Users\admin\.workbuddy\binaries\node\versions\22.22.2-6\node.exe` |
| `python3` | 3.13.x，须能 `python3 -c "print(1)"` |
| 应用名 | **`Studio.exe`**（Windows 带 `.exe`；`--app "Studio"` 会 `APP_NOT_FOUND`） |

### 2.2 启动环境变量

```bash
ASTER_TENANT_SLUG=aster
STUDIO_RENDERER_DEV=1
ASTER_STUDIO_INSTANCE=win-e2e-01
STUDIO_RENDERER_PORT=4318
```

`ASTER_STUDIO_INSTANCE` 决定偏好/会话的隔离 profile，**重启类用例必须保持一致**，否则 F08 / F11 的状态回读无效。

### 2.3 启动方式口径说明

本计划遵循本轮 Windows 硬规则：由 **路径 B**（`node scripts/studio-dev.mjs`）或路径 A（`just studio`）启动本 checkout 产物，`agent-desktop` 承担**全部 GUI 观察/动作/断言**。进程启动/关闭属环境准备，不作断言。

> 与 macOS 旧口径（要求 `agent-desktop launch` 启动）存在张力，见 §11 待裁决项。本计划**不**把 `launch` 设为硬门槛，理由：需带齐上表环境变量且必须保证被测对象是本 checkout 刚构建的二进制。

---

## 3. Gate 0 — 启动前门槛（任一项失败则停止并写 OUTCOME）

| # | 检查 | 命令 | 通过标准 | 失败动作 |
|---|---|---|---|---|
| 1 | 工具健康 | `agent-desktop status` | `ok:true`、`platform:"windows"`、`version:"1.2.0"`、`permissions.accessibility.state:"granted"` | 停止，报告权限阻塞 |
| 2 | Python | `python3 -c "print(1)"` | 输出 `1` | 停止，报告 PATH 问题，不硬跑 |
| 3 | gitlink / WIP | `git -C apps/studio status --short` | 子模块尽量对齐父仓 gitlink | 见 §3.1 |
| 4 | 构建 | 仓库根 `just build-studio` | 成功且 `Studio.exe` 为新构建 | 见 §3.2；**不得**放宽 `--locked` |
| 5 | 启动 | 路径 A/B，带齐 §2.2 变量 | 主窗出现，dev server `127.0.0.1:4318` 就绪 | 停止 |
| 6 | 定位主窗 | `agent-desktop list-windows --app "Studio.exe"` | 记录 `app_name` / `title` / `id` / `pid` / `visible` / `bounds` | 停止 |
| 7 | 快照与首启弹窗 | `agent-desktop snapshot -i --compact --app "Studio.exe" --window-id <id>` | `complete:true`；若有 dialog 用 `find` + `click` 关掉 | 停止 |

### 3.1 门槛 3：gitlink 对齐与用户 WIP 保护（强制顺序）

父仓 `Cargo.lock` 记录 `aster-studio 0.2.3`，而子模块旧 HEAD `07ffdfcf5` 的 `src-tauri/Cargo.toml` 为 `0.2.2`，父仓 gitlink 为 `944864f2775fd75609ea811f28b96e7b96b27552`。版本不一致会让 `--locked` 构建失败。

```bash
# 1) 先保全用户 WIP（绝不丢弃）
git -C apps/studio diff > <EV>/user-wip-reasoning_effort.patch
sha256sum <EV>/user-wip-reasoning_effort.patch
# 2) stash
git -C apps/studio stash push -m "win-e2e: preserve WIP before gitlink align"
# 3) 按父仓 gitlink 对齐（干净树）
git -C apps/studio checkout --detach 944864f2775fd75609ea811f28b96e7b96b27552
```

**收尾必须恢复**（§10.2）：`checkout --detach 07ffdfcf5` → `stash pop`，并用 patch sha256 与 `git diff | sha256sum` 逐字节比对。

### 3.2 门槛 4：构建

只在仓库根执行 `just build-studio`。若报 `cannot update the lock file ... because --locked was passed to prevent this`，根因是 §3.1 的版本不一致，**不要改 `Cargo.lock`、不要去掉 `--locked`**，而是完成 gitlink 对齐后重建。记录构建前后 hash 到 `build-context.log`。

### 3.3 门槛 5：启动（路径 B）

```bash
cd /d/code/aster/apps/studio
ASTER_TENANT_SLUG=aster STUDIO_RENDERER_DEV=1 \
ASTER_STUDIO_INSTANCE=win-e2e-01 STUDIO_RENDERER_PORT=4318 \
node scripts/studio-dev.mjs > <EV>/launch-1.log 2>&1
```

> ⚠️ `studio-dev.mjs` **每次启动执行两次 `cargo build --locked`**（本轮约 4–6 分钟），且 `studio.on('exit')` 会 kill dev server。这是重启类用例耗时的根因，直接决定 §5.2 的单进程编排设计。

---

## 4. Phase 0 — 冒烟（S0–S4 全绿才继续）

| 项 | 断言 | 具体命令 | 通过标准 | 证据文件 |
|---|---|---|---|---|
| S0 | 工具与应用枚举 | `status`；`list-apps --app "Studio.exe"` | `ok:true`，含 `{"name":"Studio.exe","pid":…}` | `phase0-S0-status.json`、`phase0-S0-list-apps.json` |
| S1 | 主窗可见 | `list-windows --app "Studio.exe"` | `visible:true`、`minimized:false`，记录 `id`/`pid` | `phase0-S1-window.json` |
| S2 | 快照完整 + composer 可见 | `snapshot -i --compact …`；`find --name "描述任务"` | `complete:true`；`total_matches>=1`（textfield 带 `ref_id`，statictext 无） | `phase0-S2-*.json` |
| S3 | 无首启弹窗 | `find --name "继续"/"稍后设置"/"跳过"/… --exact` | dialog 相关命中 0；若非 0 则 `find`+`click` 关闭 | `phase0-S3-dialogs.json` |
| S4 | 截图非白屏 | `screenshot <EV>/screenshots/phase0-S4-main-window.png --app "Studio.exe" --window-id <id>` | PNG 有效，目视可见侧栏「新建任务/连接器/技能/自动化/项目/最近」、Aster 标题、composer、「选择模型」 | `phase0-S4-screenshot.json` + png |

补充（强烈建议）：做一次工作台 / 设置页 AX 控件普查，产出 `ax-census.json`、`ax-settings-census.json`，确认关键控件可访问名稳定：

`textfield 描述任务…`、`menubutton 更多选项`、`menubutton 授权模式: 请求批准`、`menubutton 选择模型`、`switch 收起侧边栏`、`button 设置`、`button 搜索设置...`、`switch 运行任务时保持系统唤醒`。

---

## 5. 执行架构与 harness 约定

### 5.1 编排 harness 不是桩套件

`drive.py` / `restart_cases.py` 串行调用同一个 `agent-desktop-win32-x64.exe` CLI；**所有观察、动作、断言都是 AX 命令**。唯一的非 AX 操作是进程生命周期（`close-app --force` 本身也是 agent-desktop 命令 + 重新 Popen `studio-dev.mjs`），属环境准备。

核心封装（`drive.py:42-59`）：

```python
def ax(self, *args, timeout=90):
    p = subprocess.run([EXE, *args], capture_output=True, text=True,
                       timeout=timeout, encoding="utf-8")
    d = json.loads(p.stdout)
    data = d.get("data")
    snap_id = data.get("snapshot_id") if isinstance(data, dict) else None
    # append {case, run, cmd, ok, error_code, snapshot_id} to commands.jsonl
    return d
```

> 注意 `list-windows` 的 `data` 是 **list** 而非 dict，`snapshot_id` 提取必须做 `isinstance(data, dict)` 保护。
>
> 另一处实现细节：`drive.py` 的 `find(name, role=...)` **只把 `--name` 传给 CLI**，`role` 是在 Python 侧对 `matches[]` 做本地过滤；CLI 本身支持 `--role`（见附录 A），两者等价。本计划 §6 的动作序列按 CLI 语义书写，照 `drive.py` 实现时不要误以为漏传了参数。

### 5.2 重启类必须单常驻 Python 进程

`studio-dev.mjs` 由 Popen 启动时会随父 Python 退出被回收；首次 F11 复跑因此 `relaunch timeout` FAIL（已归档）。因此 `restart_cases.py` 用**一个常驻进程**跑完整批次：

```python
ALL_ORDER = [("F11", 1), ("F11", 2), ("F08", 1), ("F08", 2), ("F14", 1)]
# _launch(): Popen(..., CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS)
# restart(): close-app --force -> 等窗口消失(60s) -> _launch -> wait_window(attempts=600) -> wait_content(90s)
```

窗口等待必须按**冷增量构建**留足预算（600 次 × 1s）。

### 5.3 ref 生命周期与 disposition

- 每次动作前重新 `find` / `snapshot` 取新鲜 `ref_id`；`STALE_REF` → 重取 ref 后再试。
- 顶层 `error.code` 与 `data.disposition.delivery` / `retry` 联合判断：**仅 `not_delivered` + `retry: safe` 可安全重试**；`delivered_unverified` / `retry: unsafe` **绝不盲重试写动作**（可能已落地）。
- composer 用 `focus → re-find → type --headed`（focus 会使旧 ref 失效）；前台被拒时回退 `set-value`，但**断言始终用独立 AX 回读**，不依赖动作 envelope 的 `ok`。
- `clear` 视为 best-effort restore，用独立 `get value` 判定状态，不把 `post_action_verification` 当 FAIL。

### 5.4 输入路径决策树（Windows 实测）

| 控件 | 首选 | 实测结果 | 兜底 |
|---|---|---|---|
| composer（contenteditable） | `--headed focus` → 重取 ref → `--headed type` | 本轮 F01/F02 共 9 次 `type --headed` 落地成功 | 前台 `ACTION_FAILED` 时用 UIA `set-value`，并独立 AX 回读 |
| 设置搜索 combobox | `set-value`（按硬规则优先尝试） | **本轮失败**：`STALE_REF` + `delivered_unverified` + `retry:"unsafe"`，控件被销毁 | 改 `--headed type "网络"`，并**加强**断言为真实结果节点 |
| 开关 switch | `toggle` | `delivered_verified` | 状态读 `find.states` / `is --property checked`，**不用** `get --property checked`（非法） |

> ⚠️ 与旧 macOS 规划相反：旧文档说「设置搜索 combobox `set-value` 成功、`type` 失败」，Windows 1.2.0 实测恰好反过来。照旧文档跑会踩 `STALE_REF`。

### 5.5 常用命令模板

```bash
# ---- 观察（只读）----
agent-desktop status
agent-desktop list-apps --app "Studio.exe"
agent-desktop list-windows --app "Studio.exe"
agent-desktop snapshot -i --compact --app "Studio.exe" --window-id <id> \
  --max-depth 40 --timeout-ms 30000
agent-desktop find --app "Studio.exe" --window-id <id> --name "描述任务" --exact
agent-desktop get '@<snapshot_id>:eN' --property value      # text|value|title|bounds|role|states
agent-desktop is  '@<snapshot_id>:eN' --property checked    # visible|enabled|checked|focused|expanded|selected

# ---- 动作 ----
agent-desktop click '@<ref>'
agent-desktop toggle '@<ref>'
agent-desktop --headed focus '@<ref>'
agent-desktop --headed type  '@<ref>' "中文短句"
agent-desktop set-value '@<ref>' "文本"
agent-desktop clear '@<ref>'
agent-desktop press escape --app "Studio.exe"
agent-desktop resize-window --app "Studio.exe" --window-id <id> --width 900 --height 700
agent-desktop restore --app "Studio.exe"          # 最小化窗口必须先 restore，不用 focus-window
agent-desktop close-app "Studio.exe" --force
agent-desktop screenshot <path>.png --app "Studio.exe" --window-id <id>
```

`--headed` 亦可置于子命令参数之后；本轮 harness 采用**前置**形式（`agent-desktop --headed type …`），实测有效。

PowerShell 下 ref 必须用字面单引号：

```powershell
agent-desktop get '@s3h9txvntjxf6:e12' --property value
```

### 5.6 AX 断言的两条易错规则

1. **可见文本是 `statictext`，没有 `ref_id`**：可见性断言必须用 `find … --name <token>` 的 `data.total_matches`，不能过滤带 ref 的 `matches`（曾导致 F02 run1 误 FAIL）。
2. **`snapshot --compact` 折叠深层 Web 内容**：本轮只暴露 14 个浅层节点，但 `find` 能遍历完整 `Chrome Legacy Window → document:Aster` 树。几何/bounds 采样必须用 `find` 的 per-match `bounds`，不要用 compact 树。

---

## 6. 逐功能用例规格（F01–F17）

统一前置：Gate 0 全绿 + Phase 0 全绿 + `commands.jsonl` 已开启记录。统一模板：环境准备 → 数据准备（不作断言）→ AX 动作链 → **独立 AX 回读断言** → 还原 → 核对清洁。

### 6.1 A 类 — 直接可测（本轮已执行）

| ID | 动作序列（真实命令） | 主断言（AX） | 本轮基线 |
|---|---|---|---|
| **F02** composer 输入 | `to_workbench()` → `find --name 描述任务 --role textfield` → `--headed focus` → 重取 ref → `--headed type <中文 token>` | ① `get --property value` 含 token ② `find --name <token>` 的 `total_matches>0`（可见文本） ③ `更多选项`/`授权模式` menubutton 存在 | 2×PASS |
| **F01** 草稿跨页 | `type --headed <token>` → `click 设置`(button) → `find 返回应用`(button) → `click 工作`(button) → `get value` | 往返后 composer value 仍含 token | 2×PASS |
| **F10** 设置搜索 | `click 设置` → `click 搜索设置...`(button) → 断言同控件变 `combobox` → `--headed type "网络"` → `click 清除`(button) | ① `get value == "网络"` ② `find --name "设置搜索结果"` listbox 出现 ③ `find --name "网络搜索 网络搜索"` option 出现 ④ 清除后值改变、listbox 消失、`--exact "网络搜索"` 分类按钮重现 | 2×PASS |
| **F17** 窄窗口溢出 | `resize-window --width 900 --height 700` → `snapshot complete` → 对 13 个具名控件逐个 `find` 取 `bounds` | ① `complete:true` ② `bounded_nodes>=3` ③ 超出窗口右/下边界 200px 以上的 `severe_overflow == []` ④ 恢复原尺寸 | 2×PASS |
| **F05** 模型选择 | `find --name 选择模型 --role menubutton` → `snapshot` 计具名节点 → `click` → `snapshot` 再计数 → 收集 `radio/menuitem/listitem/option/checkbox` | 入口存在 + 点击投递成功；若点击后**无任何可选模型节点** → **BLOCKED**（非 FAIL） | 2×BLOCKED（`nodes_before=70 nodes_after=70`，唯一 menuitem 是系统菜单） |
| **F11** 偏好跨进程持久化 | `click 设置` → `find 运行任务时保持系统唤醒 --role switch` → `toggle` → 断言 `states.checked` 翻转 → `close-app --force` → 同实例重启 → `list-windows` → 重新 `click 设置` → `find` 回读 | ① `toggle` 投递 ② 重启前状态 == target ③ 重启后可见主窗恰好 1 个 ④ 重启后 `states.checked == target`；**两次方向相反** | 2×PASS |
| **F08** 侧栏跨进程持久化 | `find 收起侧边栏/展开侧边栏 --role switch` → `toggle` → 断言可访问名翻转 → `close-app --force` → 同实例重启 → `find` 回读 | 重启后控件名 == target（两次方向相反） | 2×PASS |

**F10 特别提醒**：`网络搜索` 是**恒存在**的设置分类按钮，绝不能当作搜索结果。结果断言必须指向搜索面板新增的 `设置搜索结果` listbox 与 `网络搜索 网络搜索` option（旧实现曾因此误判 PASS，已归档 FAIL）。

**F17 特别提醒**：`--compact` 树采样会得到 `bounded_nodes=0` 的「弱 PASS」，必须改用 `find` per-match bounds；本轮弱证据归档在 `phase1-F17-run1-pre-bounds-sampling.json`。

### 6.2 B 类 — 需 fixture（本轮 SKIP）

| ID | 前置准备 | 用例与 AX 主断言 | 本轮 |
|---|---|---|---|
| **F03** 流式消息/工具披露/引用 | 合成模型发起一次真实 turn | `find aria-busy` 状态迁移、`find Stop` 按钮、终态不重放、聚合行、引用可跳转 | SKIP |
| **F04** 虚拟列表与滚动记忆 | 造 >100 条消息会话 | `scroll --direction down` → 切走切回 → `get --property bounds` + `find.total_matches` 断言位置恢复与节点回收 | SKIP |
| **F07** 真实 ACP turn / MCP | synthetic MCP 实例 | UI 发起任务 → `find` 回执；磁盘/HTTP 回读**仅作 evidence** | SKIP |

**执行前置（只读扫描，不得临时发明不安全外部服务）**：

```bash
# 输出 phase2-fixture-scan.txt
grep -RniE "synthetic model|mock model|mcp fixture" apps/studio/tests crates | head -50
ls apps/studio/tests/e2e/*/fixtures
```

本轮结论：仓库内只有 Playwright / 单元测试 fixtures，**无可安全启动的 synthetic model / MCP fixture**；F05 已 BLOCKED 也印证无法发起真实 turn → 三条 SKIP。若后续具备 fixture，必须在 OUTCOME 明确「fixture 仅作前置准备，所有断言仍在 AX 层」。

### 6.3 C 类 — PARTIAL 上限（不做严格达标承诺）

| ID | 允许做的 | 明确不做的 | 本轮 |
|---|---|---|---|
| **F13** 首启/运行时组件/系统权限 | 最多抽样首启链路 | 不承诺「3 个 runtime 组件」（产品只装 1 个 required，`/settings/dependencies` 隐藏） | NOT TESTED |
| **F14** 更新/退出守卫/单实例 | `list-windows` 单主窗抽样 + 汇总重启 identity | **不声称** flock / `Claim::Busy`、更新通道/清单、`MainExitGuard` | PARTIAL（1 次，`current_windows=1`，4 次重启均 `windows_after=1`） |

### 6.4 D 类 — 结构不可达（按硬规则不测）

| ID | 不可达原因 |
|---|---|
| **F06** | 批准/拒绝按钮存在，但 synthetic ACP 不发 `session/request_permission`，`pendingApprovals` 恒空；「两次终态可区分」须读后端 part 状态 |
| **F09** | 真窗口 `find --role tab` = 0，无工作区标签控件；detach/焦点需 `focus-window`（本计划禁止） |
| **F12** | 「保存到文档」按钮存在，但验收要求校验**真实物理字节**，office harness 自认内存文件边界，主断言必须落磁盘 |
| **F15** | `recordingControl` 硬编码 `null`、`/settings/screenshot` 隐藏、`screencapture -i` 需物理鼠标 |

### 6.5 可选扩展（本轮未纳入）

**F16** 错误态/离线/崩溃恢复/无障碍：旧规划列 P1 可写的 UI 子集（`find` 空/加载/重试/离线文案 → `is --property focused` → `snapshot --surface alert`；断言文案固定 locale、焦点返回、`name/role/value` 完整），L3 抽样（崩溃恢复草稿）需产品改造（本轮 macOS 实测 `NOT_PERSISTED`）。本轮清单未包含 F16，记 NOT TESTED；后续补跑时按 A 类模板新增 `case_F16`。

---

## 7. Windows 适配差异与踩坑清单

| # | 现象 | 处置 |
|---|---|---|
| 1 | app 名带 `.exe`；`wait --app "Studio"` → `APP_NOT_FOUND` | 统一 `--app "Studio.exe"`；用 `list-windows` 而非 `wait --event window-opened`（后者会捕获无关 PowerShell 窗） |
| 2 | headed 动作可能返回 `ACTION_FAILED` 且随后窗口最小化 | 一律先 `restore` 再 screenshot / 后续动作；**不用** `focus-window` |
| 3 | 设置搜索 combobox 的 `set-value` → `STALE_REF` | 按 disposition 不重试 unsafe；改 `--headed type` 并加强结果断言（见 §5.4） |
| 4 | `snapshot -i --compact` 只给 14 个浅层节点 | 内容树用 `find`；bounds 用 `find` per-match `bounds` |
| 5 | `get --property checked` 非法 | 合法属性仅 `text/value/title/bounds/role/states`；开关状态读 `find.states` 或 `is --property checked`，也可用随状态翻转的可访问名 |
| 6 | `studio-dev.mjs` 每次启动两次 `cargo build --locked`（4–6 min） | 重启批次用单常驻 Python 进程 + `wait_window(attempts=600)` |
| 7 | renderer 日志含 `IPC route is not available: backup.get_auto_sync_state`、bundled catalog warning | 非致命，仅作环境证据，不替代 UI 断言 |
| 8 | Git Bash / Python 里给 ref 加字面单引号 → `INVALID_ARGS` | 单引号规则**仅 PowerShell**；其余环境直接传 ref |
| 9 | 长用例被前台工具 30s 钩子中断 | 用后台执行 + stdout 日志（如 `phase1-ALL.stdout.log`），再回收结果 |

### 7.1 与旧规划文档的参数偏差（已按 `--help` 复核）

| 旧文档写法 | 实际 1.2.0 Windows | 说明 |
|---|---|---|
| `find --count` | **无 `--count` 参数** | `find` 返回 `data.total_matches` 与 `data.matches[]` |
| `get --property checked` | **非法** | `get` 仅 `text/value/title/bounds/role/states`；`checked` 属于 `is --property` |
| 「设置搜索 `set-value` 成功、`type` 失败」 | **相反** | Windows 上 `set-value` → `STALE_REF`，`type --headed` → `delivered_verified` |
| 「`type --headed` 被 frontmost 系统级阻塞」 | Windows 本轮 9 次成功 | macOS TCC / `/bin/ps` 阻塞是平台特有，不迁移到 Windows |
| `snapshot --include-bounds` 为唯一几何来源 | 另有 `find` per-match `bounds` | 深层 Web 内容必须用后者 |

---

## 8. 执行顺序与复跑矩阵

### 8.1 顺序

```
Gate 0（7 项）→ Phase 0（S0–S4）→ B1 非重启 run1 → B2 非重启 run2
→ B3 重启批次（单常驻进程）→ B4 Phase 2 只读 fixture 扫描 → 收尾 → 写 OUTCOME
```

### 8.2 复跑矩阵（从**仓库根**执行，避免路径重复拼接）

```bash
D=docs/evidence/studio/2026-11-14-windows-agent-desktop-e2e

# B1 / B2：非重启用例，各自独立 token 与 ref
python3 "$D/drive.py" --case ALL --run 1 | tee "$D/phase1-nonrestart-run1.stdout.log"
python3 "$D/drive.py" --case ALL --run 2 | tee "$D/phase1-nonrestart-run2.stdout.log"
# 或按 --case F01|F02|F05|F10|F17 单条跑，便于隔离失败

# B3：重启批次（务必后台 + 日志，单次约 50–60 分钟）
python3 "$D/restart_cases.py" --case ALL > "$D/phase1-ALL.stdout.log" 2>&1
# 内含 F11×2 / F08×2 / F14×1；期望 ALL RESULTS: ["PASS","PASS","PASS","PASS","PARTIAL"]

# B4：只读 fixture 扫描
# 结果写 $D/phase2-fixture-scan.txt
```

时间预算：非重启批次每条约 10–40s；`studio-dev.mjs` 每次冷启动 4–6 分钟，B3 共 4 次重启，本轮实测整批 **54m14s**。

### 8.3 复跑独立性检查

每条计入覆盖的用例须在 `phase1-<ID>-run1.json` 与 `run2.json` 中都有 `verdict:"PASS"`，且 token 不同、`window_id` 有效。重启类的两次 F11 / F08 还须 window-id 与 pid 均发生变化（本轮链：`w-38470684/38264 → w-17105818/76252 → w-348261314/68176 → w-53939168/36304 → w-14091248/39756`）。

---

## 9. 结果判定与落证规范

### 9.1 `OUTCOME.md` 必备章节

`0 Summary` / `1 启动前门槛` / `2 Phase 0 冒烟` / `3 Phase 1（逐用例）` / `4 Phase 2` / `5 截图与证据文件` / `6 窗口与进程标识汇总` / `7 合规审计` / `8 收尾` / `9 Explicitly not claimed`。

必须包含：构建与启动命令、构建前后 hash、`window-id` 与 `pid`、关键命令与 JSON 摘要、截图路径、逐条 PASS/FAIL、归档失败清单。

### 9.2 证据命名规范

| 类型 | 命名 |
|---|---|
| 门槛 / 冒烟 | `phase0-S<n>-<name>.json` |
| 用例结果 | `phase1-<Fxx>-run<1|2>.json` |
| 归档失败 / 弱证据 | `phase1-<Fxx>-run<n>-<原因>-FAIL.json`、**保留不删** |
| AX 普查 | `ax-*.json`、`f05-census.json`、`probe-*.json` |
| 环境与命令 | `build-context.log`、`launch-*.log`、`phase2-fixture-scan.txt`、`compliance-audit.txt`、`commands.jsonl` |
| 截图 | `screenshots/*.png` |

`commands.jsonl` 每条记录：`{case, run, cmd, ok, error_code, snapshot_id}`。本轮约 865+ 行，错误码分布 `ACTION_FAILED 24` / `STALE_REF 2` / `TIMEOUT 1`。

### 9.3 Fail-closed 与归档

任何 FAIL / 弱证据都**先归档再修正**，归档文件不删除、不改写历史结论。修正只允许三类：① 修 harness bug（如 `total_matches` 过滤错误）② 加强断言（如 F10 真实 listbox/option）③ 修编排/环境（如重启进程生命周期）。**禁止**降低断言阈值、改判定口径、删失败记录。之后必须干净地独立复跑 2 次 PASS。

本轮 4 份归档：`phase1-F10-run1-initial-setvalue-FAIL.json`、`phase1-F17-run1-pre-bounds-sampling.json`、`phase1-F17-run1-timeout-FAIL.json`、`phase1-F11-run1-relaunch-timeout-FAIL.json`。

### 9.4 合规审计项

| 项 | 期望 |
|---|---|
| `mouse-click` / 坐标动作 | **0** |
| `focus-window` | **0**（最小化一律 `restore`） |
| Playwright / runtime 桩 | **0** |
| `--headed` | 仅 `focus` / `type`，本轮 16 次（7 + 9） |
| 主断言来源 | 全部 AX JSON；磁盘/hash/日志仅 evidence |

---

## 10. 收尾

### 10.1 应用 / 窗口 / 端口

```bash
agent-desktop close-app "Studio.exe" --force     # 返回 APP_NOT_FOUND 属正常（已自行退出）
agent-desktop list-windows --app "Studio.exe"    # 期望 data: []
netstat -ano | grep 127.0.0.1:4318               # 期望无监听
```

只结束本测试启动的 Aster/Studio 进程与窗口；**不结束任何用户无关进程**，不做批量删除。

### 10.2 用户 WIP 恢复（回到执行前状态）

```bash
git -C apps/studio checkout --detach 07ffdfcf56f8a2a21efce49be17ed4aaf3142cbb
git -C apps/studio stash pop stash@{0}
git -C apps/studio diff | sha256sum   # 必须等于 user-wip-reasoning_effort.patch 的 sha256
git status --short                     # 期望 M apps/studio + ?? <证据目录>/
```

### 10.3 证据保留

所有 JSON、日志、截图、脚本、模板与归档 FAIL 全部保留。若工作树已恢复而 `Studio.exe` 仍是按对齐 gitlink 构建的二进制，需在 OUTCOME 注明「源码工作树与二进制版本不一致，后续开发请按需重建」。

---

## 11. 风险、上限诚实与 Explicitly not claimed

### 11.1 结构性上限

不改产品，A + B 类最多约 7–9/17；D 类 4 项（F06/F09/F12/F15）**写多少 UI 用例都无法达标**，必须由产品侧提供入口/接口/可注入前置状态。目标表述应为「把可测面吃满」而非「17/17 全达标」。

### 11.2 待裁决 / 风险项

| # | 项 | 影响 |
|---|---|---|
| 1 | 启动口径：本计划用路径 B 启动 + agent-desktop 驱动；macOS 旧口径要求 `agent-desktop launch` | 若裁决必须以 `launch` 启动，需重做启动链与环境变量注入方式 |
| 2 | F01 口径：MATRIX 以「L2 桩不计入」为由排除 F01，但真窗口断言是否满足最低执行面未裁决 | 影响是否计入台账；本计划只给 PASS 事实，不预支数字 |
| 3 | `--headed` 口径：旧 `COVERAGE_UPLIFT_PLAN.md:139` 文字上禁 `--headed`，本台账按「允许物理键盘、禁止坐标/鼠标」接受 | 建议统一写进口径注，每条用例在 OUTCOME 标注所用形态 |
| 4 | fixture 口径：外部进程/HTTP 注入与「全程可视化」有张力 | F03/F04/F07 若补跑，须逐条声明「fixture 仅作前置」 |
| 5 | 构建一致性：父仓 `Cargo.lock` 与子模块版本漂移会让 `--locked` 失败 | 每轮先做 §3.1，禁止改 lock 文件 |
| 6 | 工作树：用户 WIP 并行的发布阻塞风险 | 本计划文档自身不得成为发布阻塞项 |

### 11.3 Explicitly not claimed（写入 OUTCOME 时必须逐条列出）

- 不声称 F06 / F09 / F12 / F15 的任何覆盖（结构不可达，按要求不测）。
- 不声称 F13 严格达标；F14 不声称 flock / `Claim::Busy`、更新通道/清单、退出守卫被验证。
- 不声称 F05 覆盖（BLOCKED）；不声称 F03 / F04 / F07 覆盖（SKIP）。
- 不声称 F01 / F02 / F10 / F17 是**完整功能覆盖**：F02 未覆盖斜杠命令/附件/队列；F10 未覆盖命令面板/深链/快捷键/空态；F17 未覆盖 100/125/200% 缩放矩阵与主题切换；F01 未覆盖空草稿不落盘、切 Tab 状态保持。
- 不声称磁盘 / HTTP / ACL 回读等价于 UI 断言。
- 不声称修改过产品代码、放宽过 `--locked` 或任何断言。
- 不声称任何「x/17」覆盖率数字，也不把历史 Playwright / runtime 桩结果计入本轮。

---

## 12. 快速执行清单（Checklist）

```
[ ] G0-1  agent-desktop status → ok / windows / 1.2.0 / accessibility granted
[ ] G0-2  python3 -c "print(1)" → 1
[ ] G0-3  备份 WIP patch + sha256 + stash + 对齐 gitlink 944864f2
[ ] G0-4  just build-studio 成功；记录 Studio.exe 前后 mtime/size/sha256
[ ] G0-5  路径 B 启动，4 个环境变量齐全，dev server 4318 就绪
[ ] G0-6  list-windows --app "Studio.exe" 记录 id/pid/bounds
[ ] G0-7  snapshot -i --compact → complete:true；无首启 dialog
[ ] S0–S4  status/list-apps、visible、complete+composer、dialogs、截图非白屏
[ ] 打开 commands.jsonl 记录；AX 普查 ax-census.json / ax-settings-census.json
[ ] B1  drive.py --case ALL --run 1     → F01/F02/F10/F17 PASS, F05 BLOCKED
[ ] B2  drive.py --case ALL --run 2     → 同上，token 独立
[ ] B3  restart_cases.py --case ALL（后台）→ PASS×4 + PARTIAL，窗口等待 600 次
[ ] B4  phase2-fixture-scan.txt        → 无安全 fixture 则 F03/F04/F07 SKIP
[ ] 归档所有 FAIL / 弱证据，修正后干净复跑 2×PASS
[ ] 合规审计：mouse-click=0 / focus-window=0 / Playwright=0
[ ] 写 OUTCOME.md（9 节齐全，无占位符）+ fill_outcome.py 渲染校验
[ ] 收尾：close-app / list-windows=[] / 4318 无监听
[ ] WIP 恢复：checkout 07ffdfcf5 + stash pop + diff sha256 比对
[ ] 证据目录完整保留
```

---

## 附录 A — `agent-desktop` 1.2.0 命令参数速查（本日 `--help` 复核）

| 命令 | 关键参数 |
|---|---|
| `status` / `list-apps` | `list-apps --app <name> --timeout-ms <ms>` |
| `list-windows` | `--app`（精确、大小写不敏感）、`--timeout-ms`（默认 5000） |
| `snapshot` | `-i/--interactive-only`、`--compact`、`--skeleton`、`--max-depth`（默认 10）、`--include-bounds`、`--surface`（window/focused/menu/menubar/sheet/popover/alert/…）、`--root <ref>`、`--timeout-ms`（默认 3000）、`--wait-for` / `--wait-for-gone`（role:text）、`--wait-timeout`、`--force-electron-a11y` |
| `find` | `--role`、`--name`、`--exact`、`--value`、`--text`、`--description`、`--native-id`、`--surface`、`--root <ref>`、`--window-id`；返回 `total_matches` + `matches[]`（含 `ref_id`/`role`/`name`/`states`/`bounds`） |
| `get <ref>` | `--property text\|value\|title\|bounds\|role\|states` |
| `is <ref>` | `--property visible\|enabled\|checked\|focused\|expanded\|selected` |
| `click/toggle/focus/clear <ref>` | `--timeout-ms`（默认 5000）、`--wait-for*` |
| `type <ref> [TEXT]` | `--headed`、`--stdin`、`--interval-ms`、`--timeout-ms`（默认 5000 + 30/字符） |
| `set-value <ref> [VALUE]` | `--stdin`（≤128 KiB）、`--timeout-ms` |
| `press <COMBO>` | `--app`、`--window-id`、`--force`、`--headed` |
| `resize-window` | `--width` / `--height`（必填）、`--app`、`--window-id` |
| `restore` / `close-app <APP> --force` | `restore --app/--window-id` |
| `screenshot [PATH]` | `--app`、`--window-id`、`--screen <index>`、`--wait-for*` |
| `wait [MS]` | `--element <ref>`、`--window <title>`、`--text`、`--menu`、`--menu-closed`、`--event window-opened|window-closed|app-launched|app-terminated|focus-changed|surface-appeared|surface-dismissed`、`--predicate exists|enabled|visible|actionable|value`、`--value` |
| 通用 | `--session`、`--agent-id`、`--trace <jsonl>`、`--trace-strict`、`--headed`（可前置）、`--debug --screenshot <PATH.html>` |

> 所有子命令都返回统一 JSON envelope：`{ok, data, error:{code, disposition:{delivery, retry}}, snapshot_id}`。`disposition.retry` 只有 `not_delivered / safe` 才可重试写动作。

---

## 附录 B — 本轮 Windows 基线结果（2026-11-14，供复跑对账）

| 用例 | run1 | run2 | 结论 |
|---|---|---|---|
| F01 草稿跨页 | PASS | PASS | 计入（2×PASS） |
| F02 composer 中文输入 | PASS | PASS | 计入（2×PASS） |
| F03 流式消息 | — | — | SKIP（无 fixture） |
| F04 虚拟列表 | — | — | SKIP（无 fixture） |
| F05 模型选择 | BLOCKED | BLOCKED | 不计入 |
| F06 | — | — | NOT TESTED（结构不可达） |
| F07 ACP turn | — | — | SKIP（无 fixture） |
| F08 侧栏持久化 | PASS | PASS | 计入（2×PASS） |
| F09 | — | — | NOT TESTED（结构不可达） |
| F10 设置搜索 | PASS | PASS | 计入（2×PASS） |
| F11 偏好持久化 | PASS | PASS | 计入（2×PASS） |
| F12 | — | — | NOT TESTED（结构不可达） |
| F13 首启 | — | — | NOT TESTED（不承诺严格达标） |
| F14 单实例 | PARTIAL | — | 不计入 |
| F15 | — | — | NOT TESTED（结构不可达） |
| F16 | — | — | NOT TESTED（不在本轮清单，见 §6.5） |
| F17 窄窗口溢出 | PASS | PASS | 计入（2×PASS） |

**合计**：6 条各 2×PASS 计入覆盖；1 条 2×BLOCKED；1 条 PARTIAL；3 条 SKIP；7 条 NOT TESTED。首次主窗 `w-85395480` / `pid 37164` / 1456×959；Phase 0 截图 1442×952、417893 bytes。详见 `OUTCOME.md`。
