# ACP stdio EAGAIN 端到端用例规划

状态：**规划稿**（非执行通过证据）。日期基线：2026-11-15。  
目标：验证「管道瞬时 `WouldBlock` / `EAGAIN`（macOS os error 35）不得把 ACP
会话升成 `-32603` 拆掉」；同时确认故意杀死 ACP 时断连 UX 不回归。

范围：**CLI + ACP + TUI（Terminal「终端」+ agent-desktop）**。不含 Studio
（Studio 自管 NDJSON，非 `agent-client-protocol` 的 `into_internal_error` 同类）。  
权威执行合同：[`docs/implementation-prompt-aster-acp-stdio-egain-e2e.md`](../../../implementation-prompt-aster-acp-stdio-egain-e2e.md)。

| 参考 | 角色 |
| --- | --- |
| `docs/evidence/code/2026-11-15-acp-stdio-egain/OUTCOME.md` | 产品修复与路径审计 |
| `crates/terminal/crates/codegen/aster-acp-lib/src/transient_io.rs` | `RetryTransient*` + hermetic WouldBlock |
| `docs/evidence/code/2026-11-15-agent-connection-recovery/E2E-CASES-KIMI01-PLAN.md` | GUI oracle / V1–V5 先例 |
| `.runtime/tui-full-e2e/agent-connection-recovery-agent-desktop-20261115/drive_connection_recovery.py` | 伴生驱动模式（私有，不提交） |

默认执行核：**P0 + P1 + P2 + P3 + P5**。  
P4（超大仓 live）仅在有授权工作区与模型额度时加深，否则诚实 BLOCKED。

---

## 1. 为何单独一轮

Inkstone 事故（会话 `75ff3e99-…`）是「管道瞬时 `EAGAIN` → ACP `-32603` →
会话死」。现有连接恢复 V1–V5 验证的是**故意 SIGTERM ACP** 后的用户可见
bail/resume，**不**证明背压下会话仍活。本计划钉两条不变量：

1. **背压不断连**：注入/诱发 WouldBlock 或慢读时，不得出现
   `Resource temporarily unavailable (os error 35)` 致命 stdio 退出。
2. **真死仍可诊断**：SIGTERM ACP 仍出现 `Agent connection closed` + 日志定位
   （防修背压时回归断连 UX）。

```text
Pipe pressure / injected WouldBlock
        │
        ├─► RetryTransient* ──Pending/retry──► handle_io ──► session alive
        │
        └─► bare compat_write ──Ready(Err(WouldBlock))──► -32603 / os error 35
```

---

## 2. 可信 oracle（优先级）

1. 成对 `--build-id`（本 checkout staged bins）
2. Hermetic：`aster-acp-lib` `transient_io`；`acp_conformance_stdio` UTF-8；
   pager `transport_tests`
3. 进程级：ACP 子进程仍存活；日志**无** `aster_acp::stdio` + `-32603` +
   `os error 35`；后续仍能完成一轮 NDJSON 往返
4. GUI：Terminal `history of selected tab`（断连对照）；`ASTER_LOG_DIR` 摘录
5. PNG 仅证据，非唯一门

禁止：整屏「看起来好了」、AX 关键字单独过门、用旧安装 bin 冒充本 checkout、
把 `BudgetExceeded` 索引日志单独当 FAIL。

---

## 3. 分层总览

```text
P0  基线：checkout 构建 / BUILD_ID / agent-desktop 权限
P1  Hermetic：WouldBlock 重试 + UTF-8 + transport（必过）
P2  进程级背压：慢读管道 / 注入 WouldBlock 包装路径（必过核）
P3  agent-desktop：背压存活 + SIGTERM 断连对照（必过核）
P4  超大仓 live（inkstone 类）—— 有授权再跑，否则 BLOCKED
P5  OUTCOME + 短报
```

---

## 4. 用例表

### P0 — 基线（必过）

| ID | 用例 | 动作 | 通过 | 证据 |
| --- | --- | --- | --- | --- |
| **P0-A** | git / toolchain | `rev-parse HEAD`；`rustc --version`；短 status | 记录含 EAGAIN 修复 diff（`transient_io` / stdio wrap） | `p0-git.txt` |
| **P0-B** | 成对构建 | `cargo build --locked -p aster -p aster-acp`；拷入伴生 `bins/` | 退出 0 | `p0-build.log` |
| **P0-C** | BUILD_ID | 两 `--build-id` | 字符串一致 | `p0-build-id-*.txt` |
| **P0-D** | agent-desktop | `agent-desktop status` | accessibility + screen_recording granted | `p0-agent-desktop-status.txt` |

失败：停；不进 P2/P3。

### P1 — Hermetic（必过）

| ID | 用例 | 命令要点 | 通过 |
| --- | --- | --- | --- |
| **P1-W** | WouldBlock 不致命 | `cargo test --locked -p aster-acp-lib --lib transient_io -- --test-threads=1` | 5 PASS（含 macOS os error 35 Display） |
| **P1-U** | UTF-8 分片不回归 | `cargo test --locked -p aster-acp --test acp_conformance_stdio fragmented_utf8_session_new_survives_outbound_interleave -- --test-threads=1` | PASS |
| **P1-T** | bridge transport | `cargo test --locked -p aster-pager --lib acp::aster_spawn::transport_tests -- --test-threads=1` | 5 PASS |
| **P1-C** | clippy 聚焦 | `cargo clippy --locked -p aster-acp-lib -p aster-acp --bin aster-acp --all-targets --no-deps` | exit 0 |

### P2 — 进程级背压核（必过；新增）

在伴生或 `crates/code/acp/tests` 增加**一条**可重复探测（优先 hermetic
integration，不依赖 GUI）：

| ID | 用例 | 动作 | 通过 | 失败形态 |
| --- | --- | --- | --- | --- |
| **P2-A** | 慢读 stdout | 起真实 `aster-acp`（或最小 ACP agent fixture）；客户端故意慢读/短时不读 stdout；同时促使 agent 写出多帧 NDJSON（initialize 洪泛或假 client 停顿） | 在背压窗口内：子进程未因 stdio `-32603`/`os error 35` 退出；恢复读取后仍能完成至少一轮 request/response | 日志出现 `aster_acp::stdio` + `-32603` + `Resource temporarily unavailable` 且进程 exit≠0 → **产品 FAIL** |
| **P2-B** | BrokenPipe 仍致命 | 对端关闭读端后继续写 | 允许 transport 关闭 / 非零退出；**不得**被 P2-A 的「不断连」口径误判为通过 | 无错误退出却声称存活 → FAIL |

实现约束：P2-A 若本机管道在 blocking 模式下只「卡住不返回 EAGAIN」，仍以
「无 `-32603` 自杀 + 恢复读后协议存活」为过门；不得伪造 EAGAIN 进产品路径
冒充 E2E（注入属 P1）。

### P3 — agent-desktop GUI 核（必过）

复用伴生目录模式：

```text
.runtime/tui-full-e2e/acp-stdio-egain-agent-desktop-YYYYMMDD/
  bins/  evidence/  logs/  drive_*.py …
```

bins = P0 staged。mock ACL；`ASTER_DISABLE_*_ACCOUNT=1`。  
顺序固定：**E1 → E3 → E2**。

| ID | 用例 | 操作摘要 | 通过标准 | 证据 |
| --- | --- | --- | --- | --- |
| **E1** | 背压下会话存活 | Terminal 起 staged `aster` → 进入可交互；在伴生侧对 live `aster-acp` stdout **短暂停读/节流**（或等价制造出站积压）若干秒，再恢复 | history **无** `Agent connection closed`；进程仍在；日志无 stdio `-32603`/`os error 35` 致命行；恢复后仍可键入或看到 pager 存活信号 | `e1-*.json/txt/png` + 日志摘录 |
| **E3** | SIGTERM 断连对照 | 同窗口或新窗：`SIGTERM` live `aster-acp` | history **有** `Agent connection closed` 且含日志路径或 `session_end.worker_join` | `e3-*` |
| **E2** | 正常 `/quit` 对照 | 提交 `/quit`，不杀 ACP | **无** `Agent connection closed` bail | `e2-*` |

E1 若 harness 无法可靠节流子进程 stdout：记 **BLOCKED（harness）**，不得用
E3 顶替 E1；P2-A 仍须绿才可宣称「背压核」部分通过。

### P4 — 超大仓 live（加深；默认不进核）

| ID | 用例 | 条件 | 通过 | 否则 |
| --- | --- | --- | --- | --- |
| **L1** | inkstone 类工作区一轮工具对话 | 用户授权工作区路径 + 可用模型；本 checkout bins | 会话不因 stdio `os error 35` 死；允许索引 `BudgetExceeded` 警告 | 无授权/额度 → **BLOCKED**，写入 Explicitly not claimed |

### P5 — 证据

```text
docs/evidence/code/2026-11-15-acp-stdio-egain/
  OUTCOME.md           # 产品修复（已有）
  E2E-TEST-PLAN.md     # 本规划
  E2E-OUTCOME.md       # 执行后填写（与产品 OUTCOME 分开）
```

每条用例记：命令、计数、PASS/FAIL/BLOCKED、证据路径。产品 FAIL 不停改 oracle。

---

## 5. 战役通过定义

**PASS** 当且仅当：

1. P0 全绿（本 checkout 成对 BUILD_ID）；
2. P1 全绿；
3. P2-A 与 P2-B 全 PASS；
4. P3：E1 PASS（或 E1 harness BLOCKED **且** P2-A PASS 已披露）、E3 PASS、E2 PASS；
5. 未点名的 P4 在 `E2E-OUTCOME.md` 写 SKIP 或 BLOCKED。

**PARTIAL**：P0+P1+P2 绿 + P3 子集绿 + 其余非产品 BLOCKED。  
**FAIL**：P1/P2/P3 任一条产品性失败，或用旧安装 bin 冒充通过。

---

## 6. Explicitly not claimed（规划层）

- Studio 宿主 E2E / `just build-studio`。
- 发布/安装通道替换（另案 post-release）。
- 调高索引 64MiB 预算当作本修复通过条件。
- 全量 `shipped_tui_e2e` / 多平台手跑矩阵。
- Windows / Linux GUI（本计划默认 Darwin + Terminal「终端」）。
- 提交/推送（除非用户另令）。

---

## 7. 短报模板（执行后）

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

---

## 8. 与既有证据的关系

| 已有 | 本计划增量 |
| --- | --- |
| 产品 `OUTCOME.md`（RetryTransient*） | 端到端证明背压不断连 |
| 连接恢复 V1–V5（故意杀 ACP） | E3/E2 作对照；E1 为新增背压存活 |
| post-release / Phase 8 安装路径 | 本计划默认 **checkout staged**；发布通道另案 |
| inkstone 事故日志 | P4-L1 可选复验；非默认核 |
