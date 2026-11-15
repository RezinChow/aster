# Aster 第八阶段：安装后断连 GUI 冒烟 执行提示词

状态：Phase 7 战役总账 **CLOSED-PASS**；残留表仍列「安装后 GUI 冒烟」。  
本机 `~/.local/bin` 已是战役 BUILD_ID `70787face…`。  
本文件是**第八阶段**权威执行合同：用**安装路径上的成对 bin**做连接恢复 **V1** 冒烟，关闭该残留。日期基线：2026-11-15。

工作目录：Aster 仓库根。**直接把本文交给执行智能体。**

> **授权边界：** 执行本提示词 = 授权跑 §4 **V1 GUI 冒烟**、写证据、以及 **docs commit + `git push origin HEAD`**（禁 force）。  
> **不**默认重跑 V2–V5 / 长程全案 / L5。  
> **Studio / 额外 wire / delayed_catalog / 全量 shipped_tui** 仍 SKIP，须点名；Studio 须**另合同**。

| 文档 | 角色 |
| --- | --- |
| **本文** | 第八阶段执行合同 |
| `docs/evidence/code/2026-11-15-phase7-campaign-final-closeout/OUTCOME.md` | 总账；残留含本项 |
| `docs/evidence/code/2026-11-15-agent-connection-recovery-agent-desktop/OUTCOME.md` | 原 V1–V5（staged bins） |
| `docs/evidence/code/2026-11-15-phase6-install-replace-closeout/OUTCOME.md` | 安装替换 |
| `.runtime/…/agent-connection-recovery-agent-desktop-20261115/drive_connection_recovery.py` | 伴生驱动（私有，不提交） |

不要改产品代码（冒烟 FAIL 时先归因：安装漂移 / PATH / 环境，再决定是否另开修复）。  
不要把密钥写入证据。不要 Studio。不要 `push --force`。

---

## 0. 当前事实（不得否认）

| 项 | 状态 |
| --- | --- |
| 战役 | CLOSED-PASS |
| 安装 | `~/.local/bin` ≈ `70787face…`（Phase 6/7） |
| 原 GUI 恢复 | V1–V5 PASS，但用的是 **staged** bins，非安装路径 |
| 本阶段目的 | 证明**操作机 PATH 安装对**仍具备 V1 断连文案 |

---

## 1. 必须完成 / 可选

| ID | 目标 | 完成标准 |
| --- | --- | --- |
| **S0** | 安装身份 | `command -v` → `~/.local/bin`；`aster`/`aster-acp` BUILD_ID 成对且 = `70787face…`（或诚实 DRIFT 并停止/点名重装） |
| **S1** | agent-desktop 门槛 | `agent-desktop status`（或仓库既有等价）可跑 GUI |
| **S2** | V1 冒烟 | `drive_connection_recovery.py v1`，**PATH 优先安装 bin**（或驱动显式指向安装路径）；history 含 `Agent connection closed` + 日志路径或 `session_end.worker_join` |
| **S3** | 更新残留表 | Phase 7 OUTCOME 残留「安装后 GUI 冒烟」→ 本阶段结果；本阶段 OUTCOME |
| **S4** | 入库 | docs commit + push |

可选（默认 **SKIP**）：

| ID | 目标 | 点名 |
| --- | --- | --- |
| **S5** | 加跑 V3（`/quit` 无 false disconnect） | 「加跑 V3」 |
| **S6** | Studio | 「Studio」→ 另写合同 |

---

## 2. 约束

- **禁止**仅用 `target/debug` staged bins 顶替「安装后」声称；OUTCOME 必须写明实际 `which aster` 与 BUILD_ID。  
- 若驱动硬编码 `$EV/bins`：先把**安装对**拷入本次 `$EV/bins`（来源仍是 `~/.local/bin` 或与之同 BUILD_ID 的已安装文件），并在证据写「bins 源自安装路径」。  
- 不重开长程 CL / L4 全套。  
- `.runtime/` 不提交。  
- GUI 前确认被测进程来自本机当前安装身份（AGENTS.md：勿用过期窗口冒充）。

---

## 3. S0–S1：身份与门槛

```sh
EV=.runtime/tui-full-e2e/phase8-post-install-smoke-$(date +%Y%m%d)
mkdir -p "$EV"/{evidence,bins,logs,workspace,home}
git rev-parse HEAD | tee "$EV/evidence/s0-git.txt"
command -v aster | tee "$EV/evidence/s0-which-aster.txt"
command -v aster-acp | tee "$EV/evidence/s0-which-acp.txt"
aster --build-id | tee "$EV/evidence/s0-installed-aster.txt"
aster-acp --build-id | tee "$EV/evidence/s0-installed-acp.txt"
diff -u "$EV/evidence/s0-installed-aster.txt" "$EV/evidence/s0-installed-acp.txt"
# 期望含 70787face…；否则 drift=有 → 停止或按用户点名重跑 Phase 6
grep -q 70787faceda1b14fddf4bb165f8947e062a5c429 "$EV/evidence/s0-installed-aster.txt"
# 供驱动使用：从安装路径拷入 bins（保留「安装后」语义）
cp -f "$(command -v aster)" "$(command -v aster-acp)" "$EV/bins/"
"$EV/bins/aster" --build-id | tee "$EV/evidence/s0-ev-bins-aster.txt"
diff -u "$EV/evidence/s0-installed-aster.txt" "$EV/evidence/s0-ev-bins-aster.txt"
agent-desktop status 2>&1 | tee "$EV/evidence/s1-agent-desktop-status.txt" || true
```

---

## 4. S2：V1

复用伴生（若不存在则从 Phase 恢复证据说明 BLOCKED）：

```sh
DRIVE=.runtime/tui-full-e2e/agent-connection-recovery-agent-desktop-20261115/drive_connection_recovery.py
# 按该脚本既有参数：通常 PATH="$EV/bins:$PATH" 或脚本内 bins 根
export PATH="$EV/bins:$PATH"
# 工作目录 / 证据目录按脚本约定指向 $EV
python3 "$DRIVE" v1 2>&1 | tee "$EV/evidence/s2-v1.log"
```

通过：exit 0；`v1-result.json` 或等价表明 hist 含断连文案 + 定位字段；PNG/hist 进 `$EV/evidence/`（不提交 `.runtime`）。

FAIL → 记产品性 vs 环境；不擅自改 bail 文案「为了过冒烟」。

---

## 5. S3–S4：证据与推送

```text
docs/evidence/code/<实际日期>-phase8-post-install-gui-smoke/OUTCOME.md
```

含：which/BUILD_ID、V1 命令与结果、与原 staged V1 的关系（同文案、不同 bin 来源）、Phase 7 残留更新、`Explicitly not claimed`、§6 短报。

更新：

- `docs/evidence/code/2026-11-15-phase7-campaign-final-closeout/OUTCOME.md` 残留表：安装后 GUI 冒烟 → PASS/FAIL/BLOCKED + 链到本 OUTCOME。

然后 docs commit（含本合同）+ push。

---

## 6. 短报模板

```text
阶段：phase8-post-install-gui-smoke
S0：which=…；BUILD_ID=…；drift=无|有
S2-V1：PASS|FAIL|BLOCKED
S5-V3：SKIP|…
推送：OK|…
证据：docs/evidence/code/…/OUTCOME.md
残留仍开：Studio；…
```

---

## 7. 完成定义

- S0 无漂移（或诚实停止）；S2 有判定；S3 总账残留已改；S4 已 push。  
- 未点名则 S5/S6 = SKIP。  
- 不声称 Studio / 全量矩阵 / delayed_catalog 已关闭。

### Explicitly not claimed

- Studio 宿主 E2E。  
- V2–V5 / 长程全案在本阶段重跑。  
- `delayed_catalog` 已修。  
- 安装路径之外的所有 aster 副本。  
- 下一产品史诗（Studio）已开工。

---

## 附录：战役后分叉（规划用，非本阶段必须）

| 分叉 | 建议 |
| --- | --- |
| 本文件（Phase 8） | 关闭「安装后 GUI 冒烟」残留 |
| Studio | **另写** `implementation-prompt-aster-studio-…`；`just studio-land-check` / contracts |
| 额外 wire | 点名 soak/restart/effort |
| delayed_catalog | 独立 bugfix + 证据 |
| 全量 shipped_tui_e2e | 独立验证史诗 |
