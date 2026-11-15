# Aster 深度多轮 / 复杂长程 E2E 测试计划

状态：规划稿（非执行通过证据）。日期基线：2026-11-15。  
范围：**CLI + ACP + TUI**（`aster` / `aster-acp`）。**不含** Studio / Inkstone / `just build-studio`。

权威执行合同（冲突时以执行提示词为准）：

`docs/implementation-prompt-aster-long-horizon-complex-agent-desktop-e2e.md`

| 参考 | 角色 |
| --- | --- |
| `crates/code/acp/tests/tui_913_inventory.md` | Layer A/C 用例地图 |
| `apps/aster/tests/visual_tui_harness/README.md` | agent-desktop 可信信号 |
| `docs/evidence/code/2026-11-09-visual-lh-deepseek/OUTCOME.md` | DeepSeek visual LH 先例 |
| `docs/evidence/code/2026-11-08-tui-long-multiturn-deepseek/OUTCOME.md` | PTY + visual multiturn 先例 |
| `docs/evidence/code/2026-11-09-aster-tui-control-loop-deepseek/OUTCOME.md` | control-loop visual 先例 |
| `docs/evidence/code/2026-11-15-agent-connection-recovery-agent-desktop/OUTCOME.md` | 断连 / resume 伴生已绿 |
| `crates/code/acp/tests/long_horizon_*` | Rust guest / 冻结 oracle 合同（本计划不重跑全套 LH01 OCI） |

---

## 1. 目标与复杂度定义

本计划要验证的不是「单轮聊天有回复」，而是产品在**长会话、多约束、多工具、可恢复故障**下仍收敛到独立 oracle。

| 维度 | 本计划要求 |
| --- | --- |
| **多轮** | ≥4 用户提交；中途改约束 / 只修一半 / 再验证 |
| **复杂** | ≥2 独立缺陷；权限卡 / `ask_user`；文件 + 进程命令 oracle |
| **长程** | 跨 pause/resume、`/compact`、`/goal`、quit+`--continue` 至少覆盖两类 |
| **深度** | 同一次战役串联 visual 场景；中途注入 ACP 断连再 resume |
| **诚实** | 屏幕关键字单独不算过；BLOCKED 须写卡点与交叉证据 |

### 1.1 可信 oracle（按优先级）

1. **工作区文件字节**（`runs.txt` HOLD→GATE、被修 / 未动文件、`loop_out.txt` 精确 token）
2. **PTY / Terminal `history of selected tab`**（对话与产品文案）
3. **独立 checker / digest**（hermetic 与 Rust LH 冻结口径）
4. **请求计数**（resume 后 inference=0；真模型战役记 completion 次数作观测）
5. **PNG**（`screencapture -R` 自窗口 bounds；证据非唯一门）

禁止把下列当必过门：AX textfield、`agent-desktop screenshot`、`press --headed`、`clipboard-set`、整屏关键字「看起来修好了」。

### 1.2 模型与 ACL

| 项 | 值 |
| --- | --- |
| 默认真模型 | `kimi-01/k3.1-pro` |
| ACL | `/Users/roylin/code/config.acl`（**密钥不进仓库证据**） |
| CLI 钉死 | `aster --model kimi-01/k3.1-pro …`（outrank host `default_model`） |
| 额度 / 协议失败 | 记 BLOCKED；可回退 `deepseek/deepseek-flash` + 仓库 `.aster/config.acl`，**不得**静默换模型冒充 kimi 通过 |
| temperature | 若上游 400 要求固定温度，仅在本机 ACL 模型块按 provider 合同调整；证据只记「已钉温度」，不写密钥 |

---

## 2. 分层战役总览

```text
L0  基线 / 成对构建 / agent-desktop 权限
L1  Hermetic（无真模型）—— 门禁，失败则停止真模型
L2  PTY 真模型（权威 Layer C）—— 多轮 + 长程各一
L3  agent-desktop visual 战役（串行，独立 work-dir）
      C4  multiturn shop
      H1  parallel hard（HOLD→GATE）
      H3  retrieval needle
      AL  /compact 后继续
      CL  control-loop R1–R3
L4  长程故障注入（同 session 断连 + resume，不烧自动补全）
L5  （可选）ACP wire live_interactive_dialogue
L6  OUTCOME + 短报
```

执行顺序固定为 **L0 → L1 → L2 → L3(C4→H1→H3→AL→CL) → L4 → L5? → L6**。  
任一层 **产品回归**（非额度）失败：修最小因或停；不得删 oracle 换绿。

---

## 3. 用例表

### L0 — 基线

| ID | 动作 | 通过 | 证据 |
| --- | --- | --- | --- |
| L0-G | `git rev-parse` / `status` / `uname` / toolchain | 落盘 | `r0-git.txt` |
| L0-AD | `agent-desktop status` | accessibility + screen_recording granted | `r0-agent-desktop-status.txt` |
| L0-B | `cargo build --locked -p aster -p aster-acp`；暂存 bins；`--build-id` 一致 | BUILD_ID match | `build-id-*.txt` |

伴生根建议：

```text
.runtime/tui-full-e2e/long-horizon-complex-agent-desktop-$(date +%Y%m%d)/
  bins/  evidence/  workspaces/  home/  state/  logs/
```

### L1 — Hermetic 门禁

| ID | 命令焦点 | 通过 |
| --- | --- | --- |
| L1-T3 | `cargo test -p aster-acp --test tui_913_hermetic three_turns_fix_the_bug_they_diagnosed` | 1 passed |
| L1-LT | `… long_task_repairs_the_check_after_a_failure` | 1 passed |
| L1-UTF8 | `… acp_conformance_stdio fragmented_utf8_…` | 1 passed（连接卫生） |
| L1-BR | `cargo test -p aster-pager --lib acp::aster_spawn::transport_tests` | 5 passed |

失败 → **停止** L2+。

### L2 — PTY 真模型（权威）

环境：`ASTER_CONFIG_FILE=/Users/roylin/code/config.acl`，`ASTER_TUI_BIN` / `ASTER_ACP_BIN` 指向本 checkout 暂存对，`--test-threads=1`。

| ID | 测试 | 通过口径 |
| --- | --- | --- |
| L2-MT | `real_llm_tui_turns_fix_the_diagnosed_bug`（`-p aster --test tui_913_real_llm`，按清单可能 `--ignored`） | `runs.txt` 含 HOLD 后 GATE；文件 oracle |
| L2-LH | `real_llm_tui_long_task_repairs_and_quotes_the_check` | 长程修复 + 引用 check 输出 |

额度 / 鉴权失败 → **BLOCKED**（记 provider 错误类，不改 grader）。  
通过后才宣称「真模型多轮 / 长程在 PTY 层成立」。

### L3 — agent-desktop visual 战役

共用约定：

- App：`终端`；`open -a Terminal` + staged PATH
- 键入：`pbcopy` + System Events paste/return
- 信任对话框 `y`；权限 / `ask_user` 按 `drive_shop_multiturn.answer_dialogs`
- 每案独立 `--work-dir`；`--evidence` 落到伴生 `evidence/<case>/`
- `--model kimi-01/k3.1-pro` + `--config /Users/roylin/code/config.acl`

| ID | 驱动 | 轮次 / 复杂度 | 通过 | 失败 / BLOCKED |
| --- | --- | --- | --- | --- |
| **C4** | `drive_shop_multiturn.py` | diag → 只修 rate → 修 fee → 再跑 gate（≥4 提交） | `DUAL-HOLD` 先于 `DUAL-GATE-7K`；`pass_count≥1`；两文件修复 | 无 HOLD 却 GATE；只修一个文件 |
| **H1** | `drive_lh_parallel_hard.py` | 有序双缺陷 | HOLD→GATE；`fail_before_pass` | 仅 soft GATE（记 soft，不得报 hard 通过） |
| **H3** | `drive_lh_retrieval.py` | 检索 needle → 修嵌套文件 | `RETRIEVE-GATE-9c2e`；decoy 未改；hist 点到正确路径 | 改 decoy；猜路径无检索痕迹 |
| **AL** | `drive_al_compact.py` | HOLD 后 `/compact` 再收敛 | compact 后仍 GATE；HOLD→GATE | compact 后失忆乱改 |
| **CL** | `drive_control_loop.py` | R1 写传感器 → R2 `/goal` pause/resume → R3 quit+`--continue` | `loop_out.txt` token；goal 文案；reopen 后字节仍在 | 任一段缺文件 oracle |

**H1 soft**（`drive_lh_parallel.py`）可作观测，**不**顶替 H1 hard。

每案产出：`*-summary.json`、关键 `*-hist*.txt`、可选 `screens/*.png`、`DRIVE_EXIT`。

### L4 — 长程故障注入（复杂恢复）

在 **已有可 resume 的 session** 上（优先复用 C4/CL 成功后的 session id，或 `/new`+`/session-info`）：

| ID | 步骤 | 通过 |
| --- | --- | --- |
| **F1** | 真模型 session 空闲时 `SIGTERM` 本轮 `aster-acp` | hist：`Agent connection closed` + 日志路径 / `session_end.worker_join` + **同一** `aster --resume <id>` |
| **F2** | `aster --resume <id>`，不提交新用户消息；对 mock 或可计数上游观测 | UI 恢复；**inference 请求 = 0**（允许 1× `/v1/models` catalog，须披露） |
| **F3** | resume 后再提交一条 **只读** 约束确认（例如「Quote the last GATE line; do not edit」） | hist/文件显示仍记得 GATE 语义；无无故重写已绿文件 |

可复用伴生逻辑：  
`.runtime/…/agent-connection-recovery-agent-desktop-20261115/drive_connection_recovery.py`  
以及 visual harness 的 launch 模板。  
**不得**用连接恢复冒烟（欢迎屏无 session）顶替 F1–F3。

### L5 — 可选 ACP wire

| ID | 测试 | 何时跑 |
| --- | --- | --- |
| W1 | `live_interactive_dialogue_real_llm`（有配置时） | L2/L3 绿且需 wire 层 cancel/中途纠偏证据 |

非必过；跳过须在 OUTCOME 写「未跑」。

### L6 — 证据

新建：

```text
docs/evidence/code/<实际日期>-long-horizon-complex-e2e/OUTCOME.md
```

必须含：HEAD、BUILD_ID、agent-desktop 版本/权限、模型 pin、每案命令/退出码/PASS|FAIL|BLOCKED、oracle 计数、证据路径、`Explicitly not claimed`。  
交叉引用本计划与连接恢复 OUTCOME；**勿**覆盖诊断 OUTCOME。

---

## 4. 通过定义（战役级）

战役 **PASS** 当且仅当：

1. L0 + L1 全绿；
2. L2-MT 与 L2-LH 均为 PASS，或之一 BLOCKED（额度）且另一 PASS 并诚实披露；
3. L3：C4、H1 hard、H3、AL、CL **全部** PASS（H1 soft 不计）；
4. L4：F1+F2 PASS；F3 PASS 或诚实 BLOCKED（须说明无法在不烧补全下验证记忆）；
5. 产品 diff 无新增未解释高危；**未提交**（除非用户另令）。

战役 **PARTIAL**：L1 绿 +（L2 或 L3 子集）绿 + 其余 BLOCKED/未跑写清。  
战役 **FAIL**：任一必过案产品性失败（非额度）。

---

## 5. Explicitly out of scope / not claimed

- Studio 原生 CUA / `apps/studio/tests/e2e/interactive-coding/cua-long-horizon-plan.md`
- LH01 OCI / Rust guest 全量 qualification 战役（合同在 `long_horizon_*`，本计划不重开）
- GUI 复现 UTF-8 stdin 分片
- 硬证明「产品并行 subagent 工具重叠」（H1 只证明有序 HOLD→GATE）
- 安装替换 `~/.local/bin`；提交 / 推送
- 把 DeepSeek 旧 OUTCOME 改写成 kimi 通过
- 密钥、session-store 原文进仓库

---

## 6. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| kimi 额度 / 400 temperature | BLOCKED + 可选 deepseek 回退分栏记录 |
| 真模型不跑 gate / 跳过 HOLD | 失败；不改 `gate.py`；可加一轮明确「Run exactly python3 gate.py」 |
| agent-desktop 丢窗 | 启动前 `open -a Terminal`；title tag + pre-launch window id |
| 长战役串扰 | 每案独立 work-dir / state；案间 `pkill` 仅针对 staged bins |
| 把 visual 当权威 | OUTCOME 标明 L2 PTY 为真模型权威；visual 为伴生 |

---

## 7. 交付短报模板（执行智能体填）

```text
战役：long-horizon-complex；模型=…
L0/L1：…
L2：MT=… LH=…
L3：C4=… H1=… H3=… AL=… CL=…
L4：F1=… F2=… F3=…
L5：…
证据：docs/evidence/code/…/OUTCOME.md
未做/BLOCKED：…
提交：未提交
```
