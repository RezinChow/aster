# Aster 提前终止与 ACP 断连：诊断及修复提示词

状态：诊断完成，产品修复尚未实施。日期：2026-11-15。

工作目录：Aster 仓库根。目标会话：`fadaf458-1cfe-4c2b-9132-80efaa12ff85`。

直接把本文交给修复智能体。依次执行 P0→P5，保留实际结果。
修复 Aster 本身；Inkstone 的 P5/P6 是故障现场，不是本任务的开发范围。

## 1. 已查明的事实与边界

### 1.1 原会话发生了两种中断

现场日志来自 `~/.aster/logs/aster-acp.20772.log`、`unified.jsonl`
和该会话的权威 session-store。以下时间为北京时间。

| 时间 | 证据 | 判断 |
| --- | --- | --- |
| 11:09:57.353 | `Cursor tool request rejected reason=tool_unavailable` | 首轮并未完成，而是失败 |
| 11:09:57.361 | Run `run-7f450b86-dd7e-4d24-8021-9b0feea42802`：`failed`，错误为 `Cursor tool request rejected: tool_unavailable` | 已确认首轮提前终止的直接原因 |
| 11:10:06.807 | 收到“继续”，进入新一轮 | 首轮错误没有当场关闭整个连接 |
| 11:10:24.798 | 启动 Vitest，工具超时参数 `600000` ms | 后续取消不是这个期限正常到期 |
| 11:10:25.934 | Bash 持续约 `1135` ms，`exit_code=137`、`command_cancelled=true`、`timed_out=false`、输出为 0 字节 | 137 是工具取消结果，不能据此认定 OOM |
| 11:10:26.139 | Run `run-42e8a320-817b-4bdc-8992-3b7f44d70707`：`cancelled` | 任务未完成 |
| 11:10:28.974 | `AgentSession closed` | 会话进入关闭流程 |
| 11:10:29.082 | `session_end.worker_join`：`failed`，`Aster Code ACP transport closed` | TUI 的直接退出条件已满足 |

历史消息中的 `(Response interrupted by the user.)` 是通用取消文案。
现场没有取消来源记录，不能反推用户按了 Stop。
Vitest 没有完成；doctor 没有在这轮得到执行结果。

### 1.2 已复现的 ACP 退出根因：输入端缺失取消安全的行缓冲

[ACP 入口](../crates/code/acp/src/bin/aster-acp.rs) 第 396–410 行，
直接把 `tokio::io::stdin().compat()` 交给 `AgentSideConnection`。
锁定的 `agent-client-protocol 0.10.4` 仍在 `rpc.rs::handle_io`
用 `select_biased!` 竞争出站消息和 `BufReader::read_line`。

读取半条输入时，如果出站消息先就绪，`read_line` future 被丢弃。
已消费的部分字节可能丢失。若切点落在 UTF-8 字符中间，后续读取
就会报 `stream did not contain valid UTF-8`，导致 `io_task` 结束。
随后入口调用 `agent.close()`，取消尚未完成的工具并关闭会话。

仓库已有公开的
[LineBufferedRead](../crates/terminal/crates/codegen/aster-acp-lib/src/line_reader.rs)。
它把完整行交给 ACP，并在分配过程中检查 64 MiB 行上限。
[TUI 桥接层](../crates/terminal/crates/codegen/aster-pager/src/acp/aster_spawn.rs)
第 135 行已经用它保护子进程 stdout；子进程 stdin 漏接了同一保护。

隔离复现直接启动已安装的 `aster-acp 9.2.4`，不调用模型：

1. 发送并完成 `initialize`。
2. 发送完整的 `session/new` 请求 A。
3. 紧接着发送请求 B 的前半段，切在路径中的“你”字第一个字节后。
4. 保持 stdin 打开，等待请求 A 的响应。
5. 发送请求 B 的剩余字节与换行。

| 对照 | 请求 A | 请求 B | 进程状态 |
| --- | --- | --- | --- |
| 两条完整帧 | 成功 | 成功 | 保持运行，主动关闭 stdin 后退出 0 |
| 仅改变 B 的写入分片 | 成功 | 无响应 | stdin 仍打开时退出 1，stderr 含 UTF-8 错误 |

两轮实验得到相同结果，每轮各启动一个对照进程和一个分片进程。
这是已证实的产品缺陷。**它是否就是原会话第二次断连的触发因素，
仍然未知**：原现场缺少最终 I/O 错误和输入分片记录。
不要把同类复现写成原会话逐帧还原。

### 1.3 首轮提前结束的原因：工具目录拒绝被升级为终止性模型错误

[Cursor MCP 适配层](../crates/code/core/src/llm/cursor_account/mcp.rs)
第 112–113 行检查精确工具名。
不存在于当轮 `tools` 的请求进入 `ToolUnavailable`。
第 25–29 行把拒绝封成 `NonRetryableLlmError`。
[响应读取器](../crates/code/core/src/llm/cursor_account.rs) 第 601 行通过 `?`
结束本次模型调用，最终使原 Run 失败。

拒绝未授权工具本身正确。缺口在于普通目录不匹配与终止性拒绝的处理
没有分开。现场没有记录请求工具名的安全摘要，无法确认具体未知工具，
也无法确认是目录漂移还是模型生成了未提供的名称。不要猜别名。

### 1.4 诊断缺陷：真正的退出错误被隐藏

桥接层第 129–130 行把 ACP stderr 复制到 `tokio::io::sink()`。
ACP 入口在 `agent.close()` 后才用 `?` 返回 I/O 错误。
Rust `main -> Result` 的最终错误写到 stderr，不经过日常 tracing 日志。
上述复现的关键错误因此会被正常 TUI 启动路径丢弃。

桥接层 `select!` 的 I/O 分支还可能先于 `child.wait()` 命中。
现有路径随后中止任务并 kill/reap，未把原始退出状态交给 TUI。
[事件循环](../crates/terminal/crates/codegen/aster-pager/src/app/event_loop.rs)
第 2230–2233 行只看到通道关闭。
[应用退出路径](../crates/terminal/crates/codegen/aster-pager/src/app/mod.rs)
第 1252–1253 行再返回 `Agent connection closed`。
这解释了为何用户只能看到通用错误和恢复命令。

CLI 与 ACP 的已安装 BUILD_ID 相同，身份是：

```text
aster 0.3.6 (e74ecd8d951a)
aster-acp 9.2.4
aster-cli-pair-v1:8b86e5216923a7c6c2be82701f0caf1914dae2e9:aarch64-apple-darwin
```

配对检查没有发现二进制错配。索引预算和 skill 加载错误在首轮运行期间
持续出现，但没有证据证明它们触发本次连接结束。记录这些旁支，保持范围。
完整诊断记录见 [OUTCOME](evidence/code/2026-11-15-agent-connection-diagnosis/OUTCOME.md)。

## 2. 实施约束与修改范围

先读根 `AGENTS.md`、`.specify/memory/constitution.md` 和修改路径的局部指令。
本任务属于 product regime。`docs/development-standards.md` 在诊断时缺失，
记录此基线；不要假装读过，也不要顺带重建这份文档。

- 保留当前工作区的其他改动。不开新 worktree，不提交、不推送、不安装替换用户二进制。
- 不修改 Inkstone 源码、真实会话历史、用户 ACL、账号、模型或权限配置。
- 不关闭权限检查，不猜工具名，不把所有协议错误改成可重试。
- 不增加无限重试、自动重启、自动重放工具或吞掉连接错误的全局捕获。
- 保留主动取消、EOF 清理、草稿和队列恢复，以及非零失败退出码。
- 保留 Rust 公共 API、根 workspace、锁文件和跨平台基线。
- 不手改生成文件或 Cargo registry。测试位于 sibling 文件或现有 `tests/`。

| 关注点 | 必须检查的位置 |
| --- | --- |
| ACP stdin 与 I/O 结束 | `crates/code/acp/src/bin/aster-acp.rs`、`src/bin/aster-acp/tests.rs` |
| 共享行缓冲及依赖 | `crates/terminal/crates/codegen/aster-acp-lib/src/line_reader.rs`、`crates/code/acp/Cargo.toml`、必要时由 Cargo 更新的 `Cargo.lock` |
| Cursor 工具拒绝与纠正 | `crates/code/core/src/llm/cursor_account/{mcp.rs,mcp/tests.rs,stream_tests.rs,tool_protocol.rs}`、`cursor_account.rs`，以及实际受影响的调用方 |
| 子进程诊断和退出 | `crates/terminal/crates/codegen/aster-pager/src/acp/{aster_spawn.rs,spawn.rs}` |
| TUI 错误和输入保存 | `crates/terminal/crates/codegen/aster-pager/src/app/{event_loop.rs,mod.rs}`、现有 `input_recovery` 测试 |
| 真实协议与 CLI 验收 | `crates/code/acp/tests/{acp_conformance_stdio.rs,shipped_tui_e2e.rs}` 及已有 support |

以上是影响面，不是要求改遍所有文件。先搜索每个待改函数的调用方。
共享 helper 已经公开，不增加无用导出。无需修改 Studio 子模块源码。

## 3. P0：先把失败变成回归测试

1. 记录 HEAD、工作区状态、系统、工具链和配对 BUILD_ID。
2. 在现有真实 stdio 测试中加入分片复现。
3. 在旧实现上确认请求 B 失败。
4. 保留正常完整帧对照。

用“收到 A 响应后才发送 B 后半段”建立同步点，不用固定 sleep 碰运气。
覆盖带空格及中文的路径。测试必须调用真实 ACP 入口，不复制解析逻辑。
测试不能提前关闭 stdin，更不能把子进程存活当成请求成功。

本机诊断脚本及结果保留在忽略的私有目录：

```text
.runtime/tui-full-e2e/agent-connection-diagnosis-20261115/fragmented_stdin_probe.py
.runtime/tui-full-e2e/agent-connection-diagnosis-20261115/fragmented-stdin-result.json
```

脚本用于证明旧缺陷，当前断言预期旧 ACP 退出 1。
正式回归测试应断言修复后的两条响应成功，不直接照搬旧缺陷断言。
若私有脚本不可用，按 §1.2 重建同一输入即可。

## 4. P1：修复 ACP 输入端

优先复用 `aster_acp_lib::LineBufferedRead::spawn_local` 包住 ACP stdin。
`aster-acp` 当前未直接依赖 `aster-acp-lib`，按现有风格加入本地 path 依赖：

```toml
aster-acp-lib = {path = "../../terminal/crates/codegen/aster-acp-lib"}
```

该共享 crate 不依赖 `aster-core` 或 shell，当前依赖图没有反向环。
执行时复查实际图。依赖只进入 ACP；不要让 Core 依赖终端宿主。
不新写第二套行缓冲，不升级 ACP 协议依赖，不用跨 crate `#[path]` 偷引源码。

修复后的目标入口形状：

```rust
let stdin = aster_acp_lib::LineBufferedRead::spawn_local(tokio::io::stdin().compat());
```

确认 ASCII 分片、UTF-8 分片和超过内部读缓冲区的完整合法行均不丢字节。
复用现有行上限测试，保留真正非法 UTF-8 和超限输入的显式失败。
确认 EOF 仍清理正在运行的工具，主动 `session/cancel` 仍只取消当前轮。

## 5. P2：让连接结束保留真实原因

先在 ACP 中记录 `io_task` 的结束结果，再调用 `agent.close()`。
使用结构化 tracing，至少保留错误类别和可关联的进程身份。
最终错误必须进入现有持久日志。stdout 继续只承载协议。

检查桥接层的 stderr 丢弃和 I/O/child.wait 竞争。
用最小现有通道传递已知错误或诊断日志位置。
如果保留 stderr，只保留有界并符合现有敏感信息规则的摘要。
不要把任意 stderr 原文直接加入公共日志或屏幕。
在 kill/reap 前保留已观察到的原始状态。
清理造成的 kill 信号不能冒充最初的退出原因。

TUI 保留断连退出和恢复提示，补充可定位的原因或日志位置。
不扩展为连接自动恢复框架。
加入正常 `/quit`、显式取消、意外 EOF 和子进程非零退出的对照测试。
正常退出不能被标为崩溃。故障退出仍保存尚未提交的输入。

## 6. P3：修复 Cursor 提前终止的处理范围

先用离线 Cursor 流夹具重现：当轮目录只有 `read`，provider 为 `aster`，
模型返回目录外工具。确认没有工具执行，也没有隐式别名映射。
区分目录生成不一致与模型自行返回未知名称。
诊断只写稳定 reason、请求工具名摘要和目录摘要，保持现有敏感值测试。

对身份合法、协议合法的 `ToolUnavailable`，提供一次明确的模型纠正机会。
复用已有结构化错误与纠正路径，保留同一个受控 Run 和原始工具目录。
纠正反馈是“该工具未执行，只能选择本轮目录中的精确名称”。
不得把未知调用交给可执行工具注册表，也不得伪造一个允许的工具名。
这一步是模型纠正，不是原样重试相同 HTTP 请求。

先核对本地协议和现有错误返回能力，再选最小实现位置。
若现有接缝无法表达未执行的纠正结果，记录具体所缺的类型和调用链，
继续独立完成 P1/P2/P4，但将 P3 保持未完成，不能把硬错误改成假成功。
不为一次拒绝搭建通用恢复框架。

验收：一次未知调用后，夹具改发合法工具时任务继续完成。
同一纠正再次失败时显式结束，报告稳定原因。
`provider_mismatch`、`server_mismatch`、审批绕过和非法协议仍 fail closed。
显式取消优先于纠正。纠正前已完成的 edit/write/bash 不得再次执行。
在真实 ACP 流测试中确认模型错误不会顺带关闭健康的 ACP 进程。

## 7. P4：验证行为与回归

Cargo 命令从根目录运行，使用仓库固定工具链。
先确认 `apps/studio` 已初始化；缺失时按仓库已有流程初始化，保留其改动。
诊断脚本使用已安装二进制；修复验收必须重新构建当前 checkout 的 CLI/ACP 对。

```sh
git submodule status apps/studio
rustup show active-toolchain
cargo fmt --all -- --check
cargo test --locked -p aster-acp --bin aster-acp
cargo test --locked -p aster-acp --test acp_conformance_stdio -- --test-threads=1
cargo test --locked -p aster-core --lib cursor_account -- --test-threads=1
cargo test --locked -p aster-pager --lib acp:: -- --test-threads=1
cargo test --locked -p aster-pager --lib input_recovery -- --test-threads=1
cargo test --locked -p aster-acp --lib -- --test-threads=1
cargo clippy --locked -p aster-core -p aster-acp -p aster-pager --all-targets --no-deps
cargo check --locked --workspace --all-targets
cargo check --locked -p aster-core --features advanced-harness,deep-live
cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp
```

若改了共享 helper，补跑 `aster-acp-lib` 对应测试和 Clippy。
按 owning package 支持的 features 检查，不把默认 feature 结果扩称全功能覆盖。
执行 `.github/workflows/ci.yml`、`qualify-code.yml`、`qualify-aster-cli.yml`
中受影响的现有检查，包括 workspace dependency 和 CLI pair 合约。
逐项记录命令、退出码、测试数及未运行原因。
以上是实施命令，不是本次诊断已通过的检查。

按 Cargo 的实际 target_directory 选定产物，核对两个 `--build-id` 一致。
默认 target 目录且当前 shell 为 POSIX 时，现有真实 CLI/ACP 验证命令为：

```sh
ASTER_TUI_BIN="$PWD/target/debug/aster" \
ASTER_ACP_BIN="$PWD/target/debug/aster-acp" \
  cargo test --locked -p aster-acp --test shipped_tui_e2e -- --test-threads=1
```

Windows 使用现有 PowerShell/进程适配约定和 CI 原生测试，不照搬 POSIX 赋值。
现有 `shipped_tui_e2e` 为 Unix PTY 套件，不能将跳过声称为 Windows 通过。
本任务无需桌面 GUI。若追加 GUI 验收，先满足根指令的当前源码构建和启动要求。

另用隔离 PTY 验证：

- 发送一轮包含工具调用的长任务，分片期间持续产生出站通知，最终完成。
- 注入真实 ACP 故障，显示原因与同一个 session 的恢复命令，退出码非零。
- 显式 resume 后恢复历史、草稿和 held queue，产生 0 次自动模型请求。
- 单独取消工具时清理其后代进程，CLI/ACP 继续接受下一轮。

已有测试成功后，只有新改动、失败或具体疑点才补跑。
记录原有失败；不得放宽断言、拉长冻结期限或改 grader 换取通过。
无需重跑 Inkstone 的整套 doctor/Vitest 来证明 Aster 传输修复。
若补做原任务验证，先检查其独立仓库指令并获得该任务的明确范围。

## 8. P5：证据与交付

在 `docs/evidence/code/<实际日期>-agent-connection-recovery/OUTCOME.md`
保留修复前失败、修复后结果、构建身份、命令、计数和 `Explicitly not claimed`。
本次诊断 OUTCOME 保留不改写成修复通过。

最终复查 diff、引用和 `git diff --check`。
不把用户 session-store、账号数据或原始 provider payload 加入仓库。
不提交代码。交付用以下短报：

```text
根因：ACP stdin 丢字节复现=…；Cursor 目录拒绝=…
历史现场：第二次断连的具体触发=已还原|仍未知（缺…）
修复：P1=… P2=… P3=…
验证：命令/计数/失败/未运行=…
恢复：历史/草稿/队列/自动请求数=…
证据：docs/evidence/code/…/OUTCOME.md
未做：…
提交：未提交
```

只有修复、所需关联改动、规定检查和 diff 复查都完成，才报告任务完成。
如果 P3 或其他必需项受阻，明确剩余项，不用“已修复全部崩溃”概括。

审查与 agent-desktop 带 session 的续验，见
[`implementation-prompt-aster-agent-connection-recovery-agent-desktop-e2e.md`](implementation-prompt-aster-agent-connection-recovery-agent-desktop-e2e.md)。
