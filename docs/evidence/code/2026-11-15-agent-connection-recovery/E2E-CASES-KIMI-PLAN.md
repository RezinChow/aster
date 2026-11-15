# 连接恢复 agent-desktop E2E 用例规划

- 原计划规划模型：本机 `kimi/k3.1-pro`（`~/.aster/config.acl` → `https://api.kimi.com/coding/v1`）
- **实际**：2026-11-15 调用时全部 Kimi coding 模型返回月额度耗尽
  （`You've reached your monthly usage limit for this billing cycle`）。
  下列用例由执行提示词
  `docs/implementation-prompt-aster-agent-connection-recovery-agent-desktop-e2e.md`
  与已有 recovery/agent-desktop 证据整理而成，**不是** Kimi 生成稿。
- 密钥未写入本文。额度恢复后可用同一 prompt 让 `kimi/k3.1-pro` 复核并覆盖本节。

## 1. 用例表

| ID | 优先级 | 前置 | 步骤（摘要） | Oracle | 通过 | 失败 / BLOCKED |
| --- | --- | --- | --- | --- | --- | --- |
| V1 | P0 | 本 checkout 暂存 `aster`+`aster-acp`，BUILD_ID 一致；mock ACL；agent-desktop 权限 OK | `open -a Terminal` 启动 staged aster → focus「终端」→ history 等到 ready → `SIGTERM` 本轮 `aster-acp` | Terminal history；`list-windows`/`focus-window`；可选 PNG；`result.json` | 含 `Agent connection closed` **且**含日志目录或 `session_end.worker_join` | 无断连文案；或用旧安装二进制 |
| V2 | P0 | V1 环境；须进入**已有 sessionId** 的会话（mock，尽量不烧模型） | 打开/新建 session → 记下 `sessionId` → 杀对应 `aster-acp` | history；`session-id.txt`；PNG | 故障 bail + **同一** `sessionId` 的 `--resume` 命令；非零/错误退出 | 无 resume 行；sessionId 对不上。无法无模型取得 sessionId → **BLOCKED**（须写卡点，可用 `shipped_tui_e2e` resume 交叉，不得假绿） |
| V3 | P0 | 同暂存二进制 | 可交互后 `/quit`（或 Quit），**不**杀 ACP | history | **没有** `Agent connection closed`；允许 Saving session / 进程已完成 | 把正常退出写成崩溃 |
| V4 | P1 | V2 的 `sessionId`（V2 BLOCKED 则本项 BLOCKED） | `aster --resume <id>`（与 UI 提示一致）+ 同 mock/state；等待稳定；**不**提交新用户消息 | history；mock 上游请求计数=0（监听/连接计数）；可选草稿 | 恢复语义成立且自动模型请求 **0** | 自动开跑；或无独立请求计数 oracle → BLOCKED |
| V5 | P1 | V2 之后 | 只读 `ASTER_LOG_DIR`、统一日志/`worker_join` | 日志文件存在；exit / `acp_stderr=` / transport 字段之一（脱敏摘录） | 有可定位字段则 PASS；仅缺字段不否决 V2，但须写入 not claimed | 日志目录空且 V2 也无用户可见提示 → 记缺口 |
| R1 | P0 | recovery diff 仍在工作区 | 书面审查 ACP stdin / bridge / TUI bail / Cursor mcp；可选 Bugbot | `REVIEW.md` 或 OUTCOME Review 小节 | 高危已修或标明无；无有效 Bugbot finding 须写明 | 空过审查 |
| H1 | P0 | 同 R0 构建 | `fragmented_utf8…` + `acp::aster_spawn::transport_tests` | cargo 计数 | 均绿 | 红则停 GUI，先修产品 |

## 2. 执行顺序与依赖

```text
R0 构建/BUILD_ID → H1 hermetic
                 → R1 审查（可与 H1 并行）
                 → V1 冒烟
                 → V3 对照（可不依赖 V2）
                 → V2（依赖能拿到 sessionId）
                 → V5（读 V2 后日志）
                 → V4（依赖 V2 sessionId）
                 → 追加 OUTCOME + 短报
```

## 3. 证据文件名（建议）

相对私有伴生目录（例
`.runtime/tui-full-e2e/agent-connection-recovery-agent-desktop-<date>/evidence/`）：

| 用例 | 产物 |
| --- | --- |
| R0 | `build-id-aster.txt`, `build-id-acp.txt` |
| H1 | `fragmented-hermetic.log`, `transport-tests.log` |
| R1 | `REVIEW.md` |
| V1 | `result-v1.json`, `ready-hist-v1.txt`, `closed-hist-v1.txt`, `after-kill-v1.png` |
| V2 | `session-id.txt`, `result-v2.json`, `closed-hist-v2.txt`, `after-kill-v2.png` |
| V3 | `result-v3.json`, `quit-hist-v3.txt` |
| V4 | `result-v4.json`, `resume-hist-v4.txt`, `mock-request-count.json` |
| V5 | `log-excerpt-v5.txt`（脱敏） |

仓库侧 OUTCOME：
`docs/evidence/code/<date>-agent-connection-recovery-agent-desktop/OUTCOME.md`
（或追加既有 recovery OUTCOME，交叉引用诊断 OUTCOME，勿覆盖）。

## 4. Explicitly not claimed

- 历史现场第二次断连 = UTF-8 分片（诊断仍未知）。
- Studio GUI / Inkstone / 替换用户已安装二进制 / 提交推送。
- GUI 复现 UTF-8 stdin 分片。
- `delayed_catalog_keeps_draft_and_explicit_effort` flake 已修。
- 本文曾由本机 Kimi 生成（额度耗尽，未调用成功）。
- V2/V4 在 BLOCKED 时不得写成 GUI 通过。

## 5. 对提示词 V1–V5 的增删改

| 原 ID | 建议 |
| --- | --- |
| V1 | **保留**；作每次 GUI 批次冒烟。已有一次 PASS 可复跑确认暂存二进制。 |
| V2 | **保留为 P0 核心**；补充「无模型取得 sessionId → BLOCKED + shipped 交叉」规则（提示词已有，规划强调不可假绿）。 |
| V3 | **保留**；与 V2 解耦，可先跑。 |
| V4 | **保留为 P1**；强制独立请求计数 oracle，禁止只靠屏幕。 |
| V5 | **保留**；降级为「加强定位证据」，不单票否决 V2。 |
| 新增 H1 / R1 | 纳入同批次门禁，避免 GUI 掩盖 hermetic/审查缺口。 |
| 不新增 | Studio 窗、真 Cursor 流、分片 stdin GUI。 |

## 6. Kimi 额度恢复后的复核命令（勿把密钥写入命令历史文件）

```sh
# 从 ~/.aster/config.acl 读取 kimi 凭证后调用 k3.1-pro，
# 将本文件与 implementation-prompt-…-agent-desktop-e2e.md 作为上下文，
# 请模型「复核并指出遗漏」；输出覆盖或附加 E2E-CASES-KIMI-PLAN.kimi.md
```

若需改用本机 ACL 中其他仍有额度的 provider（如 deepseek/glm）做规划复核，须另行授权。
