# Aster 第七阶段：连接恢复 / 长程战役 总收口 执行提示词

状态：Phase 2–6 已闭合——kimi CL、本地 land、`origin/main` 推送、L5 W1、本机 `~/.local/bin` 成对替换（`70787face…`）。  
本文件是**第七阶段**权威执行合同：把整条战役收成一份总账，并显式停泊剩余分叉。日期基线：2026-11-15。

工作目录：Aster 仓库根。**直接把本文交给执行智能体。**

> **授权边界：** 执行本提示词 = 授权写总收口证据、必要时极小文档对齐、以及 **docs commit + `git push origin HEAD`**（禁 force）。  
> **不**默认重跑 GUI 全战役 / L5 / 安装。  
> **Studio / 安装后 GUI 冒烟 / 额外 wire / delayed_catalog 修复** 默认 SKIP，须点名。

| 文档 | 角色 |
| --- | --- |
| **本文** | 第七阶段执行合同（战役总收口） |
| `docs/evidence/code/2026-11-15-phase6-install-replace-closeout/OUTCOME.md` | 上阶段：安装 OK |
| `docs/evidence/code/2026-11-15-long-horizon-complex-e2e/OUTCOME.md` | 长程 PASS（含 L5） |
| `docs/evidence/code/2026-11-15-agent-connection-recovery/OUTCOME.md` | 产品修复根 |
| Phase 2–5 OUTCOME | 分阶段证据链 |

不要改产品代码（除非点名项暴露回归且用户另令）。不要把密钥写入证据。不要 `push --force`。不要开新分支。

---

## 0. 战役已闭合事实（不得否认）

| 阶段 | 结果（摘要） |
| --- | --- |
| 诊断 / 恢复产品 | ACP line-buffer / ToolUnavailable→`__parse_error` / bridge stderr / TUI bail；hermetic + agent-desktop V1–V5 / L4 |
| 长程 GUI | L0–L4 PASS；CL 首次 kimi FAIL×3 保留；Phase 2 PASS×2 闭合 |
| Phase 3 | 拆分 commit 本地落地 |
| Phase 4 | 推送到 `origin/main` |
| Phase 5 | L5 W1 `live_interactive_dialogue` PASS |
| Phase 6 | `~/.local/bin` `8b86e521…` → `70787face…` |

当前操作机：`aster --build-id` 应已是 `70787face…`（若漂移，记入总账，**不**在本阶段擅自重装除非点名）。

---

## 1. 必须完成 / 可选

| ID | 目标 | 完成标准 |
| --- | --- | --- |
| **F0** | 卫生快照 | `git status`、`HEAD`、`origin/main` 对齐、`aster`/`aster-acp` BUILD_ID（checkout + 安装路径） |
| **F1** | 总收口 OUTCOME | 新目录：交叉引用 Phase 2–6 + 诊断/恢复/长程；战役判定 **CLOSED-PASS**（附残留表） |
| **F2** | 残留分叉表 | Studio / 额外 wire / delayed_catalog / 全量 shipped_tui / 安装后 GUI 冒烟 — 每条状态 +「需另合同」 |
| **F3** | 短报 | §6 模板 |
| **F4** | 入库 | docs commit（含本合同）+ push |

可选（默认 **SKIP**）：

| ID | 目标 | 点名 |
| --- | --- | --- |
| **F5** | 安装后断连 GUI 冒烟（`drive_connection_recovery.py v1` 或等价，**用 PATH 上新 bin**） | 「安装后冒烟 GUI」 |
| **F6** | 额外 wire ignore 案 | 「加跑 soak / restart」 |
| **F7** | Studio 宿主验证 | 「Studio」→ **必须另写** Studio 合同；遵守 `studio-land-discipline`；本文件不展开用例 |

---

## 2. 约束

- 本阶段以**文档总账**为主；不重跑已绿套件，除非 F5/F6 点名。  
- 总账不得把首次 kimi CL FAIL×3 改写成「从未发生」。  
- 不得声称 Studio / 全平台矩阵 / delayed_catalog 已修。  
- `.runtime/` 不提交。  
- 不 `git reset --hard`；保留无关 dirty。

---

## 3. F0：快照

```sh
EV=.runtime/tui-full-e2e/phase7-final-$(date +%Y%m%d)
mkdir -p "$EV/evidence"
git rev-parse HEAD | tee "$EV/evidence/f0-git.txt"
git status -sb | tee "$EV/evidence/f0-status.txt"
git rev-parse HEAD origin/main | tee "$EV/evidence/f0-heads.txt"
target/debug/aster --build-id 2>/dev/null | tee "$EV/evidence/f0-checkout-aster.txt" || echo "no-checkout-bin" | tee "$EV/evidence/f0-checkout-aster.txt"
aster --build-id | tee "$EV/evidence/f0-installed-aster.txt"
aster-acp --build-id | tee "$EV/evidence/f0-installed-acp.txt"
command -v aster aster-acp | tee "$EV/evidence/f0-which.txt"
```

若安装 BUILD_ID ≠ 战役 `70787face…`：总账记 **DRIFT**，并在残留表写「需重跑 Phase 6 或点名重装」——本阶段默认不重装。

---

## 4. F1–F2：总收口 OUTCOME

```text
docs/evidence/code/<实际日期>-phase7-campaign-final-closeout/OUTCOME.md
```

结构要求：

1. **Campaign verdict:** `CLOSED-PASS`（连接恢复 + 长程含 L5 + 远程 land + 约定路径安装）。  
2. **Evidence chain** 表：诊断 → 恢复 → agent-desktop → 长程 → Phase2…Phase6（路径 + 一句话结果）。  
3. **Residual ledger**（F2）：至少含 Studio、其它 wire、delayed_catalog、全量 shipped_tui_e2e、安装后 GUI 冒烟（若未点名 F5）。  
4. **Explicitly not claimed** + §6 短报原文。  
5. 可选：在 long-horizon OUTCOME `Follow-on` 增加一句指向本总账（推荐）。

不要复制整份长程表；交叉引用即可。

---

## 5. F4：入库

```sh
git add docs/implementation-prompt-aster-phase7-campaign-final-closeout.md \
  docs/evidence/code/*-phase7-campaign-final-closeout/ \
  docs/evidence/code/2026-11-15-long-horizon-complex-e2e/OUTCOME.md
git diff --cached --name-only
git commit -m "$(cat <<'EOF'
docs(evidence): close agent-connection and long-horizon campaign ledger

Record the CLOSED-PASS chain across recovery through install replace and
park Studio and remaining optional verification as explicit residuals.
EOF
)"
git push origin HEAD
```

---

## 6. 短报模板

```text
阶段：phase7-campaign-final-closeout
F0：HEAD=…；install_BUILD_ID=…；drift=无|有
战役判定：CLOSED-PASS
残留：Studio；…（列表）
F5冒烟：SKIP|PASS|…
推送：OK|…
证据：docs/evidence/code/…/OUTCOME.md
```

---

## 7. 完成定义

- F0 快照齐全；F1 总账判定 CLOSED-PASS；F2 残留表诚实；F3 短报；F4 已 push。  
- 未点名则 F5–F7 = SKIP。  
- 本战役（终端 CLI/ACP 连接恢复 + 长程 agent-desktop）在文档上宣告收口；Studio 不在完成定义内。

### Explicitly not claimed

- Studio 宿主 E2E 或 gitlink 落地。  
- 全量 `shipped_tui_e2e` / 多平台矩阵。  
- `delayed_catalog` flake 已修。  
- 首次 kimi CL FAIL×3 不曾发生。  
- 安装后 GUI 冒烟已跑（除非 F5）。  
- 下一产品史诗已开工。
