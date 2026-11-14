# 剩余功能端到端补测规划（2026-11-14 supplement）

> 目标：把上一轮 `2026-11-14-windows-agent-desktop-e2e-rerun/OUTCOME.md` 中未达标的 **12 条功能**重新分类，能补的真补、不能补的给证据与产品缺口，不把「不可达」包装成「已完成」。
> 口径沿用 `E2E-TEST-PLAN.md`：主断言全部来自 `agent-desktop` AX JSON；每条计入覆盖的用例独立复跑 2 次 PASS；FAIL fail-closed 归档；fixture 仅作前置；不换被测样本凑绿。

## 0. 起点与本轮增量目标

上一轮实测 5/17 PASS。剩余 12 条：

| 状态 | 功能 |
|---|---|
| FAIL ×2 | F01 |
| SKIP | F03、F04、F07 |
| BLOCKED ×2 | F05 |
| PARTIAL | F14 |
| NOT TESTED | F13、F16 |
| 结构不可达 | F06、F09、F12、F15 |

## 1. 可测性再评估（本轮分类）

| 类 | 功能 | 判定依据 | 本轮动作 |
|---|---|---|---|
| **A 本轮可补测** | **F16（UI 子集）** | A 类，工作台/设置页有稳定 AX 入口；旧规划 §9 列 P1 可写 | 新增 `case_F16`，2×PASS |
| | **F01（根因对照）** | 已定位缺 `cc0a7bd09`，为**单文件**运行时修复 | 单文件定点对齐 → 2×PASS 对照证据 |
| **B 需安全前置** | **F05 / F03** | 仓库自带 `model_server.py` 可绑定 `127.0.0.1:0`、stdin 关闭，不联网 | 先验证服务可用，再尝试 UI 配置 → AX 断言 |
| | **F04 / F07** | 需 >100 条消息会话 / synthetic MCP 实例 | 只读评估，不强行造前置 |
| **C 需产品改造** | **F13** | 产品只装 1 个 required 组件，验收要求 3 个 | 最多 PARTIAL，不承诺严格达标 |
| | **F14** | flock / `Claim::Busy` / 更新通道 / `MainExitGuard` 不可触发 | 最多 PARTIAL |
| | **F16（L3 抽样）** | 崩溃恢复草稿实测 `NOT_PERSISTED` | 不做严格达标 |
| **D 结构不可达** | **F06 / F09 / F12 / F15** | 无 AX 入口或主断言必须落磁盘 | 只读 AX 证据 + 产品侧缺口清单，**不测** |

**上限不因本轮改变**：不改产品约 7–9/17；D 类 4 条决定 100% 不可达。

## 2. 用例规格

### 2.1 F16 错误态 / 无障碍（UI 子集）

前置：`to_workbench()`，工作台就绪、composer 为空。

| # | 动作 | 主断言（AX） |
|---|---|---|
| 1 | `snapshot -i --compact` | `complete:true` |
| 2 | 对 `描述任务/设置/新建任务/更多选项/选择模型` 逐个 `find` | 每个命中的 `name` 非空且 `role` ∈ 合法集合（textfield / button / menubutton / switch / combobox） |
| 3 | 对 composer `is --property enabled` / `focused` | 返回 `ok:true` 且状态布尔可读 |
| 4 | 进设置 → 搜索框输入不存在的关键字 → `find 设置搜索结果` | 无结果 listbox，且设置导航未丢失（空态/无结果） |
| 5 | 清除 → `press escape` → 回工作台 | 工作台控件仍可 `find`，面板已关闭 |

判定：5 组断言全 OK 且两次独立复跑 PASS。
**不声称**：真实错误态/离线/崩溃恢复（产品没有可触发前置），不做 L3 抽样。

### 2.2 F01 根因对照（对照实验，非覆盖结论）

```
git -C apps/studio checkout 944864f2 -- src/renderer/components/app/sidebarShortcuts/runtime.tsx
```

只替换 `cc0a7bd09` 涉及的**唯一运行时文件**（其余差异是测试/renderer 其他改动），dev server HMR 重编译后跑 `case_F01` 两次独立 PASS。

- 归档为 `F01-CONTROL`，明确标注：**仅在父仓期望版本 `944864f2` 上通过**。
- 上一轮在当前工作树 `07ffdfcf5` 的两次 FAIL **结论不变、归档不删**。
- 收尾把该文件恢复到 HEAD，不留在工作树。
- 这是**因果验证**，不是把 FAIL 洗成 PASS；若单文件不足以恢复，如实记 NOT RESTORED。

### 2.3 F05 / F03（本地合成模型前置，条件执行）

前置（仅环境准备，不作断言）：`probe_fixture.py` 验证 `model_server.py` 可在 `127.0.0.1` 回环启动、响应、干净关闭。

- 若服务不可用 → F05 保持 BLOCKED、F03 保持 SKIP，记录原因。
- 若服务可用 → 尝试在**测试专用实例** `ASTER_STUDIO_INSTANCE=win-e2e-01` 的设置页配置自定义模型服务：
  - **F05**：`click 选择模型` → 断言出现可选模型 AX 节点（radio/menuitem/option）→ 选中并回读。
  - **F03**：发起一次真实 turn → 断言消息节点 / 停止按钮 / 终态不再变化。
- 所有主断言留在 AX 层；HTTP 响应只作 fixture 健康证据。
- 不启动任何联网服务、不改用户真实实例配置。

### 2.4 D 类只读证据

用 `agent-desktop` 只读 `find` 确认：`find --role tab` 命中数、有无截图/录屏/标注入口、有无审批按钮、有无「保存到文档」按钮；结合源码事实列出产品侧缺口。**不产生任何 PASS 结论。**

## 3. 判定与落证

- PASS / FAIL / BLOCKED / PARTIAL / SKIP / NOT TESTED 定义沿用 `E2E-TEST-PLAN.md §1.3`。
- 新增用例写入独立目录 `2026-11-14-windows-agent-desktop-e2e-supplement/`，**不覆盖前两轮证据**。
- `commands.jsonl` 全量记录；`compliance-audit.txt` 统计 mouse-click / focus-window / Playwright / `--headed`。
- 补测 `OUTCOME.md` 必含：新增用例、对照实验说明、仍不可达项、`Explicitly not claimed`。
- 收尾：恢复 `runtime.tsx`、恢复 `version` 为 `0.2.2`、`stash pop` 并用 patch sha256 逐字节校验 WIP。

## 4. 明确不做（写进 OUTCOME）

- 不声称 F06 / F09 / F12 / F15 任何覆盖。
- 不声称 F13 / F14 严格达标；不声称 F16 完整覆盖或 L3 抽样。
- 不声称 F01 在当前工作树已修复；对照实验只证明根因。
- 不声称任何「x/17」台账数字；不预支 `MATRIX.md` 统计口径。
- 不改产品代码、不放宽 `--locked`、不放宽任何断言、不删历史 FAIL。
- 不启动联网或不安全外部服务，不触碰用户真实实例配置。
