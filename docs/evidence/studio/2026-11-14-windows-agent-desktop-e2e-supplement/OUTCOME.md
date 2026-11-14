# 剩余功能端到端补测 OUTCOME（2026-11-14 supplement）

> 任务：**继续规划并完成剩余功能的端到端测试**
> 证据目录：`docs/evidence/studio/2026-11-14-windows-agent-desktop-e2e-supplement/`
> 上游基线：`2026-11-14-windows-agent-desktop-e2e-rerun/OUTCOME.md`（实测 5/17 PASS）
> 规划：`SUPPLEMENT-PLAN.md`；执行口径：`../2026-11-14-windows-agent-desktop-e2e/E2E-TEST-PLAN.md`

---

## 0. 文档定位与判定口径

本轮针对上一轮**未达标的 12 条功能**（F01 / F03 / F04 / F05 / F06 / F07 / F09 / F12 / F13 / F14 / F15 / F16）重新做可测性评估，能补的真补、不能补的给 AX 证据与产品侧缺口，**不把「不可达」包装成「已完成」**。

- 主断言全部来自 `agent-desktop` 的 AX JSON envelope（`snapshot` / `find` / `get` / `is` / `click` / `toggle` / `set-value` / `type`）。
- 磁盘 hash、renderer 日志、HTTP、git diff、进程列表**只能作环境证据**，不能替代 UI 断言。
- 每条计入覆盖的用例必须**独立复跑 2 次 PASS**；FAIL fail-closed，不放宽断言、不换被测样本凑绿。
- PowerShell 下 `ref_id` 单引号包裹；本轮 harness 经 Python / Git Bash 调用原生 exe，直接传 `ref_id`（不额外包字面单引号）。Windows `type` 一律 `--headed`。
- 不测 F06 / F09 / F12 / F15（结构不可达）；F13 / F14 最多 PARTIAL。
- **本轮不改产品代码、不改 `MATRIX.md`、不预支任何「x/17」台账数字。**

---

## 1. 环境与构建上下文

| 项 | 值 |
|---|---|
| 平台 | Windows，`agent-desktop` 1.2.0 |
| `status` | `ok:true`，`platform:"windows"`，`accessibility.granted`，`session_id:null` |
| 被测产物 | `D:\code\aster\target\studio\aster\debug\Studio.exe` |
| 产物 sha256 | `a9ac2110702c8db75d0b98ae895359e3fd5825772a24dcf1155c97169e18ff02` |
| 产物 mtime / size | 2026-11-14 16:55 / 162,131,456 bytes |
| 构建口径 | 本轮**未显式重跑** `just build-studio`；`studio-dev.mjs` 每次启动执行两次 `cargo build --locked`，保证产物与本 checkout 一致。子模块 `Cargo.toml` / `package.json` 的 version 在测试期间临时对齐为 `0.2.3`（父仓 `Cargo.lock` 记录 `aster-studio 0.2.3`），收尾已改回 `0.2.2` |
| 启动命令（路径 B） | `cd /d/code/aster/apps/studio` → `ASTER_TENANT_SLUG=aster STUDIO_RENDERER_DEV=1 ASTER_STUDIO_INSTANCE=win-e2e-01 STUDIO_RENDERER_PORT=4318 node scripts/studio-dev.mjs` |
| 主窗口 | `w-100403736` / pid `61580`（Phase 0、F16、D 类证据、F01 单文件 HMR 对照） |
| 冷启动窗口 | `w-52628568` / pid `40352`（F01 冷启动对照） |
| 截图 | `screenshots/phase0-S4-main-window.png`（1442×952，413,042 bytes） |

关键命令形态（全部经 `commands.jsonl` 记录）：

```text
agent-desktop status
agent-desktop list-windows --app "Studio.exe"
agent-desktop snapshot -i --compact --app "Studio.exe" --window-id w-100403736
agent-desktop find --app "Studio.exe" --window-id w-100403736 --name "描述任务"
agent-desktop is @<ref> --property enabled
agent-desktop get @<ref> --property value
agent-desktop type --headed @<ref> <token>
agent-desktop click @<ref>
agent-desktop press @<ref> escape
agent-desktop close-app "Studio.exe" --force
```

注意：Windows 的 app 名是 `Studio.exe`（`--app "Studio"` 会 `APP_NOT_FOUND`）；`snapshot -i --compact` 只暴露浅层树，深层 Web 内容依赖 `find`；headed 动作可能让窗口最小化，观察前先 `restore`。

---

## 2. Phase 0 冒烟（`phase0-summary.txt`）

| 步骤 | 结果 |
|---|---|
| S0 `status` + `list-apps` | `ok:true`，v1.2.0，accessibility granted |
| S1 主窗 visible | `w-100403736` pid 61580，bounds 1456×959 @ (52,52)，`minimized:false` |
| S2 `snapshot -i --compact` | `complete:true`，`snapshot_id=s3gu7dl4as6zo`，composer 命中 2 |
| S3 首启对话框 | `继续/稍后设置/跳过/开始使用/下一步/允许` 全部 0 命中，无需关闭 |
| S4 `screenshot` | `ok:true`，png 1442×952 / 413,042 bytes |

**`PHASE0_L3: PASS`**，门槛全绿后方执行用例。

---

## 3. 新增用例 F16（错误态 / 无障碍，**UI 子集**）：2×PASS

`case_F16`（`supplement_cases.py`）在工作台与设置页做 14 组 AX 主断言：`snapshot complete`、命名控件的 `name` 非空且 `role` ∈ 合法集合、composer `is --property enabled/focused/visible` 可读、进入设置、搜索框输入不存在的查询后**无结果 listbox**、设置导航仍在、清除 + `escape` 后工作台控件仍可 `find`。

| 轮次 | token | 断言 | verdict | window |
|---|---|---|---|---|
| run1 | `SUPF16D798` | 14 / 14 OK | **PASS** | `w-100403736` |
| run2 | `SUPF16EE42` | 14 / 14 OK | **PASS** | `w-100403736` |

典型证据（`supp-F16-run1.json`）：

```json
{"label":"F16 controls have non-empty name and valid role","ok":true,"detail":"bad=[] total=13"}
{"label":"F16 is --property enabled readable","ok":true,"detail":"data={'applicable': True, 'property': 'enabled', ..., 'result': True}"}
{"label":"F16 unmatched query entered","ok":true,"detail":"readback='ZZZ_NO_SUCH_SETTING_9F3C'"}
{"label":"F16 no result listbox for unmatched query","ok":true,"detail":"matches=0"}
{"label":"F16 settings navigation intact on empty result","ok":true,"detail":"matches=1"}
```

**判定边界**：这是 F16 的 **UI 可达性与空结果态子集**，两次独立 PASS。它**不是** F16 完整覆盖：真实错误态 / 离线 / 崩溃恢复草稿（台账要求 L3 抽样，历史实测 `NOT_PERSISTED`）在本产品无可触发前置，本轮不做、不声称。按 `MATRIX.md` §9 口径，是否将 UI 子集计入 F 层覆盖需 **P0 口径裁决**，本轮不改台账。

---

## 4. F01 根因对照：从「假设」到严格因果证据

### 4.1 起点（结论不变）

`2026-11-14-windows-agent-desktop-e2e-rerun/OUTCOME.md` 记录：当前用户工作树 `07ffdfcf5` 上 F01 两次独立 **FAIL**，`after='描述任务，输入 / 使用指令或技能，@ 选择工作区文件\n'`（草稿跨页丢失）；首轮全树对齐父仓 gitlink `944864f2775fd75609ea811f28b96e7b96b27552` 时 F01 两次 PASS。差异候选为提交 `cc0a7bd09 fix(sidebar): keep home composer draft when leaving Settings via the Work button`。

`git show --name-only cc0a7bd09` 证实该提交**只改 2 个文件**：

```text
src/renderer/components/app/sidebarShortcuts/runtime.tsx
src/renderer/components/app/sidebarShortcuts/__tests__/runtime.test.ts
```

即唯一运行时文件就是 `runtime.tsx`。

### 4.2 负面结果：单文件 HMR 对照（`f01-control.json`）

```text
original sha256 : c0cc632a8e841be20e42dd1ce83b9ed84d687fe5dec702ed0ae69aec9ef94330
aligned  sha256 : a15533848130d261436bccdd33682802233496c4cb27ace7db682b5280d1d375 (changed=True)
F01C run1 exit=1, run2 exit=1  → CONTROL_ALL_PASS: False
restore rc=0, restored sha256 = original, match=True
```

**未把该负面结果洗成成功**：两次仍 FAIL，文件已按 sha256 校验恢复。

### 4.3 关键判定：HMR 确实生效

`/c/Users/admin/AppData/Local/Temp/aster-studio-renderer.log` 证据：

```text
163:start   building app\sidebarShortcuts\runtime.tsx
274:ready   built in 8.59s
318:start   building app\sidebarShortcuts\runtime.tsx
356:ready   built in 8.58s
```

rsbuild **确实重新编译了**被对齐的文件（两轮各一次）。因此「单文件不足」不是唯一解释，更可能是：**dev server 重编译了 bundle，但已经打开的 Electron 窗口没有 reload 新 bundle**。要区分二者，必须冷启动。

### 4.4 严格对照：单文件对齐 + 冷启动（`f01_full_control.py`）

设计：只对齐 `runtime.tsx` 到 gitlink，`close-app --force` 关闭窗口 → 等待 dev server 释放 4318 → 重新 `_launch` → `wait_window(attempts=600)` → `wait_content` → F01C 独立复跑 2 次。**刻意不碰** `src-tauri/*` / `package.json` / `scripts/*`，以保持 `--locked` 一致性并避免为一个 renderer 行为问题重编译 Rust。若 Phase A 仍 FAIL，才升级到「完整 renderer 对齐（50 个差异文件）+ 冷启动」（Phase B）。

结果（`f01-full-control.stdout.log` / `f01-full-control.json`）：

```text
Phase A aligned runtime.tsx changed=True
[F01-CONTROL-A] close-app ok=True
  INFO  window appeared after 163 polls
[F01-CONTROL-A] window=w-52628568 pid=40352 content_ready=True
=== F01C run 1 token=SUPF01C6D5C ===
  OK  F01 draft entered - value='SUPF01C6D5C'
  OK  F01 settings page reached (返回应用 button present)
  OK  F01 draft survived cross-page round trip - after='SUPF01C6D5C'
  F01C_L3: PASS
=== F01C run 2 token=SUPF01C1118 ===
  OK  F01 draft survived cross-page round trip - after='SUPF01C1118'
  F01C_L3: PASS
PHASE_A_ALL_PASS: True
Phase B skipped: Phase A already isolates the root cause
CONTROL_ALL_PASS: True
restore rc=0 mismatches=0
EXIT=0
```

每轮 5 条 AX 断言全 OK。恢复校验：`restore_rc=0`、`restore_mismatches=[]`、`restored_runtime_sha256 = c0cc632a…`（与实验前一致）。

### 4.5 结论与边界

- **根因已由对照实验坐实**：`cc0a7bd09` 对 `runtime.tsx` 的修复直接决定 F01 草稿跨页保留行为；当前用户工作树 `07ffdfcf5` 缺该提交，因此 F01 FAIL 是**真实回归**。
- 4.2 的负面结果得到解释：**HMR 重编译 ≠ 已打开窗口加载新 bundle**；冷启动排除了该混淆。
- **对照实验不是覆盖结论**：它只在父仓期望的 gitlink renderer 上通过（新窗口 `w-52628568`），**不改写、不删除** rerun 中当前工作树的两次 FAIL，也不把 F01 计入任何覆盖率。
- 冷启动后窗口随编排父进程退出而关闭，属 `studio-dev.mjs` 既有行为；4318 端口已释放。

---

## 5. 本地模型 fixture 可行性结论（F03 / F04 / F05 / F07）

`probe_fixture.py` 对仓库自带 `apps/studio/tests/e2e/connectors/model_server.py` 做安全评估（`fixture-probe.txt`）：

```text
bound port          : 127.0.0.1:57312 (loopback, ephemeral)
startup line        : {"port": 57312, "executable": "...python3.exe"}
HTTP request failed : HTTPError: HTTP Error 422: exact fixture case required
FIXTURE: NOT USABLE
server exit code    : 0        events file: 0 bytes
```

根因（`tests/e2e/capability_baseline.py`）：该服务是**精确契约 oracle**，只接受 `CAPABILITY-PROBE:<case>` 指令，任意普通 prompt 由 `decide()` 抛 `ValueError('exact fixture case required')`。它能安全地在回环启动并 stdin 干净关闭，但**不能发起真实 LLM turn**。

因此：

| 功能 | 结论 | 依据 |
|---|---|---|
| F05 模型选择 | **BLOCKED** | AX 无可选择模型；fixture 不能作为自由模型服务 |
| F03 真实对话 turn | **SKIP** | 无可发起真实 turn 的模型服务 |
| F04 长会话 / 上下文压缩 | **SKIP** | 需 >100 条消息会话与真实模型 |
| F07 真实 MCP / 工具链 | **SKIP** | 需 synthetic MCP 实例与真实 turn |

未启动任何联网服务，未修改用户真实实例配置。**没有为凑绿而伪造模型响应。**

---

## 6. D 类结构不可达：只读 AX 证据（不产生 PASS）

`d_class_probe.py` → `d-class-ax-evidence.json` / `d-class-probe.stdout.txt`，全部为只读 `find` 观察，窗口 `w-100403736`：

| 探测 | AX 结果 |
|---|---|
| F15 截图/录屏/视觉标注入口（7 个候选名） | **全部 0 命中**，`any_hit:false` |
| F06 审批按钮（允许/拒绝/批准/始终允许/Allow/Deny/Approve） | **全部 0 命中**，`any_hit:false` |
| F12 文档输出（保存到文档/导出文档/下载文档/Download…） | **全部 0 命中**，`any_hit:false` |
| F13 依赖入口（依赖/运行时组件/组件安装/Dependencies） | **全部 0 命中** |
| F14 更新通道（检查更新/更新通道/退出守卫/Check for updates） | **全部 0 命中** |
| F09 `role=tab` | `total_matches:1` |
| F09 `name=工作区` | `total_matches:2` |

**F09 两个表面命中的澄清**：`phase0-S2-snapshot.json` 显示唯一 `tablist` 名为「标签页栏」、含「新建标签页」按钮，位于 `name="Aster - Web 内容"` 的 Chromium 窗口 chrome 之下（第 271–275、292 行），是**浏览器窗口标题栏**，不是应用工作区多标签；`name=工作区` 的命中来自 composer placeholder「选择工作区文件」文本，不是标签控件。会话中对 `find --role tab` 的 detail 复核亦指向 Chromium 标题栏 tab（该 detail 未单独落盘，故此处只引用已落盘的 `total_matches` 与 AX 树，不将其升级为强证据）。

结论：**F06 / F09 / F12 / F15 仍结构不可达，无任何覆盖声明**。

---

## 7. 需产品改造项（F13 / F14 / F16 L3）

| 功能 | 本轮状态 | 缺口 |
|---|---|---|
| F13 首次运行 / 运行时组件 | **NOT TESTED**（台账 `PARTIAL_PASS` 不是本轮 Windows 结果） | 产品只安装 1 个 required 组件，PLAN 要求 3 个；依赖页在 Aster 租户隐藏，AX 入口 0 命中 |
| F14 更新 / 退出守卫 / 单实例 | **PARTIAL**（沿用 rerun 结论，不升级） | 更新通道 / 清单、`MainExitGuard`、flock `Claim::Busy` 分支均不可从 GUI 触发；AX 入口 0 命中 |
| F16 L3 崩溃恢复抽样 | **NOT TESTED** | 杀进程重启后草稿实测 `NOT_PERSISTED`，产品无持久化能力；本轮只做 UI 子集 |

---

## 8. 逐条最终结论（12 条剩余功能）

| 功能 | 最终 verdict | 说明 |
|---|---|---|
| F01 | **FAIL（不变）** | 用户工作树 2×FAIL 归档保留；对照 2×PASS 仅在 gitlink renderer，不计覆盖 |
| F03 | SKIP | 无自由模型服务 |
| F04 | SKIP | 需长会话 / synthetic MCP |
| F05 | BLOCKED | 无可选择模型 |
| F06 | NOT TESTED | 结构不可达，审批控件 0 命中 |
| F07 | SKIP | 需 synthetic MCP / 真实 turn |
| F09 | NOT TESTED | 结构不可达，唯一 tab 为 Chromium 标题栏 |
| F12 | NOT TESTED | 结构不可达，文档输出入口 0 命中 |
| F13 | NOT TESTED | 依赖入口 0 命中；需产品改造 |
| F14 | PARTIAL | rerun PARTIAL 维持；更新通道 0 命中 |
| F15 | NOT TESTED | 结构不可达，截图/录屏入口 0 命中 |
| **F16** | **2×PASS（UI 子集）** | **本轮唯一新增计入候选**；L3 不声称 |

**覆盖率口径说明**：上一轮 rerun 已有 F02 / F08 / F10 / F11 / F17 各 2×PASS（5 条），本轮**未重跑**。若按「实测独立 2×PASS」的宽松口径，加入 F16 后为 6/17 ≈ 35.3%；但 **P0 口径裁决未完成、`MATRIX.md` 未更新、F16 只是 UI 子集**，因此本轮**不发布任何台账认证覆盖率数字**。结构性上限仍约 11/17 ≈ 64.7%，D 类 4 条决定 100% 不可达。

---

## 9. 合规审计（`compliance-audit.txt` / `results-summary.txt`）

```text
total agent-desktop commands logged: 461
list-windows 253 | find 139 | get 24 | click 14 | clear 8 | is 6 | type 6
focus 4 | snapshot 2 | press 2 | set-value 2 | close-app 1
mouse-click / coordinate actions : 0   (expected 0)
focus-window                     : 0   (expected 0)
Playwright / runtime stub refs   : 0   (expected 0)
--headed total                   : 10  (type 6 / focus 4)
error codes: ACTION_FAILED 13, STALE_REF 1
```

错误码说明（**不构成断言放宽**）：13 条 `ACTION_FAILED` 分布在 `clear` 8（composer 清空的 best-effort 状态恢复）、`press` 2、`type` 2、`focus` 1；1 条 `STALE_REF` 来自 `get`（重取 ref 后回读）。按 `disposition.retry` 语义，`delivered_unverified / retry: unsafe` 的写动作**不盲重试**；所有用例 verdict 只由后续**独立 AX `get` / `find` 回读断言**决定，动作 envelope 的 `ok` 不直接放行。F16 与 F01C 最终均为 2×PASS，历史 FAIL 与负面对照结果全部保留归档。

`drive.py` / `restart_cases.py` / `supplement_cases.py` / `f01_full_control.py` / `d_class_probe.py` 均为**编排 harness**：串行调用同一个 `agent-desktop-win32-x64.exe`，不是桩套件；进程启停只作环境准备。

---

## 10. 收尾与环境恢复

| 项 | 状态 |
|---|---|
| Studio 窗口 | `list-windows --app "Studio.exe"` → `data:[]`，已释放 |
| 4318 端口 | `netstat` 无监听，已释放 |
| `runtime.tsx` | 已恢复 HEAD 版本，sha256 `c0cc632a…` 与实验前一致 |
| 对齐的 renderer 文件 | `restore_rc=0`，`restore_mismatches=[]` |
| `Cargo.toml` / `package.json` | version 已由临时 `0.2.3` 回退 `0.2.2`，子模块 `git status` 仅剩用户 WIP |
| 用户 WIP | `stash pop stash@{0}` 成功；`reasoning_effort.rs` 39 行插入完整 |
| WIP 逐字节校验 | `git -C apps/studio diff \| sha256sum` = `ae7f4036225522042da4b8ee8e5bda1c3deb77aaedbfbaf522ede1f5fcc55a4f`，与 `user-wip.patch` **完全一致** |
| 父仓 `packages/ui` 445 条 `D` 标记 | 为上一轮已诊断的历史异常（pnpm 断链），本轮**未处置、未恢复、未删除**；不属本轮操作造成，请用户自行确认 |

---

## 11. Explicitly not claimed

- 不声称 F06 / F09 / F12 / F15 有任何覆盖；只读 AX 证据不产生 PASS。
- 不声称 F13 / F14 严格达标；不声称 F16 完整覆盖或已完成 L3 崩溃恢复抽样。
- 不声称 F01 在当前用户工作树已修复；对照实验只证明根因，**两次 FAIL 结论不变、归档不删**。
- 不声称 F03 / F04 / F07 被验证；`model_server.py` 未被用作可发起真实 turn 的模型服务。
- 不声称台账覆盖率数字有任何变化；`MATRIX.md` 未修改，P0 口径未裁决。
- 不声称重新执行了 `just build-studio`；不声称修改了产品代码、放宽了 `--locked` 或任何断言。
- 不声称使用过鼠标坐标点击、`focus-window`、Playwright 或桩套件（审计计数均为 0）。
- 不声称处理了 `packages/ui` 的历史删除标记异常。

---

## 12. 后续建议（产品 / 工程侧，非本轮执行）

1. **F01**：把 `cc0a7bd09`（`runtime.tsx`）合入当前工作树或对齐子模块到父仓 gitlink，再在真实工作树上独立复跑 2 次；在此之前 F01 保持 FAIL。
2. **F16 / F13 / F14**：需产品补齐可触发前置（错误态注入、组件安装页、更新通道与退出守卫、崩溃后草稿持久化），才能做 L3 抽样。
3. **F03 / F04 / F05 / F07**：需一个可自由响应普通 prompt 的本地回环模型服务，或明确登记为"需外部模型凭据"的环境阻塞。
4. **口径**：若要发布认证覆盖率，先做 P0 口径裁决（UI 子集是否计 F 层覆盖、两轮被测对象不一致如何归一），再更新 `MATRIX.md`。
5. **`packages/ui` 异常**：建议用户单独确认这 445 条删除标记的来源，本轮证据链未触碰它们。
