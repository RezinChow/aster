# Aster 第三阶段：连接恢复落地 + 战役收口 执行提示词

状态：Phase 2 已闭合 kimi CL（PASS×2）；连接恢复产品 diff **仍未提交**；长程 OUTCOME 正文仍写 PARTIAL。  
本文件是**第三阶段**权威执行合同。日期基线：2026-11-15。

工作目录：Aster 仓库根。**直接把本文交给执行智能体。**

> **授权边界：** 执行本提示词 = 授权按 §5 **拆分 git commit** 下列范围内文件。  
> **推送 / 安装替换 / Studio** 默认不做，须用户另令。

| 文档 | 角色 |
| --- | --- |
| **本文** | 第三阶段执行合同 |
| `docs/evidence/code/2026-11-15-phase2-kimi-cl-and-land/OUTCOME.md` | CL 已闭合；未提交 |
| `docs/evidence/code/2026-11-15-long-horizon-complex-e2e/OUTCOME.md` | 须收口判定 |
| `docs/evidence/code/2026-11-15-agent-connection-recovery/OUTCOME.md` | 产品修复记录 |
| `docs/implementation-prompt-aster-phase2-kimi-cl-and-land.md` | 上阶段合同 |

不要重跑已绿的 L2 / C4 / H1 / H3 / AL / L4 / kimi CL×2，除非落地前 hermetic 失败。  
不要改 `/goal` 产品语义。不要把密钥写入证据。

---

## 0. 当前事实（不得否认）

| 项 | 状态 |
| --- | --- |
| 连接恢复 P1–P3 | 已验；工作区 dirty |
| Visual harness | `drive_control_loop.py` / `drive_lh_parallel_hard.py` 已为 kimi 加固 |
| 长程战役 | 功能上 CL 已由 Phase 2 补绿；**文档判定仍写 PARTIAL** |
| 提交 / 推送 | 未做 |

待提交产品路径：

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

待提交测试 / 文档路径：

```text
apps/aster/tests/visual_tui_harness/drive_control_loop.py
apps/aster/tests/visual_tui_harness/drive_lh_parallel_hard.py
docs/evidence/code/2026-11-15-agent-connection-diagnosis/
docs/evidence/code/2026-11-15-agent-connection-recovery/
docs/evidence/code/2026-11-15-agent-connection-recovery-agent-desktop/
docs/evidence/code/2026-11-15-long-horizon-complex-e2e/
docs/evidence/code/2026-11-15-phase2-kimi-cl-and-land/
docs/implementation-prompt-aster-agent-connection-recovery.md
docs/implementation-prompt-aster-agent-connection-recovery-agent-desktop-e2e.md
docs/implementation-prompt-aster-long-horizon-complex-agent-desktop-e2e.md
docs/implementation-prompt-aster-phase2-kimi-cl-and-land.md
docs/implementation-prompt-aster-phase3-land-recovery-and-closeout.md
```

`.runtime/` 伴生 **不**提交。

---

## 1. 必须完成

| ID | 目标 | 完成标准 |
| --- | --- | --- |
| **C0** | 落地前卫生 | 成对 BUILD_ID；utf8 + transport_tests 绿 |
| **C1** | 拆分提交 | ≥2 个 commit：产品 /（测试+文档）；message 说明 why |
| **C2** | 战役文档收口 | 长程 OUTCOME 增加「经 Phase 2 补绿后战役 CL=PASS」说明；总判定改为 **PASS（kimi CL 由 Phase 2 闭合）** 或保留 PARTIAL 但显式写「仅文档未更新」——**推荐改为 PASS 并交叉引用 Phase 2** |
| **C3** | Phase 3 OUTCOME | 新证据目录记录 commit hash、未推送 |
| **C4** | 短报 | 原样给出 §7 模板 |

可选（默认跳过）：

| ID | 何时做 |
| --- | --- |
| C5 | 用户点名：`live_interactive_dialogue_real_llm`（L5） |
| C6 | 用户点名：`git push` |
| C7 | 用户点名：安装替换 staged bins |

---

## 2. 约束

- 保留工作区无关改动；只 stage §0 列出的路径。  
- 提交前：`git diff --cached --name-only` 自审；无密钥 / 无 `.runtime/`。  
- 不 `git reset --hard`；不 `--no-verify`；不 amend 非本阶段 HEAD。  
- 不用 Studio；不重开 kimi 全战役。  
- HEREDOC 写 commit message（遵循仓库既有风格）。

---

## 3. C0：卫生

```sh
EV=.runtime/tui-full-e2e/phase3-land-$(date +%Y%m%d)
mkdir -p "$EV/evidence"
cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp
# BUILD_ID 一致
cargo test --locked -p aster-acp --test acp_conformance_stdio \
  fragmented_utf8_session_new_survives_outbound_interleave -- --test-threads=1
cargo test --locked -p aster-pager --lib acp::aster_spawn::transport_tests \
  -- --test-threads=1
```

失败 → **停止提交**，先修。

可选（不阻塞提交）：  
`python3 …/drive_connection_recovery.py v1` 或 `v3` 冒烟。

---

## 4. C2：文档收口（可在 commit 前改）

编辑 `docs/evidence/code/2026-11-15-long-horizon-complex-e2e/OUTCOME.md`：

1. 顶部判定改为：**PASS**（kimi CL 由 Phase 2 闭合；本文件仍保留首次 CL FAIL 记录）。  
2. 增加一节「Amendment / Phase 2」：链接  
   `docs/evidence/code/2026-11-15-phase2-kimi-cl-and-land/OUTCOME.md`，写明 CL PASS×2 日期与驱动修复。  
3. 短报中 CL 行更新为：`CL=PASS(kimi Phase2×2；首次 FAIL 见正文)`。  
4. `Explicitly not claimed` 删除「Campaign PASS under kimi for L3-CL」那条矛盾项，改为「首次 kimi CL 三次失败未抹掉，仅后续闭合」。

不要删除首次失败证据表。

---

## 5. C1：拆分提交

按顺序（每步 `git status` / `git diff --cached --name-only`）：

### Commit 1 — 产品

Stage 仅 §0「待提交产品路径」。

建议 message：

```text
fix(acp/pager/core): harden ACP disconnect recovery and tool correction

Keep stdin line-buffered under cancel-safe I/O, retain bridge exit/stderr
diagnostics for TUI bail, and route valid Cursor catalog misses through
__parse_error without fail-closed identity errors.
```

### Commit 2 — 测试 + 文档 + 本提示词

Stage harness + 全部相关 `docs/evidence/…` + `docs/implementation-prompt-aster-*.md`。

建议 message：

```text
test(visual-harness)+docs: close kimi control-loop e2e and record recovery evidence

Harden agent-desktop control-loop/welcome waits for kimi, and land diagnosis,
recovery, long-horizon, and phase-2/3 evidence plus execution prompts.
```

若 docs 过大需再拆：允许 Commit 2a harness、2b docs——但至少产品与其它分开。

提交后：`git status` 应无上述路径残留（允许其它无关 dirty）。

---

## 6. C3：Phase 3 OUTCOME

```text
docs/evidence/code/<实际日期>-phase3-land-recovery-and-closeout/OUTCOME.md
```

含：HEAD（提交后）、两个 commit 的 hash/subject、C0 命令结果、推送=未做、`Explicitly not claimed`。

若 OUTCOME 产生在 commit 之后：再做一个极小 `docs:` commit，或在 Commit 2 前写好再一并提交（推荐先写草案再 C1）。

---

## 7. 短报模板

```text
阶段：phase3-land-recovery-and-closeout
C0卫生：utf8=…；transport=…
C1提交：product=…；docs/test=…（hashes）
C2战役文档：long-horizon判定=PASS|…
推送：未推送
证据：docs/evidence/code/…/OUTCOME.md
未做：L5；安装替换；Studio
```

---

## 8. 完成定义

- C0 绿；C1 至少两个 commit 已在本地；C2 长程判定与 Phase 2 一致；C3 OUTCOME 已写。  
- 未推送 unless C6。  
- 产品与证据路径已从 `git status` 清除（相对本任务范围）。

### Explicitly not claimed

- 远程已更新。  
- 用户机器 `~/.local/bin` 已替换。  
- L5 / Studio / 全量 shipped_tui_e2e。  
- 首次 kimi CL 三次失败「不曾发生」。  
- `delayed_catalog` flake 已修。
