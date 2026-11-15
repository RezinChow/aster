# Aster 下一阶段：kimi CL 闭合 + 连接恢复落地 执行提示词

状态：上一阶段长程战役 **PARTIAL**；连接恢复产品 diff **已验、未提交**。  
本文件是**下一阶段**权威执行合同。日期基线：2026-11-15。

工作目录：Aster 仓库根。**直接把本文交给执行智能体。**

| 文档 | 角色 |
| --- | --- |
| **本文** | 下一阶段执行合同 |
| `docs/evidence/code/2026-11-15-long-horizon-complex-e2e/OUTCOME.md` | 上阶段成绩；勿改写成全绿 |
| `docs/evidence/code/2026-11-15-long-horizon-complex-e2e/E2E-TEST-PLAN.md` | 长程用例定义 |
| `docs/implementation-prompt-aster-long-horizon-complex-agent-desktop-e2e.md` | 上阶段执行合同 |
| `docs/evidence/code/2026-11-15-agent-connection-recovery/OUTCOME.md` | 连接恢复产品修复记录 |
| `docs/evidence/code/2026-11-15-agent-connection-recovery-agent-desktop/OUTCOME.md` | 断连 GUI 已绿 |

不要重做已 PASS 的 L2 MT/LH、L3 C4/H1/H3/AL、L4，除非回归证明坏了。  
不要跑 Studio。不要发明 `mock-aster`。密钥不进仓库证据。

---

## 0. 上阶段结论（不得否认）

| 项 | 状态 |
| --- | --- |
| 连接恢复 P1–P3 | 产品已修；hermetic + agent-desktop V1–V5 / L4 绿；**未提交** |
| 长程 L0–L2 | PASS（`kimi-01/k3.1-pro`） |
| 长程 L3 C4/H1/H3/AL | PASS（kimi） |
| 长程 L3 CL | **FAIL×3 on kimi**；**PASS on deepseek** 回退栏 |
| 长程 L4 | PASS |
| L5 ACP wire | 未跑 |

kimi CL 已观察形态（须在 N1 归类，禁止未诊断就大改产品）：

1. **Attempt1**：R2 有 progress（`Goal not complete yet…`），随后 `/goal pause` 无可见 pause 回执。  
2. **Attempt2/3**：`/goal …` 已进入 transcript（`❯ /goal …`），720s 内无 Goal chrome / 无 `goal_out.txt`。  
3. 同驱动 + `deepseek/deepseek-flash` 一次全绿 → **优先怀疑模型/slash 受理/驱动竞态**，其次才是产品 `/goal` 回归。

工作区相关未提交路径（保留无关改动）：

```text
# 连接恢复产品
Cargo.lock
crates/code/acp/Cargo.toml
crates/code/acp/src/bin/aster-acp.rs
crates/code/acp/tests/acp_conformance_stdio.rs
crates/code/core/src/llm/cursor_account/mcp.rs
crates/code/core/src/llm/cursor_account/mcp/tests.rs
crates/terminal/crates/codegen/aster-pager/src/acp/aster_spawn.rs
crates/terminal/crates/codegen/aster-pager/src/acp/aster_spawn/transport_tests.rs
crates/terminal/crates/codegen/aster-pager/src/app/mod.rs

# 上阶段 harness 微补丁（可保留或收敛进本阶段）
apps/aster/tests/visual_tui_harness/drive_control_loop.py
apps/aster/tests/visual_tui_harness/drive_lh_parallel_hard.py

# 文档 / 证据（已有）
docs/evidence/code/2026-11-15-*
docs/implementation-prompt-aster-*.md
```

---

## 1. 本阶段必须完成

| ID | 目标 | 完成标准 |
| --- | --- | --- |
| **N0** | 基线卫生 | 本 checkout 成对重建；BUILD_ID 一致；确认上阶段 PASS 证据仍在 |
| **N1** | kimi CL 根因归类 | 书面三选一：**产品缺陷** / **驱动缺陷** / **模型/额度不稳定**；附命令与 hist 摘录 |
| **N2** | 最小修复 | 仅修 N1 判定所属层；禁止借机重构 |
| **N3** | kimi CL 复验 | `drive_control_loop.py` + `kimi-01/k3.1-pro` → PASS，或诚实 BLOCKED（须有 N1=模型且 deepseek 栏仍绿） |
| **N4** | 战役闭合记录 | 新 OUTCOME 或追加：PARTIAL→PASS / 仍 PARTIAL+BLOCKED 原因 |
| **N5** | 连接恢复落地准备 | 产品 diff 再跑 R0 hermetic 快检；**提交仅当用户本任务明确授权** |

可选（默认不做，用户点名才做）：

| ID | 目标 |
| --- | --- |
| N6 | L5 `live_interactive_dialogue_real_llm` |
| N7 | 推送 / 安装替换 / Studio |

---

## 2. 实施约束

- 默认模型：`kimi-01/k3.1-pro`；ACL：`/Users/roylin/code/config.acl` 或上阶段  
  `.runtime/tui-full-e2e/long-horizon-complex-agent-desktop-*/config.kimi01.acl`（`temperature=1`）。  
- GUI：`终端` + staged bins；oracle = 文件字节 > Terminal history > PNG。  
- deepseek 仅作对照栏，**不得**把 deepseek CL 标成 kimi 通过。  
- 不 `git reset --hard`；不开新 worktree；不提交除非用户本轮明确说「提交」。  
- 分类未完成前，禁止「为了过 CL」改 `/goal` 产品语义或放宽 oracle。

---

## 3. N0：基线

```sh
EV=.runtime/tui-full-e2e/phase2-kimi-cl-$(date +%Y%m%d)
mkdir -p "$EV"/{bins,evidence,workspaces,logs}
git rev-parse HEAD | tee "$EV/evidence/n0-git.txt"
cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp
cp -f target/debug/aster target/debug/aster-acp "$EV/bins/"
"$EV/bins/aster" --build-id | tee "$EV/evidence/build-id-aster.txt"
"$EV/bins/aster-acp" --build-id | tee "$EV/evidence/build-id-acp.txt"
diff -u "$EV/evidence/build-id-aster.txt" "$EV/evidence/build-id-acp.txt"

# 连接恢复卫生（若产品 diff 仍在）
cargo test --locked -p aster-acp --test acp_conformance_stdio \
  fragmented_utf8_session_new_survives_outbound_interleave -- --test-threads=1 \
  2>&1 | tee "$EV/evidence/n0-utf8.log"
```

`agent-desktop status` → `$EV/evidence/n0-agent-desktop-status.txt`。

---

## 4. N1：归类流程（先诊断后动手）

对**同一次** kimi CL 失败保留完整 hist（不要只留 summary）。

### 4.1 复现矩阵（至少各 1 次，记入 `n1-matrix.md`）

| 探针 | 动作 | 若失败偏向 |
| --- | --- | --- |
| P-A | 仅提交 `/goal status`（空目标） | 驱动 / slash 受理 |
| P-B | `/goal <短目标写 goal_out.txt>`，等 progress 文案 | 模型不跟 slash / 产品未挂 goal |
| P-C | 有 progress 后立即 `/goal pause` | pause 文案 / 驱动未清 composer |
| P-D | 同脚本 deepseek 冒烟 | 对照：深绿则非「驱动完全坏」 |

### 4.2 判定规则

| 证据 | 归类 |
| --- | --- |
| deepseek 绿 + kimi 多次「slash 已显示但无 Goal 绑定/无切片」且 ACP/core 日志无 goal 创建 | **模型/不稳定**（默认 BLOCKED 战役 CL，或换 pin 策略） |
| slash 未进入 hist / 仍停在 `→ /goal` | **驱动缺陷**（清 composer、回车、YOLO/ask 卡） |
| Goal 已绑定但 pause/resume/`--continue` 丢字节或状态机错，deepseek 也复现 | **产品缺陷** |

写出 `$EV/evidence/n1-verdict.md`：一句话归类 + 证据路径 + 拟修层。

---

## 5. N2：按归类最小修复

### 5.1 驱动缺陷

只改 `apps/aster/tests/visual_tui_harness/drive_control_loop.py`（及必要共享 paste 辅助）：

- 提交 `/goal` 后确认 hist 出现 Goal chrome 再等 progress；  
- pause 前强制 `clear_composer`；接受 `Paused` / `Goal paused` / CJK；  
- 失败必落 `*-fail-hist.txt`。  
禁止改生产 pager 只为迁就驱动。

### 5.2 产品缺陷

最小定位：`/goal` 受理 → ACP goal 绑定 → TUI 状态文案。  
先写/补一条 hermetic 或 focused 测试锁定复现，再修。  
范围外：Studio、自动重连、放宽权限。

### 5.3 模型/不稳定

- **不**改产品语义骗过；  
- OUTCOME 记 CL=BLOCKED（kimi）+ deepseek 对照 PASS；  
- 可选：文档化「CL 门禁模型」白名单（执行提示词层），不改用户默认 ACL。

---

## 6. N3：kimi CL 复验

```sh
CFG=…/config.kimi01.acl   # 或 /Users/roylin/code/config.acl + ASTER_PINNED 等价
MODEL=kimi-01/k3.1-pro
CASE=cl-control-loop
python3 apps/aster/tests/visual_tui_harness/drive_control_loop.py \
  --bin-dir "$EV/bins" \
  --work-dir "$EV/workspaces/$CASE" \
  --model "$MODEL" --config "$CFG" \
  --evidence "$EV/evidence/$CASE" \
  2>&1 | tee "$EV/evidence/$CASE/drive.log"
```

通过：`visual-control-loop-summary.json` 中 `pass=true`（R1 token、pause 可见、resume、`--continue` 后字节仍在）。  
失败：保留 hist；若 N1=模型，标 BLOCKED 而非偷偷改 oracle。

建议：**连续 2 次 PASS** 才把战役 CL 从 FAIL 改为 PASS（防 flake）。

---

## 7. N4：证据

新建或追加：

```text
docs/evidence/code/<实际日期>-phase2-kimi-cl-and-land/OUTCOME.md
```

必须交叉引用上阶段 long-horizon OUTCOME 与连接恢复 OUTCOME。  
写明：N1 归类、N2 改动路径、N3 次数与结果、是否授权提交。

短报模板：

```text
阶段：phase2-kimi-cl-and-land
N1归类：产品|驱动|模型=…
N2修复：…（或无代码）
N3 kimi CL：PASS×n / FAIL / BLOCKED
连接恢复提交：已提交|未授权未提交
证据：docs/evidence/code/…/OUTCOME.md
未做：…
```

---

## 8. N5：连接恢复落地（默认停在「可提交」）

1. 再跑：utf8 hermetic + `transport_tests` +（可选）`drive_connection_recovery.py v1`。  
2. `git diff` 自审仅含连接恢复 + 本阶段必要 harness/文档。  
3. **仅当用户本轮明确说提交**时：按仓库风格分别或合并提交；推送另需授权。  
4. 未授权 → OUTCOME 写「可提交、未提交」。

建议提交拆分（若授权）：

1. `fix(acp/pager/core): …` 连接恢复 P1–P3  
2. `test(visual-harness): …` 若有 CL/welcome 驱动修复  
3. `docs(evidence): …` OUTCOME / 本提示词

---

## 9. 完成定义

- N1 书面归类已落盘。  
- N3：kimi CL **PASS×2**，或 N1=模型且 BLOCKED + deepseek 对照仍成立。  
- N4 OUTCOME 已写；未把 PARTIAL 谎报成全绿。  
- 连接恢复：要么用户授权后已提交，要么明确未提交。  
- 无密钥入库；无 Studio。

### Explicitly not claimed（写入 OUTCOME）

- 上阶段 C4/H1/H3/AL/L2/L4 在本阶段未重跑则不重申「本阶段新证」。  
- 历史二次断连 == UTF-8 分片。  
- kimi CL 在 BLOCKED 时的「产品已修」。  
- 未授权的提交/推送。  
- Studio CUA / LH01 OCI。
