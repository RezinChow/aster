# 连接恢复 agent-desktop E2E 用例规划（kimi-01）

- 配置：`/Users/roylin/code/config.acl` → providers `"kimi-01"`
- 规划模型：`kimi-01/kimi-for-coding-highspeed`（第二稿，纠正虚构 mock-aster）
- 依据：`docs/implementation-prompt-aster-agent-connection-recovery-agent-desktop-e2e.md`
- 日期：2026-11-15
- 说明：规划产物，非执行通过证据。密钥未写入。

# Aster 连接恢复 E2E 用例规划（修正版）

> 范围：仅覆盖本仓库真实产物 `aster` / `aster-acp`，替代旧版虚构的 `mock-aster/go build` 路径。  
> GUI 信号以 macOS Terminal.app + `agent-desktop`（应用本地化名「终端」）为准，断言来源为 **Terminal history of selected tab**。  
> UTF-8 分片缺陷仅通过 hermetic `cargo test` 锁定，不再用 GUI 复现。

---

## 1. 真实产品基线

| 产物 | 构建命令 | 真实产物路径 |
|---|---|---|
| TUI 主程序 | `cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp` | `target/debug/aster` |
| ACP worker | 同上 | `target/debug/aster-acp` |
| 成对 BUILD_ID | 构建后执行 `--build-id` 并 `diff` | `build-id-aster.txt` vs `build-id-acp.txt` |
| GUI harness | 参考 `apps/aster/tests/visual_tui_harness` | `open -a Terminal` + 伴生 launch 脚本 |
| 私有伴生（可复用，不提交） | `.runtime/tui-full-e2e/agent-connection-recovery-agent-desktop-$(date +%Y%m%d)/` | `drive_connection_recovery.py`、`bins/`、`evidence/`、`logs/` |

---

## 2. 执行顺序

```
R0 基线与构建卫生
R1 代码审查（书面结论落盘）
R2 agent-desktop GUI 用例
  ├── V1 欢迎屏断连再确认（冒烟）
  ├── V3 正常 /quit 对照
  ├── V2 有 session 的断连 + resume 提示
  ├── V5 bridge / 日志可定位性（只读，依赖 V2）
  └── V4 显式 resume，0 次自动模型请求（依赖 V2）
R3 证据整理与交付短报
```

---

## 3. R0：基线、构建与 hermetic 快检

| 步骤 | 命令 / 动作 | 真实输出文件 |
|---|---|---|
| 记录代码基线 | `git rev-parse HEAD`、`git status --short` | `evidence/r0-git.txt` |
| 记录平台与工具链 | `uname -sm`、`rustup show active-toolchain` | `evidence/r0-toolchain.txt` |
| 记录 agent-desktop 权限 | `agent-desktop status` | `evidence/r0-agent-desktop-status.txt` |
| 成对构建并暂存 | `cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp` | `bins/aster`、`bins/aster-acp` |
| 核对 BUILD_ID | `aster --build-id`、`aster-acp --build-id` | `evidence/build-id-aster.txt`、`evidence/build-id-acp.txt` |
| 确认 BUILD_ID 一致 | `diff -u evidence/build-id-aster.txt evidence/build-id-acp.txt` | 输出写入 `r0-git.txt` 或单独记录 |
| hermetic UTF-8 快检 | `cargo test --locked -p aster-acp --test acp_conformance_stdio fragmented_utf8_session_new_survives_outbound_interleave -- --test-threads=1` | `evidence/r0-hermetic-utf8.log` |
| hermetic transport 快检 | `cargo test --locked -p aster-pager --lib acp::aster_spawn::transport_tests -- --test-threads=1` | `evidence/r0-hermetic-transport.log` |

> R0 任一 hermetic 测试失败：停止 GUI，先修产品，不进入 R1。

---

## 4. R1：审查

对以下真实路径做书面审查，结论写入 `evidence/r1-review.md`：

```
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

审查项：

1. **ACP stdin**：`LineBufferedRead::spawn_local` 是否在 `LocalSet` 内；EOF / `agent.close()` 顺序是否先记 tracing 再关闭。
2. **Bridge**：stderr 有界；`Failed` 路径是否在 cleanup kill 前保留 observed status / 摘要；`Cancelled` 是否仍清洁成功。
3. **TUI bail**：故障文案是否含日志位置；正常退出路径是否仍走 `connection_closed == false`。
4. **Cursor MCP**：catalog miss 绝不别名到合法工具名；`synthetic-secret` 类载荷不回显；`provider_mismatch` / `server_mismatch` / `approval_only` / 非法协议仍 NonRetryable。
5. **回归风险**：未引入会拖死 LocalSet 的同步锁跨 await；未把 cleanup kill 冒充原始退出原因。

可选再跑 Bugbot 类审查；若 finding 被校验器剔除，须在 `r1-review.md` 写明“无有效 finding”或逐条手工判定。

---

## 5. R2：agent-desktop 用例表

> 统一约束：mock ACL + 未使用 loopback；`ASTER_DISABLE_*_ACCOUNT=1`；不连接真实模型；应用名使用本地化名 `终端`；键入用 `pbcopy` + System Events paste/return。

| 用例 | 目标 | 关键步骤 | 通过标准 | 失败 / BLOCKED 处理 | 证据文件 |
|---|---|---|---|---|---|
| **V1** 欢迎屏断连再确认 | 当前暂存二进制仍具备 P2 用户可见断连文案 | 1. `open -a Terminal` 启动 staged `aster`（mock ACL）<br>2. `agent-desktop focus-window`；history 等到欢迎屏提示<br>3. `SIGTERM` 杀掉本轮新出现的 `aster-acp` PID | history 含 `Agent connection closed` 且含日志目录或 `session_end.worker_join` 提示；退出码非零可接受 | 若未出现故障文案则产品回归 | `v1-result.json`<br>`v1-hist.txt`<br>`v1-screenshot.png` |
| **V3** 正常 `/quit` 对照 | 主动退出不被标成连接崩溃 | 1. 新开 staged `aster`<br>2. 进入可交互状态<br>3. 提交 `/quit`（不杀 ACP） | history **没有** `Agent connection closed` 故障 bail；可出现普通 Saving session / 进程已完成 | 若出现崩溃文案则失败 | `v3-result.json`<br>`v3-hist.txt` |
| **V2** 有 session 的断连 + resume 提示 | 同一 session 的恢复命令出现在断连退出路径 | 1. 启动 staged `aster`，越过欢迎屏进入真实 session（不依赖模型完成对话，允许空 session）<br>2. 提取 `sessionId` 写入 `session-id.txt`<br>3. `SIGTERM` 杀掉该窗口对应 `aster-acp` | history 含故障断连文案 + 指向**同一** `sessionId` 的恢复命令（`aster --resume <id>` 或 `--minimal --resume <id>`）；退出码非零 | 若无法在不打模型前提下获得 `sessionId`：记 **BLOCKED**，引用已有 `shipped_tui_e2e` resume 用例作交叉证据，不得假装通过 | `v2-result.json`<br>`v2-session-id.txt`<br>`v2-hist.txt`<br>`v2-disconnect.png` |
| **V5** bridge / 日志可定位性 | 检查用户可见 bail 之外的定位字段 | 1. 读取 V2 产生的 `ASTER_LOG_DIR` 下 ACP 日志<br>2. 检索 exit / `acp_stderr=` / transport 关闭类字段 | 有则摘录脱敏短句；无则记缺口 | 不因此单方面否决 V2；但写入 `Explicitly not claimed` | `v5-bridge-fields.txt`<br>`v5-acp-log-excerpt.txt` |
| **V4** 显式 resume，0 次自动模型请求 | 断连后人工 resume 不自动烧模型 | 1. 使用 V2 记录的 `sessionId`（V2 BLOCKED 则本项 BLOCKED）<br>2. 新开 Terminal：`aster --resume <sessionId>`，仍指向 mock ACL 与同一 log/state 目录<br>3. 等待 pager 稳定；不提交新用户消息 | resume 成功恢复；mock 上游请求计数为 **0**（听端口未收到 chat completion 或 ACL/日志侧可观察信号） | 信号不足则 BLOCKED 并说明；不得用屏幕关键字单独判过 | `v4-result.json`<br>`v4-hist.txt`<br>`v4-resume.png`<br>`v4-mock-request-count.txt` |

> V1 记录：`has_resume_hint` 在无 session 时允许为 `false`，原因写入 `v1-result.json`。

---

## 6. 证据文件名约定

根目录变量：

```sh
EV=.runtime/tui-full-e2e/agent-connection-recovery-agent-desktop-$(date +%Y%m%d)
```

所有证据存于 `$EV/evidence/`：

| 类别 | 文件名 |
|---|---|
| R0 基线 | `r0-git.txt`、`r0-toolchain.txt`、`r0-agent-desktop-status.txt` |
| BUILD_ID | `build-id-aster.txt`、`build-id-acp.txt` |
| Hermetic 测试 | `r0-hermetic-utf8.log`、`r0-hermetic-transport.log` |
| R1 审查 | `r1-review.md` |
| V1 | `v1-result.json`、`v1-hist.txt`、`v1-screenshot.png` |
| V3 | `v3-result.json`、`v3-hist.txt` |
| V2 | `v2-result.json`、`v2-session-id.txt`、`v2-hist.txt`、`v2-disconnect.png` |
| V5 | `v5-bridge-fields.txt`、`v5-acp-log-excerpt.txt` |
| V4 | `v4-result.json`、`v4-hist.txt`、`v4-resume.png`、`v4-mock-request-count.txt` |
| 交付 OUTCOME | `docs/evidence/code/<实际日期>-agent-connection-recovery-agent-desktop/OUTCOME.md` |

---

## 7. Explicitly not claimed

以下事项**不在**本 E2E 用例规划范围内，不写入通过结论：

- Studio 桌面 GUI / `just build-studio`。
- Inkstone doctor / Vitest；替换用户已安装二进制；提交或推送。
- 用 GUI 复现 UTF-8 分片缺陷（由 hermetic `cargo test` 覆盖）。
- 修绿 `delayed_catalog_keeps_draft_and_explicit_effort` flake（基线失败，除非本轮 diff 新引入）。
- 使用真实模型流量、账号登录或云端状态同步来验证 resume。
- 将 AX textfield、`agent-desktop screenshot`、`press --headed`、`clipboard-set` 视为必过断言门。
- 在无法观测 `sessionId` 或 mock 请求计数的情况下宣称 V2 / V4 通过。
- 任何基于旧版 `mock-aster/go build` 二进制产出的结果。

---

## 8. 相对旧版用例规划的增删改

| 变更 | 说明 |
|---|---|
| **删** | 移除虚构的 `mock-aster/go build` 二进制及其全部依赖用例。 |
| **改** | 构建来源改为 `cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp`，产物为真实的 `aster` 与 `aster-acp`，并强制成对 `BUILD_ID` 一致。 |
| **改** | GUI 断言源统一为 Terminal.app 的 **history of selected tab**，不再依赖不存在 / 不稳定的外部 mock UI 信号。 |
| **增** | 正式加入 **R0 基线卫生**、**R1 代码审查**、**R3 证据交付**三个阶段。 |
| **增** | **V3 正常 `/quit` 对照**：区分主动退出与崩溃 bail。 |
| **增** | **V4 显式 resume，0 次自动模型请求**：验证断连恢复不自动发起模型调用。 |
| **增** | **V5 bridge / 日志可定位性**：只读检查 `exit` / `acp_stderr` / transport 关闭字段。 |
| **改** | **V2** 明确要求同一 `sessionId` 的恢复命令出现在 history；允许在不打模型无法取到 `sessionId` 时诚实 **BLOCKED** 并引用交叉证据，禁止假装通过。 |
| **改** | 证据目录统一落到 `docs/evidence/code/<实际日期>-agent-connection-recovery-agent-desktop/OUTCOME.md`，并交叉引用既有 `2026-11-15-agent-connection-recovery/OUTCOME.md`。 |
| **改** | UTF-8 分片缺陷仅由 `cargo test` 覆盖，不再设计 GUI 复现步骤。 |

---

## 9. R3：交付 checklist

- [ ] `r1-review.md` 已落盘并给出“高危 / 非阻塞 / Bugbot”结论。
- [ ] V1 通过。
- [ ] V3 通过。
- [ ] V2 通过，或已诚实 BLOCKED 并附交叉证据说明。
- [ ] V4 随 V2 状态；V2 BLOCKED 则 V4 BLOCKED。
- [ ] V5 已执行，无论是否有 bridge 字段都写入 OUTCOME。
- [ ] OUTCOME.md 包含：HEAD、BUILD_ID、agent-desktop 版本/权限、每条用例命令与结果、证据路径、`Explicitly not claimed`。
- [ ] 未提交、未推送、未 `git reset --hard`。
- [ ] 未引入与连接恢复无关的新高危变更。
