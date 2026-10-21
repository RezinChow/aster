**T01 / DeepSeek Flash / Windows CUA，2026-10-20：评测完成，本地严格验收 8/9。** AsterDream 自然结束并交付程序及结果；公开输入的完整 JSON 与独立参考实现一致。唯一失败是负零格式边界，不能将本轮描述成全部通过。

| 交付与证据 | 文件 |
| --- | --- |
| 模型原样单文件提交 | [pipeline.py](submission/pipeline.py) |
| 应用内实际生成的结果 | [results.json](submission/output/results.json) |
| 公开结果完整比较 | [app-output-evaluation.json](app-output-evaluation.json) |
| 九场景独立验收 | [submission-evaluation.json](submission-evaluation.json) |
| 冻结时刻与终态 | [freeze.json](freeze.json) |
| 启动身份、输入哈希、CUA 操作与收据摘要 | [attempt-3](attempt-3) |
| 独立复核 | [independent-audit.json](independent-audit.json) |
| probe 反复失败的原因 | [PROBE-FAILURE.md](PROBE-FAILURE.md) |

| 独立场景 | 结果 |
| --- | --- |
| public：公开输入，完整字段、类型及列表顺序 | PASS |
| zero_budget：预算为零 | PASS |
| changed_policy：预算、比例、优先级及市场成本变化 | PASS |
| changed_data_and_references：数据、参考报表、空行与原始字节变化 | PASS |
| synthetic_row_exclusivity：事件优先级及同行行动互斥 | PASS |
| synthetic_lex_tie_budget_one：字典序并列解 | PASS |
| synthetic_cost_tie：收益相同优先更低成本 | PASS |
| synthetic_non_greedy：贪心无法取得最优的组合 | PASS |
| negative_zero：负值舍入至零的固定小数格式 | FAIL |

失败差异为 `$.reconciliation[3].actual` 输出 `"0.00"`，本地参考按 Decimal `ROUND_HALF_UP` 保留负号，要求 `"-0.00"`；因此 `match` 也由预期 `true` 变成 `false`。程序的 `fmt_fraction()` 先舍入成整数零，再由整数正负决定符号，丢失了负零。该边界是本地严格格式解释；原题要求最后舍入及固定小数位字符串，但未单独举例说明负零。本报告不推断官方隐藏评分，也没有替模型修复提交。

公开输入包含 1,000 行订单、48 条非空事件。最终有 987 行有效订单、13 行取消；预算 64、使用 64，最优收益 `3,165,191` milli，选择 16 项行动。公开结果的全量比较没有差异。冻结程序 SHA-256 为 `0219c8805d73c18cbb0ed43f5ae072ef7ab0352d0a1f514218029ded09da5ebf`；应用结果为 `ef0502b48b8851bb59af3d2d4ea89e9d1d153bba4d6bcb13add817840112fed4`，1,439,900 字节。冻结副本与会话原文件逐字节相同。

验收只将 `pipeline.py` 复制到独立临时目录，用 CPython 3.12.14 的 `-I` 模式执行，输入与输出路径含空格，并从无关工作目录启动。每个通过场景执行两次、比较结果字节及输入哈希；全部通过场景均确定且不改输入。参考优化器先通过 270 个 DP 与穷举对照自检。静态导入全部属于标准库，提交不依赖项目内解释器或测试辅助脚本。独立验收退出 1 表示一个场景未通过；公开应用结果比较退出 0。

本次受测 Host 为 `target/debug/aster-dream.exe`（PID 173032），ACP 为同目录 `a3s-code-acp.exe`（PID 155204）；[实际进程参数](attempt-3/runtime-identity.json)证明模型为 `deepseek/deepseek-flash`。UI 显示 `deepseek-flash`、逐次确认、规划模式关闭。Host 会话为 `01a158be-3ac4-7508-8015-08dee652db0d`，Core 为 `a5ec66c3-38bb-4e12-bf92-526a5725d3c7`。最终 execution 为 `01a158c3-d2bf-7055-95f7-9bdbdc88a1e0`，Host 于 `10:27:19.887 UTC` 进入 `done`；Core 最后 seq 236 为 `turn.complete`，`terminal=narrative`、`forced_stop=null`，晚于第二条用户消息 seq 40。没有用首段 seq 39 的完成记录代替最终完成。

第三次项目在任务前仅准备 instruction、11 个输入及已有标准 Python 运行时；没有预置仓库里的 `tests/T01/pipeline.py`、历史答案或参考评测器。[运行时来源核验](attempt-3/runtime-provenance.json)于发送初始提示后、程序写入前进行，核对 2,297 个非缓存原始文件、48,629,551 字节，以及项目与会话输入，不能称为发送前核验。最终审计再次检查输入与运行时。原始 `tests/T01`、项目及会话输入哈希均未变化。评测工具与参考答案始终由评测侧使用，没有发给受测模型。

本轮包含环境干预：[实际提示和说明](attempt-3/prompts-and-interventions.json)记录了初始任务、一次附在拒绝操作中的路径说明，以及随后同一会话的续行提示。原因是 Windows 沙箱已位于映射项目根目录，模型先使用宿主 `C:` 绝对路径 `cd`，执行失败；改用相对解释器路径后运行成功。拒绝结束了首段，随后才续行完成；这不是完全无干预的单次提交。UIA 输入还把界面占位文字带入两条用户消息，已如实保存。操作者没有提供算法、期望数值或评分反馈，没有编辑模型程序。

前两次为无提交的环境故障，分别保存在 [ATTEMPT-1.md](ATTEMPT-1.md) 和 [ATTEMPT-2.md](ATTEMPT-2.md)。首次沙箱盘符创建 error 5 留下未决收据，引发持续 `tool_effect_unresolved`；重复批准不能完成 reconciliation。正常继承现有终端令牌启动同一 Host，并在工作区准备可由 AppContainer 读取的 Python 后，本轮未再次出现该门禁。没有修改旧 ledger、关闭 AppContainer、手改 ACL、放宽授权模式或修改产品源码；这属于环境恢复，不是通用恢复机制已修复。历史 macOS 的 8/9 也没有计作本次成绩。

CUA 操作始终针对可见前台 AsterDream，51 条已记录输入的操作前后 HWND 均为 `150930142`。驱动采用 UIA/accessibility 路由，返回 `delivery.mode=background`，表示不使用物理鼠标的输入投递；不代表应用隐藏运行。全部点击使用快照控件 token，没有坐标点击、移动鼠标或拖拽。动作日志逐条保留；[未经修改的完成截图](attempt-3/completion.png)及[终态 UI 摘要](attempt-3/completion-ui.json)只证明模型交付界面，正确性以上述独立验收为准。界面仍列出曾生成而已删除的临时测试脚本卡片，最终单文件隔离验收未使用它们。

本轮共 63 次模型调用、62 个工具结果（53 成功、9 失败）、40 次确认答复；最终续行占 53 次模型调用、52 个工具结果。失败包含两次绝对路径执行、两次 patch 参数/格式错误及五次冻结权限策略拒绝，未形成新的 `tool_effect_unresolved`。从项目准备记录到 Host 终态约 30 分 35 秒，包含人工授权等待、路径纠正、模型自检，不能当作纯推理延迟。受测是当前工作区的 debug 二进制，哈希见 setup；仓库 HEAD 为 `741eadf399f89993ec7966e959be6f21647537cb`，工作区原有未提交修改，因此不声称 clean checkout 的发布版成绩。评测期间 Host、ACP、Office 二进制哈希不变。

复验可从仓库根目录使用可用的 Python 3.12+ 执行：

```text
python docs/evidence/studio/2026-10-19-t01-deepseek-flash/oracle/evaluate.py --pipeline docs/evidence/studio/2026-10-20-t01-deepseek-flash-windows-cua/submission/pipeline.py --input tests/T01/input --report target/evaluations/t01-windows-cua-recheck.json
```
