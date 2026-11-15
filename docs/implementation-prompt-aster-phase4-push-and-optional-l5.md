# Aster 第四阶段：推送收口 + 可选 L5 / 安装 执行提示词

状态：Phase 3 已完成本地拆分提交与战役文档收口；`main` **ahead 3**、**未推送**；L5 / 安装替换 / Studio 仍未做。  
本文件是**第四阶段**权威执行合同。日期基线：2026-11-15。

工作目录：Aster 仓库根。**直接把本文交给执行智能体。**

> **授权边界：** 执行本提示词 = 授权 §5 **`git push` 当前 ahead 提交到 `origin`**（仅本分支已有本地 commit，不开新分支、不 force）。  
> **L5 / 安装替换 / Studio** 默认跳过，须用户在本轮另写点名（见 §1 可选表）。

| 文档 | 角色 |
| --- | --- |
| **本文** | 第四阶段执行合同 |
| `docs/evidence/code/2026-11-15-phase3-land-recovery-and-closeout/OUTCOME.md` | 上阶段：本地 land、未推送 |
| `docs/evidence/code/2026-11-15-long-horizon-complex-e2e/OUTCOME.md` | 战役 PASS；L5 未跑 |
| `docs/implementation-prompt-aster-phase3-land-recovery-and-closeout.md` | 上阶段合同（C6=推送） |

不要重跑已绿的 L2 / C4 / H1 / H3 / AL / L4 / kimi CL×2 / C0 hermetic，除非推送前卫生失败或用户点名回归。  
不要改 `/goal` 产品语义。不要把密钥写入证据。不要 `git push --force`。不要开新分支。

---

## 0. 当前事实（不得否认）

| 项 | 状态 |
| --- | --- |
| 连接恢复产品 + harness + 证据 | 已本地 commit |
| 长程战役文档判定 | **PASS**（kimi CL 由 Phase 2 闭合） |
| 本地相对 `origin/main` | **ahead 3** |
| 远程 | 尚未包含恢复修复 |
| L5 ACP wire | 未跑 |
| 安装替换 / Studio | 未做 |

预期未推送提交（`git log origin/main..HEAD --oneline` 须一致或说明偏差）：

```text
4122a095e docs(evidence): record phase-3 land commit hashes
c9c378f7f test(visual-harness)+docs: close kimi control-loop e2e and record recovery evidence
6c2916864 fix(acp/pager/core): harden ACP disconnect recovery and tool correction
```

工作区应干净于本任务范围；若有无关 dirty，**保留、不 stage、不纳入 push 说明以外的提交**。

---

## 1. 必须完成 / 可选

| ID | 目标 | 完成标准 |
| --- | --- | --- |
| **D0** | 推送前卫生 | `origin/main..HEAD` = 上述 3（或记录偏差）；无密钥 / 无 `.runtime/` 进历史；可选再跑 utf8 + transport |
| **D1** | 推送 | `git push origin HEAD`（当前跟踪分支，通常 `main`）；成功；**禁止** `--force` / `--no-verify` |
| **D2** | 远程确认 | `git status -sb` 无 ahead；`git log -1 --oneline origin/main` 含 Phase 3 tip |
| **D3** | Phase 4 OUTCOME + 短报 | 新证据目录；写明 push 前后 hash、远程、未做项 |

可选（**默认跳过**；用户本轮点名才做）：

| ID | 目标 | 点名关键词示例 |
| --- | --- | --- |
| **D4** | L5 `live_interactive_dialogue_real_llm` | 「跑 L5」「wire dialogue」 |
| **D5** | 安装替换 staged/本 checkout bins → 用户约定路径（常见 `~/.local/bin`） | 「安装替换」 |
| **D6** | Studio 宿主侧验证 | 「Studio」——**本阶段合同不展开**；若点名则另写 Studio 提示词，遵守 `studio-land-discipline` |

---

## 2. 约束

- 只推送已存在的本地 commit；不在本阶段为「凑 push」再改产品语义。  
- 若 `git push` 被拒（non-fast-forward / 权限）：**停止**，记录完整 stderr；不 rebase、不 force，除非用户另令。  
- 不 `git reset --hard`；不丢弃无关 dirty。  
- L5 用真实 provider + 既有 ACL（`ASTER_CONFIG_FILE` / 上阶段 kimi ACL）；密钥不进 OUTCOME。  
- 安装替换前再次核对成对 `BUILD_ID`；写清源路径与目标路径；不做全系统卸载。  
- Studio 不在本文件完成定义内。

---

## 3. D0：推送前卫生

```sh
EV=.runtime/tui-full-e2e/phase4-push-$(date +%Y%m%d)
mkdir -p "$EV/evidence"
git status -sb | tee "$EV/evidence/d0-status.txt"
git log origin/main..HEAD --oneline | tee "$EV/evidence/d0-ahead.txt"
git rev-parse HEAD | tee "$EV/evidence/d0-head.txt"

# 确认三 commit 主题仍在；若多/少，写入 OUTCOME 并停止询问前先如实记录
# 扫描即将推送的路径不含 .runtime/ 与明显密钥文件名：
git diff --name-only origin/main..HEAD | tee "$EV/evidence/d0-files.txt"
```

可选（推荐，不阻塞 push，除非失败且与恢复相关）：

```sh
cargo test --locked -p aster-acp --test acp_conformance_stdio \
  fragmented_utf8_session_new_survives_outbound_interleave -- --test-threads=1 \
  2>&1 | tee "$EV/evidence/d0-utf8.log"
cargo test --locked -p aster-pager --lib acp::aster_spawn::transport_tests \
  -- --test-threads=1 \
  2>&1 | tee "$EV/evidence/d0-transport.log"
```

若 D0 发现本地还有**未提交**的本战役必要文件：先按 Phase 3 纪律补极小 docs commit，再进入 D1；不要把无关 dirty 塞进新 commit。

---

## 4. D1–D2：推送与确认

```sh
git push origin HEAD 2>&1 | tee "$EV/evidence/d1-push.log"
git status -sb | tee "$EV/evidence/d2-status.txt"
git rev-parse HEAD origin/main | tee "$EV/evidence/d2-heads.txt"
git log -3 --oneline origin/main | tee "$EV/evidence/d2-remote-tip.txt"
```

完成标准：本地与 `origin/main` 对齐（本任务相关 ahead 清零）；push log 无 force。

---

## 5. D4（可选）：L5 ACP wire

仅当用户点名。从本 checkout 保证 `aster-acp` 可被测到：

```sh
cargo build --locked -p aster-acp --bin aster-acp
# 使用上阶段可用的 ACL（kimi temperature=1 或仓库约定 live ACL）
export ASTER_CONFIG_FILE="${ASTER_CONFIG_FILE:-/Users/roylin/code/config.acl}"
# 若需 pin 模型，沿用战役环境变量约定（勿把密钥写入证据）
cargo test --locked -p aster-acp --test live_interactive_dialogue_real_llm \
  real_agent_holds_an_interactive_dialogue_over_the_wire \
  -- --ignored --test-threads=1 \
  2>&1 | tee "$EV/evidence/d4-l5.log"
```

判定：测试 PASS → OUTCOME 记 L5=PASS；缺配置 / 额度 → **BLOCKED**（附原因，不改产品硬过）；产品性失败 → FAIL + 最小归因，**不**在本阶段借机大改。

交叉更新（可选一句）：  
`docs/evidence/code/2026-11-15-long-horizon-complex-e2e/OUTCOME.md` 的 L5 行从「未跑」改为实际结果，并链到本阶段 OUTCOME。

---

## 6. D5（可选）：安装替换

仅当用户点名。示例（按用户机器实际前缀调整；先 `which aster`）：

```sh
SRC_ASTER=target/debug/aster          # 或本战役 staged bins
SRC_ACP=target/debug/aster-acp
DST_DIR="${ASTER_INSTALL_BIN:-$HOME/.local/bin}"
"$SRC_ASTER" --build-id | tee "$EV/evidence/d5-build-id-src-aster.txt"
"$SRC_ACP" --build-id | tee "$EV/evidence/d5-build-id-src-acp.txt"
diff -u "$EV/evidence/d5-build-id-src-aster.txt" "$EV/evidence/d5-build-id-src-acp.txt"
cp -f "$SRC_ASTER" "$SRC_ACP" "$DST_DIR/"
"$DST_DIR/aster" --build-id | tee "$EV/evidence/d5-build-id-dst-aster.txt"
"$DST_DIR/aster-acp" --build-id | tee "$EV/evidence/d5-build-id-dst-acp.txt"
diff -u "$EV/evidence/d5-build-id-src-aster.txt" "$EV/evidence/d5-build-id-dst-aster.txt"
```

不得声称「全机所有 aster 副本已替换」。

---

## 7. D3：Phase 4 OUTCOME

```text
docs/evidence/code/<实际日期>-phase4-push-and-optional-l5/OUTCOME.md
```

含：D0 摘要、push 前 HEAD、push 后 `origin/main`、三 commit 列表、D4/D5 做或跳过、`Explicitly not claimed`、§8 短报原文。

若 OUTCOME 需入库：推送**之后**可再做一个极小 `docs:` commit 并 **再次 push**（仍禁止 force）；或仅留本地——须在短报写明「OUTCOME 已写 / 是否已推」。

推荐：先完成 D1–D2，再写 OUTCOME；若要 OUTCOME 进远程，二次 push 记入同一 OUTCOME「amend push」。

---

## 8. 短报模板

```text
阶段：phase4-push-and-optional-l5
D0卫生：ahead=3|…；utf8=…|skip；transport=…|skip
D1推送：结果=OK|FAIL；remote=origin/main@…
D4-L5：SKIP|PASS|FAIL|BLOCKED
D5安装：SKIP|OK（path=…）
证据：docs/evidence/code/…/OUTCOME.md
未做：Studio；…
```

---

## 9. 完成定义

- D0 记录齐全；D1 push 成功（或诚实失败并停止）；D2 远程对齐；D3 OUTCOME + 短报已交。  
- 未点名则 D4/D5/D6 = SKIP 并写入未做。  
- 不声称 Studio / 全量 `shipped_tui_e2e` / `delayed_catalog` flake 已修。

### Explicitly not claimed

- Studio 宿主 E2E 或 gitlink 落地。  
- 全量 `shipped_tui_e2e` / 全平台矩阵。  
- 首次 kimi CL 三次失败「不曾发生」。  
- `delayed_catalog` flake 已修。  
- 用户机器上每一个 `aster` 路径均已替换（仅 D5 点名路径）。  
- L5 在未点名时已跑过。
