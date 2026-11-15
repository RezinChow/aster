# Aster 连接恢复：审查 + agent-desktop 端到端执行提示词

状态：产品修复已在工作区落地；hermetic 与欢迎屏断连伴生已通过。
本文件是**审查 + agent-desktop E2E** 的权威执行合同。日期基线：2026-11-15。

工作目录：Aster 仓库根。**直接把本文交给执行智能体。**
不要重做 P1–P3 产品修复，除非审查或 E2E 证明现有 diff 有缺陷。
不要发明 `mock-aster` / `go build` 等仓库中不存在的二进制。

## 0. 权威与参考

| 文档 | 角色 |
| --- | --- |
| **本文** | 执行合同（冲突时以本文为准） |
| `docs/implementation-prompt-aster-agent-connection-recovery.md` | 原 P0–P5 产品修复合同 |
| `docs/evidence/code/2026-11-15-agent-connection-diagnosis/OUTCOME.md` | 诊断边界；勿改写成修复通过 |
| `docs/evidence/code/2026-11-15-agent-connection-recovery/OUTCOME.md` | 已记录修复与欢迎屏伴生 |
| `docs/evidence/code/2026-11-15-agent-connection-recovery/E2E-CASES-KIMI01-PLAN.md` | `kimi-01` 规划参考（非执行权威） |
| `docs/evidence/code/2026-11-15-agent-connection-recovery/E2E-CASES-KIMI-PLAN.md` | Kimi 额度耗尽时的整理稿 |
| `apps/aster/tests/visual_tui_harness/README.md` | agent-desktop + Terminal 可信信号 |
| 根 `AGENTS.md` Verification | GUI 必须用当前 checkout 构建 |
| `docs/implementation-prompt-aster-long-horizon-complex-agent-desktop-e2e.md` | 后续深度多轮 / 长程战役（另案；勿与本文断连冒烟混为一谈） |

私有伴生（可复用，**不**当产品源码提交）：

```text
.runtime/tui-full-e2e/agent-connection-recovery-agent-desktop-20261115/
  drive_connection_recovery.py   # 已覆盖 V1；须演进覆盖 V2–V5
  bins/  evidence/  logs/  …
```

可选本机 ACL（**默认 GUI 仍用伴生内 mock ACL**；真模型仅当 V2 取 session
明确 BLOCKED 且用户另行授权时才考虑）：

```text
/Users/roylin/code/config.acl    # 含 providers "kimi-01" / "kimi-02" …
~/.aster/config.acl              # 用户默认；可能额度耗尽
```

## 1. 已完成与仍缺

### 1.1 已完成（不得重复宣称“未修”）

- P1：`aster-acp` stdin → `LineBufferedRead`；hermetic
  `fragmented_utf8_session_new_survives_outbound_interleave` 已绿。
- P2：stdio 结构化 tracing；bridge 有界 stderr；TUI bail 含日志目录 /
  `session_end.worker_join`。
- P3：合法 `tool_unavailable` → `__parse_error`；身份/协议失败仍 fail closed。
- 欢迎屏伴生 V1：杀 live `aster-acp` → history 含
  `Agent connection closed` + `ASTER_LOG_DIR` 路径；`DRIVE_EXIT=0`。

### 1.2 本提示词必须完成

| ID | 目标 | 完成标准 |
| --- | --- | --- |
| R0 | 基线 / 成对构建 / hermetic 快检 | BUILD_ID 一致；UTF-8 + transport 测试绿 |
| R1 | 书面审查落盘 | `r1-review.md`：高危/非阻塞/Bugbot |
| V1 | 欢迎屏断连冒烟 | 再确认暂存二进制仍具备 P2 文案 |
| V3 | `/quit` 对照 | **无** `Agent connection closed` |
| V2 | 有 session 断连 + 同 id resume 提示 | 通过，或诚实 BLOCKED + 交叉证据 |
| V5 | 日志/bridge 字段只读 | 有则摘录；无则记 not claimed |
| V4 | 显式 resume，0 自动模型请求 | 随 V2；须有请求计数 oracle |
| R3 | OUTCOME + 短报 | 未提交 |

**Explicitly out of scope**

- Studio / `just build-studio`；Inkstone；替换用户安装二进制；提交/推送。
- GUI 复现 UTF-8 stdin 分片。
- 修绿 `delayed_catalog_keeps_draft_and_explicit_effort`（基线也 flake）。
- 把 AX textfield、`agent-desktop screenshot`、`press --headed`、`clipboard-set`
  当必过门。

## 2. 实施约束

- 保留工作区其他改动。不开新 worktree；不提交；不推送；不 `git reset --hard`。
- GUI 前必须从**本 checkout** 重建并暂存 `aster`+`aster-acp`，两
  `--build-id` 一致。禁止用 `~/.local/bin` 旧安装冒充通过。
- 可信 oracle：
  - `agent-desktop list-windows` / `focus-window` /（可选）`snapshot`
  - Terminal `history of selected tab`（**主断言文本**）
  - `screencapture -R` 自 agent-desktop 窗口 bounds（证据，非唯一断言）
  - `$ASTER_LOG_DIR` ACP 日志、伴生 `result-*.json` / `*-hist.txt`
  - V4：mock 上游请求计数 / 对 loopback 的连接观测
- 应用名：`终端`。先 `agent-desktop status`（accessibility + screen_recording）。
- 默认：伴生 mock ACL + `127.0.0.1:9` 黑洞 + `ASTER_DISABLE_*_ACCOUNT=1`。
- 键入：`pbcopy` + System Events paste/return；信任对话框答 `y`。
- 不关闭权限检查；不猜工具名；不把协议错误一律改成可重试。
- 密钥与 session-store **不**写入仓库证据。

## 3. R0：基线与构建

证据根：

```sh
EV=.runtime/tui-full-e2e/agent-connection-recovery-agent-desktop-$(date +%Y%m%d)
mkdir -p "$EV/bins" "$EV/evidence" "$EV/logs" "$EV/workspace" "$EV/home" "$EV/state"
```

1. 写入 `$EV/evidence/r0-git.txt`：
   `git rev-parse HEAD`、`git status --short`、`uname -sm`、
   `rustup show active-toolchain`。
2. `agent-desktop status` → `$EV/evidence/r0-agent-desktop-status.txt`。
3. 确认 recovery diff 仍在（勿误还原）：

```text
Cargo.lock
crates/code/acp/Cargo.toml
crates/code/acp/src/bin/aster-acp.rs
crates/code/acp/tests/acp_conformance_stdio.rs
crates/code/core/src/llm/cursor_account/mcp.rs
crates/code/core/src/llm/cursor_account/mcp/tests.rs
crates/terminal/crates/codegen/aster-pager/src/acp/aster_spawn.rs
crates/terminal/crates/codegen/aster-pager/src/acp/aster_spawn/transport_tests.rs
crates/terminal/crates/codegen/aster-pager/src/app/mod.rs
```

4. 成对构建并暂存：

```sh
cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp
cp -f target/debug/aster target/debug/aster-acp "$EV/bins/"
"$EV/bins/aster" --build-id | tee "$EV/evidence/build-id-aster.txt"
"$EV/bins/aster-acp" --build-id | tee "$EV/evidence/build-id-acp.txt"
diff -u "$EV/evidence/build-id-aster.txt" "$EV/evidence/build-id-acp.txt"
```

5. Hermetic（失败则**停止 GUI**）：

```sh
cargo test --locked -p aster-acp --test acp_conformance_stdio \
  fragmented_utf8_session_new_survives_outbound_interleave -- --test-threads=1 \
  2>&1 | tee "$EV/evidence/r0-hermetic-utf8.log"
cargo test --locked -p aster-pager --lib acp::aster_spawn::transport_tests \
  -- --test-threads=1 \
  2>&1 | tee "$EV/evidence/r0-hermetic-transport.log"
```

## 4. R1：审查（先于扩面 GUI）

输出 `$EV/evidence/r1-review.md`（可再摘要进 OUTCOME）。至少覆盖：

1. **ACP stdin**：`LineBufferedRead::spawn_local` 在 LocalSet 内；先 tracing
   再 `agent.close()`。
2. **Bridge**：stderr 有界；Failed 在 cleanup kill 前保留 observed status /
   摘要；Cancelled 仍清洁成功。
3. **TUI bail**：故障含日志位置；正常退出 `connection_closed == false`。
4. **Cursor mcp**：catalog miss 不别名；`synthetic-secret` 不回显；
   provider/server/approval/非法协议仍 NonRetryable。
5. **回归风险**：无跨 await 的阻塞 Mutex；cleanup kill 不冒充原始退出原因。

可选：对未提交 recovery diff 跑 Bugbot。finding 被校验器剔除时仍须写明
“无有效 finding”或手工判定。

高危 → 本任务内最小修复 + 重跑 R0 hermetic，再进 R2。非阻塞只记 REVIEW。

## 5. R2：agent-desktop 用例

### 5.1 驱动要求

演进
`.runtime/.../drive_connection_recovery.py`（或同目录新建
`drive_connection_recovery_v2.py`），按用例输出独立证据文件（见下表）。
驱动留在 `.runtime/`，不要把用户 session-store 拷进仓库。

启动模板（与已有伴生一致）：`PATH` 指向 `$EV/bins`，
`ASTER_CONFIG` 指向伴生 mock ACL，`ASTER_STATE_HOME` / `ASTER_HOME` /
`ASTER_LOG_DIR` 指向 `$EV/...`，`ASTER_DISABLE_*_ACCOUNT=1`，
`open -a Terminal` 跑 `launch_aster.sh`，`printf '\033]0;TAG\007'` 绑窗。

### 5.2 取得 sessionId（V2 关键）

优先**不打模型**：

1. 欢迎屏 → 信任对话框（若有）答 `y`。
2. 提交 `/new`（shipped e2e 使用的产品路径）或欢迎屏 **New** / 等价入口，
   直到出现可交互 composer。
3. 提交 `/session-info`；从 Terminal history 解析 session id
   （写入 `v2-session-id.txt`）。
4. 备选：从 `$ASTER_STATE_HOME` / session-store 元数据读取（只读；勿提交
   原始 store）。

若以上均无法在不发起 chat completion 的前提下得到 sessionId：
**V2=BLOCKED**，记录卡点；交叉引用

```sh
ASTER_TUI_BIN="$PWD/target/debug/aster" \
ASTER_ACP_BIN="$PWD/target/debug/aster-acp" \
  cargo test --locked -p aster-acp --test shipped_tui_e2e \
  shipped_tui_launch_resume_and_visible_commands -- --test-threads=1
```

作为交叉证据。**不得**假装 V2 GUI 通过。不要为取 id 擅自改用真模型，
除非用户在本任务中明确授权并指定 `kimi-01/...`。

### 5.3 用例表与执行顺序

```text
V1 → V3 → V2 → V5 → V4
```

| 用例 | 目标 | 关键步骤 | 通过 | 失败 / BLOCKED | 证据文件 |
| --- | --- | --- | --- | --- | --- |
| **V1** | P2 文案仍在 | 启动 → ready → `SIGTERM` 新 `aster-acp` | history 含 `Agent connection closed` **且**日志路径或 `session_end.worker_join` | 无故障文案 | `v1-result.json`, `v1-ready-hist.txt`, `v1-closed-hist.txt`, `v1-after-kill.png` |
| **V3** | 主动退出≠崩溃 | 启动 → `/quit`（不杀 ACP） | history **无** `Agent connection closed`；允许 Saving session | 正常退出写成崩溃 | `v3-result.json`, `v3-quit-hist.txt` |
| **V2** | 同 session resume 提示 | `/new`+`/session-info` 取 id → 杀 ACP | 故障 bail + **同一** id 的 `aster --resume …`（或 `--minimal --resume`） | 无 resume / id 不符；取不到 id → **BLOCKED** | `v2-result.json`, `v2-session-id.txt`, `v2-closed-hist.txt`, `v2-disconnect.png` |
| **V5** | 日志可定位 | 读 V2 的 `ASTER_LOG_DIR` / worker_join | 有 exit/`acp_stderr=`/transport 则脱敏摘录；无则记缺口 | 不单票否决 V2 | `v5-bridge-fields.txt`, `v5-acp-log-excerpt.txt` |
| **V4** | resume 不自动烧模型 | `aster --resume <id>`；不提交新消息 | 恢复语义 + mock 请求计数 **0** | 无计数 oracle → BLOCKED；V2 BLOCKED → 本项 BLOCKED | `v4-result.json`, `v4-resume-hist.txt`, `v4-mock-request-count.json`, 可选 `v4-resume.png` |

V1：`has_resume_hint` 在无 session 时允许 false，原因写入 `v1-result.json`。

V4 请求计数建议：伴生 mock 改为可计数的 loopback listener（只记 HTTP
请求次数，不实现模型），或观测进程是否对配置的 `base_url` host:port
发起连接；黑洞 `127.0.0.1:9` 若无法观测则 BLOCKED，勿用屏幕关键字顶替。

## 6. R3：证据与交付

新建（推荐）或追加：

```text
docs/evidence/code/<实际日期>-agent-connection-recovery-agent-desktop/OUTCOME.md
```

必须交叉引用
`docs/evidence/code/2026-11-15-agent-connection-recovery/OUTCOME.md`，
**勿**覆盖诊断 OUTCOME。

OUTCOME 至少含：HEAD、BUILD_ID、agent-desktop 版本与权限、R1 摘要、
每条 V 的命令/退出码/通过|失败|BLOCKED、证据路径、
`Explicitly not claimed`。

交付短报（完成后原样给出）：

```text
审查：高危=…；非阻塞=…；Bugbot=…
构建：pair BUILD_ID=…；暂存目录=…
agent-desktop：V1=… V3=… V2=… V5=… V4=…
对照：hermetic fragmented=…；transport_tests=…；shipped resume 交叉=…
证据：docs/evidence/code/…/OUTCOME.md
未做/BLOCKED：…
提交：未提交
```

### 完成定义

- R1 已落盘；V1 与 V3 通过。
- V2 通过，或诚实 BLOCKED 并有 shipped 交叉说明。
- V4 随 V2；V5 已执行并记录。
- 产品 diff 无新增未解释高危问题；未提交代码。

### Explicitly not claimed（须写入 OUTCOME）

- 历史第二次断连触发 = UTF-8 分片（诊断仍未知）。
- Studio / Inkstone / 安装替换 / 提交推送。
- GUI UTF-8 分片复现。
- `delayed_catalog` flake 已修。
- V2/V4 在 BLOCKED 时的“GUI 通过”。
- 任何虚构 `mock-aster` 路径的结果。
