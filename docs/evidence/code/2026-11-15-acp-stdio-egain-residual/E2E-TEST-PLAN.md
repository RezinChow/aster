# ACP stdio EAGAIN 残留面端到端用例规划

状态：**规划稿**（非执行通过证据）。日期基线：2026-11-15。  
前置：主战役 [`../2026-11-15-acp-stdio-egain/E2E-OUTCOME.md`](../2026-11-15-acp-stdio-egain/E2E-OUTCOME.md) 已 **PASS**（产品 agent/pager/shell 接线 + P2/P3）。  
本轮只钉**同类问题审计残留面**，不重开整场主战役。

范围：**CLI + ACP 客户端真管道 / 共享测试客户端 / 示例**；薄回归主核。  
不含 Studio（自管 NDJSON，非 `into_internal_error` 同类）。  
权威执行合同：[`docs/implementation-prompt-aster-acp-stdio-egain-residual-e2e.md`](../../../implementation-prompt-aster-acp-stdio-egain-residual-e2e.md)。

| 参考 | 角色 |
| --- | --- |
| `docs/evidence/code/2026-11-15-acp-stdio-egain/OUTCOME.md` | 产品修复与第一轮路径审计 |
| `docs/evidence/code/2026-11-15-acp-stdio-egain/E2E-OUTCOME.md` | 主战役已 PASS |
| 会话内二次审计 | 产品 `RetryTransient*` 全绿；残留在 tests/examples |

默认执行核：**R0 + R1 + R2 + R3 + R5**。  
R4（全量 live_* / 安装通道）点名再跑。

---

## 1. 为何再开一轮

主战役已证明 **agent stdout / pager bridge** 背压不断连。二次审计仍见：

1. 大量 **ClientSideConnection + child `compat_write`**（集成测 / live_*）未包 `RetryTransient*`；
2. 示例 [`crates/code/acp/examples/interactive_client.rs`](../../../crates/code/acp/examples/interactive_client.rs) 真管道裸写；
3. shell `tests/acp_harness` / `perf_harness` 等 duplex 测试未包（风险低，但共享 harness 值得统一）。

本轮目标：

1. **静态不变量**：产品路径持续全绿（防回退）。
2. **客户端真管道**：共享客户端写 agent stdin 时，瞬时 WouldBlock 不得拆掉客户端 ACP I/O。
3. **薄回归**：主核 P2-A / E3 仍绿（防修残留时回归）。

```text
Client ──write──► aster-acp stdin (OS pipe)
   │
   ├─ RetryTransientWrite ──Pending──► session / test alive
   └─ bare compat_write ──Err(WouldBlock)──► client handle_io -32603
```

---

## 2. 可信 oracle

1. 静态：`rg` / 脚本对产品 `*SideConnection::new` 文件含 `RetryTransient`
2. Hermetic：`transient_io`；对共享客户端的 WouldBlock 注入测（若本轮接线）
3. 进程：客户端/agent 在背压窗口未因 `-32603` + `os error 35` 退出
4. GUI 薄回归：Terminal history（仅 R3-E3）
5. PNG 非唯一门

禁止：用主战役 PASS 顶替本轮 R2；用 duplex 单测顶替真管道客户端。

---

## 3. 分层总览

```text
R0  静态审计：产品 Connection 站点全部带 RetryTransient
R1  Hermetic：transient_io +（若接线）共享客户端 WouldBlock
R2  进程：ClientSideConnection 慢读/背压写 stdin（真 aster-acp）
R3  薄回归：P2-A 复跑 + agent-desktop E3 断连对照
R4  加深：interactive_client 示例烟测；可选 1 条 live_*（点名）
R5  OUTCOME + 短报
```

---

## 4. 用例表

### R0 — 静态产品不变量（必过）

| ID | 用例 | 动作 | 通过 | 证据 |
| --- | --- | --- | --- | --- |
| **R0-A** | 产品站点清单 | 扫 `aster-acp` bin、pager `acp/`、shell `src/`（排除 `*_tests` / `testkit`）、`aster-test-support` | 凡含 `*SideConnection::new` 的文件均含 `RetryTransient` | `r0-product-sites.txt` |
| **R0-B** | 残留清单 | 列出 tests/examples 未包站点 | 清单落盘；不要求本轮全改完 | `r0-residual-sites.txt` |

任一条产品站点 MISS → **FAIL**；先接线再测。

### R1 — Hermetic（必过）

| ID | 用例 | 命令要点 | 通过 |
| --- | --- | --- | --- |
| **R1-W** | WouldBlock 不致命 | `cargo test -p aster-acp-lib --lib transient_io` | 5 PASS |
| **R1-C** | 共享客户端（若本轮改 `aster-test-support` / 公共 helper） | 对应 crate 聚焦 test + clippy | PASS / SKIP（未改则 SKIP） |

### R2 — 客户端真管道背压（必过核）

优先改并复用 [`aster-test-support/src/acp_agent_connection.rs`](../../../crates/terminal/crates/codegen/aster-test-support/src/acp_agent_connection.rs)（已包则直接测；未覆盖的 helper 先包再测）。

| ID | 用例 | 动作 | 通过 | 失败 |
| --- | --- | --- | --- | --- |
| **R2-A** | 客户端写 stdin 背压 | ClientSideConnection 连真实 `aster-acp`；对 agent **慢读 stdout** 或节流，同时客户端持续发 NDJSON | 客户端 I/O 任务未因 `os error 35`/`WouldBlock`→`-32603` 退出；恢复后仍能完成一轮 RPC | 客户端或 agent 日志出现致命 EAGAIN stdio → **产品/客户端 FAIL** |
| **R2-B** | BrokenPipe 对照 | 关掉 agent 后继续写 | 允许失败/退出；须见 Broken pipe 类错误，不得变成「静默当成功」 | 无错误却称存活 → FAIL |

### R3 — 主核薄回归（必过）

复用伴生 `.runtime/tui-full-e2e/acp-stdio-egain-agent-desktop-YYYYMMDD/`（或新建 residual 目录拷贝驱动）。

| ID | 用例 | 通过 |
| --- | --- | --- |
| **R3-P2A** | 复跑主战役 P2-A | PASS（同主战役口径） |
| **R3-E3** | agent-desktop SIGTERM ACP | history 有 `Agent connection closed` + 日志提示 |

不默认重跑 E1/E2/P2-B（已在主战役 PASS）；点名可加。

### R4 — 加深（默认 SKIP）

| ID | 用例 | 条件 | 通过 |
| --- | --- | --- | --- |
| **R4-X** | `interactive_client` 示例烟测 | 本轮已给示例包 `RetryTransient*` 或接受 BLOCKED | initialize + 一轮交互不因 EAGAIN 死 |
| **R4-L** | 单条 `live_*` / `shipped_tui_e2e` 抽检 | 用户点名 + 额度 | 不过度解读；EAGAIN 致命才 FAIL |
| **R4-I** | 安装通道 pair | 用户点名 post-release | 同主战役 P0 安装口径 |

### R5 — 证据

```text
docs/evidence/code/2026-11-15-acp-stdio-egain-residual/
  E2E-TEST-PLAN.md      # 本规划
  E2E-OUTCOME.md        # 执行后填写
```

---

## 5. 通过定义

**PASS** 当且仅当：R0-A 绿；R1-W 绿；R2-A/B 绿；R3-P2A + R3-E3 绿；R4 默认 SKIP 已披露。

**PARTIAL**：R0+R1+R2 绿 + R3 子集 BLOCKED（非产品）。  
**FAIL**：产品站点回退，或 R2/R3 产品性失败。

---

## 6. Explicitly not claimed（规划层）

- 重开主战役全套 E1/E2/P2-B/P4 inkstone。
- 改完仓库内每一个 duplex 单测接线。
- Studio GUI。
- 提交/推送（除非另令）。

---

## 7. 短报模板

```text
战役：acp-stdio-egain-residual-e2e
R0：product=… residual_listed=…
R1：transient_io=… client_helper=SKIP|PASS
R2：A=… B=…
R3：P2A=… E3=…
R4：SKIP|…
判定：PASS|PARTIAL|FAIL
证据：docs/evidence/code/2026-11-15-acp-stdio-egain-residual/E2E-OUTCOME.md
```

---

## 8. 与主战役关系

| 主战役 | 本轮 |
| --- | --- |
| Agent/pager/shell 产品接线 + E1 背压 | 假定仍成立；R0/R3 防回退 |
| 未覆盖 ClientSide 集成测 / 示例 | **本轮主攻** |
| P4 inkstone live | 仍 SKIP，除非点名 |
