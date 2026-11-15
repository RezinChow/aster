# Aster：深度多轮 / 复杂长程 E2E 执行提示词

状态：规划已落盘；**本文件是执行合同**。日期基线：2026-11-15。  
工作目录：Aster 仓库根。**直接把本文交给执行智能体。**

详细用例表与复杂度定义见（冲突时以**本文**为准）：

`docs/evidence/code/2026-11-15-long-horizon-complex-e2e/E2E-TEST-PLAN.md`

不要发明 `mock-aster` / `go build`。不要跑 Studio。不要提交 / 推送，除非用户在本任务中明确要求。

---

## 0. 权威与参考

| 文档 | 角色 |
| --- | --- |
| **本文** | 执行合同 |
| `…/2026-11-15-long-horizon-complex-e2e/E2E-TEST-PLAN.md` | 用例与通过定义详表 |
| `apps/aster/tests/visual_tui_harness/README.md` | agent-desktop 信号 |
| `crates/code/acp/tests/tui_913_inventory.md` | Layer A/C 地图 |
| `docs/evidence/code/2026-11-09-visual-lh-deepseek/OUTCOME.md` | visual LH 先例 |
| `docs/evidence/code/2026-11-15-agent-connection-recovery-agent-desktop/OUTCOME.md` | 断连伴生已绿 |
| 根 `AGENTS.md` Verification | GUI 必须用当前 checkout 构建 |

私有伴生（可新建；**不**当产品源码提交）：

```text
.runtime/tui-full-e2e/long-horizon-complex-agent-desktop-$(date +%Y%m%d)/
  bins/  evidence/  workspaces/  home/  state/  logs/
```

真模型 ACL（密钥**永不**写入仓库证据）：

```text
/Users/roylin/code/config.acl          # providers "kimi-01" → k3.1-pro
仓库 .aster/config.acl                 # deepseek 回退时用
```

默认真模型 pin：`kimi-01/k3.1-pro`（CLI `--model` outrank default）。  
额度 / 协议 BLOCKED 时：可改跑 `deepseek/deepseek-flash` + `.aster/config.acl`，OUTCOME **分栏**记录，禁止把 deepseek 成绩标成 kimi 通过。

---

## 1. 必须完成

| ID | 目标 | 完成标准 |
| --- | --- | --- |
| L0 | 基线 / 成对构建 / 权限 | BUILD_ID 一致；agent-desktop accessibility + screen_recording |
| L1 | Hermetic 门禁 | three_turns + long_task + utf8 + transport_tests 绿 |
| L2 | PTY 真模型权威 | `real_llm_tui_turns_fix_the_diagnosed_bug` + `real_llm_tui_long_task_…` PASS 或诚实 BLOCKED |
| L3 | Visual 战役串行 | C4、H1-hard、H3、AL、CL 全 PASS |
| L4 | 断连 + resume + 记忆探针 | F1+F2 PASS；F3 PASS 或 BLOCKED 说明 |
| L6 | OUTCOME + 短报 | 未提交 |

L5（ACP wire live dialogue）可选；未跑须写明。

**Explicitly out of scope：** Studio；LH01 OCI 全量；GUI UTF-8 分片；安装替换；提交推送；改 grader 换绿。

---

## 2. 实施约束

- 保留工作区其他改动；不开新 worktree；不 `git reset --hard`。
- GUI / PTY 前从**本 checkout** 重建并暂存 `aster`+`aster-acp`，两 `--build-id` 一致。禁止 `~/.local/bin` 旧安装冒充通过。
- 可信 oracle：工作区文件 > Terminal history > digest/checker > 请求计数 > PNG。
- App 名：`终端`。键入：`pbcopy` + System Events；信任答 `y`。
- 不关闭权限检查；不猜工具名；密钥与 session-store **不**进仓库。
- 每案独立 `--work-dir`；案间只杀 **staged** `bins/aster*`，勿误杀用户其它 Aster。
- 屏幕关键字、AX-only、整屏截图单独不算通过。

---

## 3. L0：基线与构建

```sh
EV=.runtime/tui-full-e2e/long-horizon-complex-agent-desktop-$(date +%Y%m%d)
mkdir -p "$EV"/{bins,evidence,workspaces,home,state,logs}
{
  git rev-parse HEAD
  git status --short
  uname -sm
  rustup show active-toolchain
} | tee "$EV/evidence/r0-git.txt"
agent-desktop status 2>&1 | tee "$EV/evidence/r0-agent-desktop-status.txt"

cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp
cp -f target/debug/aster target/debug/aster-acp "$EV/bins/"
"$EV/bins/aster" --build-id | tee "$EV/evidence/build-id-aster.txt"
"$EV/bins/aster-acp" --build-id | tee "$EV/evidence/build-id-acp.txt"
diff -u "$EV/evidence/build-id-aster.txt" "$EV/evidence/build-id-acp.txt"
```

---

## 4. L1：Hermetic（失败则停止真模型）

```sh
cargo test --locked -p aster-acp --test tui_913_hermetic \
  three_turns_fix_the_bug_they_diagnosed -- --test-threads=1 \
  2>&1 | tee "$EV/evidence/l1-three-turns.log"

cargo test --locked -p aster-acp --test tui_913_hermetic \
  long_task_repairs_the_check_after_a_failure -- --test-threads=1 \
  2>&1 | tee "$EV/evidence/l1-long-task.log"

cargo test --locked -p aster-acp --test acp_conformance_stdio \
  fragmented_utf8_session_new_survives_outbound_interleave -- --test-threads=1 \
  2>&1 | tee "$EV/evidence/l1-utf8.log"

cargo test --locked -p aster-pager --lib acp::aster_spawn::transport_tests \
  -- --test-threads=1 \
  2>&1 | tee "$EV/evidence/l1-transport.log"
```

---

## 5. L2：PTY 真模型

```sh
export ASTER_CONFIG_FILE=/Users/roylin/code/config.acl
export ASTER_TUI_BIN="$PWD/$EV/bins/aster"
export ASTER_ACP_BIN="$PWD/$EV/bins/aster-acp"
# 若测试包要求 ignored，按 tui_913_inventory / 测试源码加 --ignored
cargo test --locked -p aster --test tui_913_real_llm \
  real_llm_tui_turns_fix_the_diagnosed_bug -- --test-threads=1 --nocapture \
  2>&1 | tee "$EV/evidence/l2-multiturn.log"

cargo test --locked -p aster --test tui_913_real_llm \
  real_llm_tui_long_task_repairs_and_quotes_the_check -- --test-threads=1 --nocapture \
  2>&1 | tee "$EV/evidence/l2-long-task.log"
```

- 通过：文件 / runs oracle 与测试断言一致。  
- 额度 / 401 / 上游 400：`BLOCKED`，记录错误类；可按 §0 回退 deepseek **另跑**并分栏。  
- 不得改 fixture 或放宽断言。

---

## 6. L3：agent-desktop visual（固定顺序）

```text
C4 → H1-hard → H3 → AL → CL
```

模板（每案换 `CASE` / `WORK`）：

```sh
CFG=/Users/roylin/code/config.acl
MODEL=kimi-01/k3.1-pro
CASE=c4-multiturn
WORK="$EV/workspaces/$CASE"
EVID="$EV/evidence/$CASE"
mkdir -p "$WORK" "$EVID"
python3 apps/aster/tests/visual_tui_harness/drive_shop_multiturn.py \
  --bin-dir "$EV/bins" --work-dir "$WORK" --model "$MODEL" \
  --config "$CFG" --evidence "$EVID" \
  2>&1 | tee "$EVID/drive.log"
echo DRIVE_EXIT=$?
```

| 案 | 脚本 |
| --- | --- |
| C4 | `drive_shop_multiturn.py` |
| H1 | `drive_lh_parallel_hard.py`（**不要**用 soft `drive_lh_parallel.py` 顶替） |
| H3 | `drive_lh_retrieval.py` |
| AL | `drive_al_compact.py` |
| CL | `drive_control_loop.py` |

通过口径见计划 §3 L3 表。保存各案 `*-summary.json` 与关键 hist/PNG。  
案失败：保留证据；产品性失败 → 战役 FAIL；额度 → BLOCKED 该案并继续或按计划停（默认：**必过案 BLOCKED 则战役 PARTIAL，继续记其余**）。

---

## 7. L4：断连 / resume / 记忆

1. 从 C4 或 CL 证据取 `session_id`（`/session-info` 或 summary）；写入 `$EV/evidence/l4-session-id.txt`。
2. **F1**：staged 启动同一 workspace + resume 或新会话至 idle → `SIGTERM` 新 `aster-acp` → history 须含 `Agent connection closed` + 日志提示 + **同一 id** 的 `aster --resume …`。
3. **F2**：`aster --resume <id>`，不提交新消息；用可计数 loopback（或观测）证明 **inference=0**；允许披露 1× `/v1/models`。
4. **F3**：再提交只读确认句；不得无故改写已 GATE 文件。

可复用：

```text
.runtime/tui-full-e2e/agent-connection-recovery-agent-desktop-20261115/drive_connection_recovery.py
```

演进为真模型 session 路径，或同目录新建 `drive_lh_fault_inject.py`（留在 `.runtime/`）。

欢迎屏无 session 的断连冒烟 **不算** F1。

---

## 8. L6：证据与交付

```text
docs/evidence/code/<实际日期>-long-horizon-complex-e2e/OUTCOME.md
```

交叉引用：

- 本计划 `E2E-TEST-PLAN.md`
- `docs/evidence/code/2026-11-15-agent-connection-recovery-agent-desktop/OUTCOME.md`
- 若用 deepseek 回退：先例 OUTCOME（不得覆盖）

OUTCOME 至少含：HEAD、BUILD_ID、agent-desktop、模型 pin、每案命令/码/状态、oracle 摘要、证据路径、`Explicitly not claimed`。

完成后原样给出短报：

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

### 完成定义

- L0+L1 绿；L3 五案全 PASS；L4 F1+F2 PASS。
- L2 双 PASS，或额度 BLOCKED 已分栏披露。
- F3 已执行或诚实 BLOCKED。
- 未提交代码；密钥未入库。

### Explicitly not claimed（写入 OUTCOME）

- Studio CUA 长程。
- LH01 OCI / 全量 Rust guest qualification。
- GUI UTF-8 分片复现。
- 硬证明并行 subagent 工具重叠。
- 零 HTTP catalog 探针（若观测到 `/v1/models`）。
- 用 deepseek 成绩冒充 kimi。
- 任何虚构 `mock-aster` 路径。
