# Aster ACP stdio EAGAIN：端到端执行提示词

状态：产品修复已在工作区落地（`RetryTransient*` + 产品路径接线）；本文件是
**EAGAIN / WouldBlock 背压不断连** 的权威执行合同。日期基线：2026-11-15。

工作目录：Aster 仓库根。**直接把本文交给执行智能体。**  
不要重做产品修复，除非 E2E 证明现有 diff 有缺陷。  
不要发明 `mock-aster` / `go build` 等仓库中不存在的二进制。  
不要把「故意 SIGTERM ACP」的断连用例顶替「背压下会话仍活」。

## 0. 权威与参考

| 文档 | 角色 |
| --- | --- |
| **本文** | 执行合同（冲突时以本文为准） |
| `docs/evidence/code/2026-11-15-acp-stdio-egain/E2E-TEST-PLAN.md` | 用例矩阵与通过定义 |
| `docs/evidence/code/2026-11-15-acp-stdio-egain/OUTCOME.md` | 产品修复与路径审计（非 E2E 通过） |
| `crates/terminal/crates/codegen/aster-acp-lib/src/transient_io.rs` | `RetryTransient*` 实现与 hermetic |
| `docs/evidence/code/2026-11-15-agent-connection-recovery/E2E-CASES-KIMI01-PLAN.md` | GUI / Terminal history 先例 |
| `docs/implementation-prompt-aster-agent-connection-recovery-agent-desktop-e2e.md` | 断连 V1–V5 执行先例（对照用） |
| `apps/aster/tests/visual_tui_harness/README.md` | agent-desktop + Terminal 可信信号 |
| 根 `AGENTS.md` Verification | GUI 必须用当前 checkout 构建 |

私有伴生（可复用，**不**当产品源码提交）：

```text
.runtime/tui-full-e2e/acp-stdio-egain-agent-desktop-YYYYMMDD/
  bins/  evidence/  logs/  workspace/  home/  state/
  drive_stdio_egain.py   # 新建或从 connection-recovery 驱动演进
```

可选本机 ACL（**默认 GUI 仍用伴生内 mock ACL**；P4 live 仅当用户授权）：

```text
/Users/roylin/code/config.acl
~/.aster/config.acl
```

## 1. 已完成与仍缺

### 1.1 已完成（不得重复宣称“未修”）

- `aster_acp_lib::{RetryTransientWrite, RetryTransientRead, is_transient_io}`。
- 产品接线：`aster-acp` 主路径与 `startup_error`；pager `aster_spawn` /
  `leader_bridge`；shell stdio/headless/leader/server/in_process；
  `aster-test-support` 与 shell `testkit/e2e`。
- Hermetic：`transient_io` 5 测（含 macOS os error 35 Display）；产品
  `OUTCOME.md` 已记命令与审计表。

### 1.2 本提示词必须完成

| ID | 目标 | 完成标准 |
| --- | --- | --- |
| P0 | 基线 / 成对构建 / agent-desktop | BUILD_ID 一致；权限 granted |
| P1 | Hermetic 快检 | P1-W/U/T/C 全绿 |
| P2 | 进程级背压核 | P2-A + P2-B PASS（或诚实产品/环境分类） |
| P3 | agent-desktop E1→E3→E2 | 背压存活 + SIGTERM 断连对照 + `/quit` 对照 |
| P5 | `E2E-OUTCOME.md` + 短报 | 未提交 |

P4（inkstone 类 live）默认 **SKIP**；仅当用户点名并提供工作区/额度时跑，
否则 BLOCKED 并写入 Explicitly not claimed。

**Explicitly out of scope**

- Studio / `just build-studio`；发布通道安装替换；提交/推送。
- 调高索引 64MiB 预算当作本修复通过。
- 用连接恢复 V1–V5 全套顶替本战役 E1。
- 把 AX textfield、`agent-desktop screenshot`、整屏关键字当必过门。

## 2. 实施约束

- 保留工作区其他改动。不开新 worktree；不提交；不推送；不 `git reset --hard`。
- GUI / P2 前必须从**本 checkout** 重建并暂存 `aster`+`aster-acp`，两
  `--build-id` 一致。禁止用 `~/.local/bin` 旧安装冒充通过。
- 可信 oracle（优先级）：
  1. 成对 `--build-id`
  2. hermetic 测试计数
  3. 进程存活 + ACP 日志**无** `aster_acp::stdio` + `-32603` +
     `os error 35` / `Resource temporarily unavailable`
  4. Terminal `history of selected tab`（E2/E3 主断言文本）
  5. PNG / `screencapture` 仅证据
- 应用名：`终端`。先 `agent-desktop status`（accessibility + screen_recording）。
- 默认：伴生 mock ACL + `ASTER_DISABLE_*_ACCOUNT=1`；不烧真模型（P4 除外）。
- 键入：`pbcopy` + System Events paste/return；信任对话框答 `y`。
- 密钥与 session-store **不**写入仓库证据。
- 产品 FAIL 不停改 oracle；额度/权限/harness 限制记 BLOCKED。

## 3. P0：基线与构建

证据根：

```sh
EV=.runtime/tui-full-e2e/acp-stdio-egain-agent-desktop-$(date +%Y%m%d)
mkdir -p "$EV/bins" "$EV/evidence" "$EV/logs" "$EV/workspace" "$EV/home" "$EV/state"
```

1. 写入 `$EV/evidence/p0-git.txt`：
   `git rev-parse HEAD`、`git status --short`、`uname -sm`、
   `rustc --version`。确认 status 含 `transient_io` / stdio wrap 相关路径。
2. `cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp`
   → 拷贝到 `$EV/bins/`；日志 `p0-build.log`。
3. `$EV/bins/aster --build-id` 与 `$EV/bins/aster-acp --build-id` →
   `p0-build-id-*.txt`；必须一致。
4. `agent-desktop status` → `p0-agent-desktop-status.txt`；未授权则停 P3。

P0 失败：停止；不进 P2/P3。

## 4. P1：Hermetic

全部写入 `$EV/evidence/`（或 tee 到同名 `.log`）：

```sh
cargo test --locked -p aster-acp-lib --lib transient_io -- --test-threads=1
cargo test --locked -p aster-acp --test acp_conformance_stdio \
  fragmented_utf8_session_new_survives_outbound_interleave -- --test-threads=1
cargo test --locked -p aster-pager --lib acp::aster_spawn::transport_tests \
  -- --test-threads=1
cargo clippy --locked -p aster-acp-lib -p aster-acp --bin aster-acp \
  --all-targets --no-deps
```

任一条产品性失败：停止 GUI；先修产品。

## 5. P2：进程级背压核

优先在仓库内加 hermetic integration（例如
`crates/code/acp/tests/` 或伴生脚本），对**真实** `$EV/bins/aster-acp`
或最小 ACP fixture：

### P2-A 慢读 stdout

1. 启动 agent；客户端故意慢读/短时不读 stdout。
2. 促使 agent 写出多帧 NDJSON（initialize / 通知洪泛）。
3. 背压窗口内断言：进程未因 stdio `-32603` +
   `Resource temporarily unavailable` 退出。
4. 恢复读取后完成至少一轮 request/response。

若本机管道在 blocking 下只「卡住」而不返回 EAGAIN：仍以「无 `-32603` 自杀 +
恢复读后协议存活」为过门。**禁止**把 P1 的注入 WouldBlock 冒充 P2-A E2E。

### P2-B BrokenPipe 仍致命

关闭对端读端后继续写：允许 transport 关闭 / 非零退出。不得被 P2-A
「不断连」口径误判为通过。

证据：`p2a-*.log`、`p2b-*.log`、脱敏 ACP 日志摘录。

## 6. P3：agent-desktop（顺序 E1 → E3 → E2）

统一：staged bins；应用名 `终端`；mock ACL；独立 `ASTER_LOG_DIR=$EV/logs/...`。

| ID | 动作 | 通过 |
| --- | --- | --- |
| **E1** | 起 `aster` → 可交互；对 live `aster-acp` stdout 短暂停读/节流再恢复 | history **无** `Agent connection closed`；进程仍在；日志无 stdio `-32603`/`os error 35` 致命行；恢复后 pager 仍存活 |
| **E3** | `SIGTERM` live `aster-acp` | history **有** `Agent connection closed` 且含日志路径或 `session_end.worker_join` |
| **E2** | `/quit`，不杀 ACP | **无** `Agent connection closed` bail |

E1 若 harness 无法可靠节流 stdout：记 **BLOCKED（harness）**，不得用 E3 顶替；
此时战役若要宣称背压核部分通过，**必须** P2-A 已 PASS。

可复用/演进 connection-recovery 伴生驱动；新逻辑放在本战役 `EV` 目录，勿污染
旧战役证据树。

## 7. P4：超大仓 live（默认 SKIP）

仅当用户明确授权工作区路径与模型额度：

- 使用本 checkout bins；
- 一轮工具对话；
- 通过：会话不因 stdio `os error 35` 死；允许索引 `BudgetExceeded` 警告；
- 否则 BLOCKED，写入 Explicitly not claimed。

## 8. P5：证据与短报

写入：

```text
docs/evidence/code/2026-11-15-acp-stdio-egain/E2E-OUTCOME.md
```

须含：环境与 BUILD_ID、P0–P3（及 P4）每案结果与证据路径、
`Explicitly not claimed`、短报。

短报模板：

```text
战役：acp-stdio-egain-e2e
P0：HEAD=…；BUILD_ID=…
P1：transient_io=…；utf8=…；transport=…；clippy=…
P2：A=… B=…
P3：E1=… E3=… E2=…
P4：SKIP|BLOCKED|PASS
判定：PASS|PARTIAL|FAIL
证据：docs/evidence/code/2026-11-15-acp-stdio-egain/E2E-OUTCOME.md
```

## 9. 战役通过定义

与 `E2E-TEST-PLAN.md` §5 一致：

- **PASS**：P0+P1+P2 全绿；P3 E1（或 E1 harness BLOCKED 且 P2-A PASS 已披露）+
  E3+E2 绿；P4 SKIP/BLOCKED 已披露。
- **PARTIAL**：P0+P1+P2 绿 + P3 子集绿 + 其余非产品 BLOCKED。
- **FAIL**：P1/P2/P3 任一条产品性失败，或用旧安装 bin 冒充通过。

## 10. 完成检查清单

- [ ] P0 证据齐全；BUILD_ID 成对
- [ ] P1-W/U/T/C 实际退出码已记
- [ ] P2-A/B 有命令、日志摘录、判定
- [ ] P3 E1→E3→E2 有 history / 日志证据；E1 BLOCKED 时未用 E3 顶替
- [ ] P4 默认 SKIP 或诚实 BLOCKED
- [ ] `E2E-OUTCOME.md` 含 Explicitly not claimed 与短报
- [ ] 未提交、未推送、未改用户安装通道

执行完毕后向用户给出短报与 `E2E-OUTCOME.md` 路径；不要声称产品
`OUTCOME.md` 已覆盖本轮 E2E。
