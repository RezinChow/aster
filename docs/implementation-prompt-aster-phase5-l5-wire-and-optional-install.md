# Aster 第五阶段：L5 ACP wire + 可选安装替换 执行提示词

状态：Phase 4 已将连接恢复相关提交推到 `origin/main`；长程战役文档 **PASS**，但 **L5 仍未跑**；安装替换 / Studio 仍未做。  
本文件是**第五阶段**权威执行合同。日期基线：2026-11-15。

工作目录：Aster 仓库根。**直接把本文交给执行智能体。**

> **授权边界：** 执行本提示词 = 授权跑 §4 **L5 wire**、写证据、以及为证据/本合同做 **docs commit + `git push origin HEAD`**（禁 force）。  
> **安装替换 / Studio** 默认跳过，须用户本轮点名。

| 文档 | 角色 |
| --- | --- |
| **本文** | 第五阶段执行合同 |
| `docs/evidence/code/2026-11-15-phase4-push-and-optional-l5/OUTCOME.md` | 上阶段：已推送；L5 SKIP |
| `docs/evidence/code/2026-11-15-long-horizon-complex-e2e/OUTCOME.md` | 战役 PASS；L5 行仍「未跑」 |
| `docs/evidence/code/2026-11-15-long-horizon-complex-e2e/E2E-TEST-PLAN.md` | L5 = W1 wire dialogue |
| `crates/code/acp/tests/live_interactive_dialogue_real_llm.rs` | 实跑目标 |

不要重跑已绿的 agent-desktop L2–L4 / kimi CL，除非 L5 暴露产品回归。  
不要改 `/goal` 产品语义。不要把密钥写入证据。不要 Studio（除非点名另合同）。不要 `push --force`。

---

## 0. 当前事实（不得否认）

| 项 | 状态 |
| --- | --- |
| 连接恢复产品 | 已在 `origin/main`（含 `6c2916864` 等） |
| 长程 GUI 战役 | **PASS**（L5 除外） |
| Phase 4 | push OK；D4/D5/D6 SKIP |
| 操作机 `~/.local/bin/aster` | 曾观测 **旧** BUILD_ID（例：`8b86e521…`），**不等于**本战役 staged 修复 tip — 不得用旧安装冒充 L5 二进制 |
| L5 | 未跑 |
| Studio | 未做 |

本阶段**主线**是补上战役计划中的 L5（ACP wire：多轮、中途纠偏、cancel、续聊）。  
安装替换是操作面收口，**不**替代 L5。

---

## 1. 必须完成 / 可选

| ID | 目标 | 完成标准 |
| --- | --- | --- |
| **E0** | 本 checkout 成对构建 | `aster`+`aster-acp` BUILD_ID 一致；L5 使用 `CARGO_BIN_EXE_aster-acp`（cargo test）而非 `~/.local/bin` |
| **E1** | L5 W1 | `real_agent_holds_an_interactive_dialogue_over_the_wire` → **PASS**，或诚实 **BLOCKED**（缺配置/额度）/ **FAIL**（产品性，附归因） |
| **E2** | 战役文档 L5 行 | 更新 long-horizon OUTCOME 的 L5 与短报；交叉引用本阶段 OUTCOME |
| **E3** | Phase 5 OUTCOME + 短报 | 新证据目录；命令、退出码、模型/ACL 来源（脱敏）、BUILD_ID |
| **E4** | 证据入库 | docs commit（本合同若未入库则一并）+ push |

可选（默认 **SKIP**）：

| ID | 目标 | 点名 |
| --- | --- | --- |
| **E5** | 安装替换 → `$HOME/.local/bin`（或用户给出的 `ASTER_INSTALL_BIN`） | 「安装替换」 |
| **E6** | 额外 wire 案（同文件其它 `#[ignore]`） | 「加跑 soak / restart / effort」等；**默认只跑 W1** |
| **E7** | Studio | 「Studio」→ 另写合同；遵守 studio-land-discipline |

---

## 2. 约束

- ACL：优先 `ASTER_CONFIG_FILE`；未设则用仓库 `.aster/config.acl`；战役也可用 `/Users/roylin/code/config.acl`（须在 OUTCOME 写明**路径角色**，不写密钥内容）。  
- 测试自带模型 pin / flash 语义时，**跟随测试**；不要为了「和 GUI 同模型」改测例或放宽 oracle。  
- 额度不足 / 配置缺失 → **BLOCKED**，不改产品硬过。  
- 产品性 FAIL → 最小归因；禁止借机重构。若需修产品，另开说明，本阶段仍以 L5 结果为准。  
- `.runtime/` 不提交；证据脱敏。  
- 不 `git reset --hard`；保留无关 dirty。

---

## 3. E0：构建卫生

```sh
EV=.runtime/tui-full-e2e/phase5-l5-$(date +%Y%m%d)
mkdir -p "$EV/evidence"
git rev-parse HEAD | tee "$EV/evidence/e0-git.txt"
git status -sb | tee "$EV/evidence/e0-status.txt"
cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp
target/debug/aster --build-id | tee "$EV/evidence/build-id-aster.txt"
target/debug/aster-acp --build-id | tee "$EV/evidence/build-id-acp.txt"
diff -u "$EV/evidence/build-id-aster.txt" "$EV/evidence/build-id-acp.txt"
# 对照（不得用于 L5）：
command -v aster; aster --build-id 2>/dev/null | tee "$EV/evidence/installed-aster-build-id.txt" || true
```

---

## 4. E1：L5 W1

```sh
export ASTER_CONFIG_FILE="${ASTER_CONFIG_FILE:-/Users/roylin/code/aster/.aster/config.acl}"
# 若该 ACL 不可用，改用 /Users/roylin/code/config.acl 并记入证据
cargo test --locked -p aster-acp --test live_interactive_dialogue_real_llm \
  real_agent_holds_an_interactive_dialogue_over_the_wire \
  -- --ignored --nocapture --test-threads=1 \
  2>&1 | tee "$EV/evidence/e1-l5-w1.log"
```

通过定义（与测例一致）：多轮 dialogue、中途纠偏、wire cancel、续聊 oracle 全绿。  
日志可摘脱敏 MT_ROW / verdict 行写入 OUTCOME。

E6 点名时再追加同文件其它 ignore 测；每案单独记 PASS/FAIL/BLOCKED，失败不互相顶替。

---

## 5. E2：更新长程 OUTCOME

编辑 `docs/evidence/code/2026-11-15-long-horizon-complex-e2e/OUTCOME.md`：

1. `## L5`：由「Not run」改为实际结果 + 链到 Phase 5 OUTCOME。  
2. 短报 `L5：未跑` → `L5：PASS|FAIL|BLOCKED`。  
3. `Explicitly not claimed` / `未做`：去掉「L5 未跑」类条目（若已跑）；保留 Studio 等仍未做项。  
4. 不删除既有 L0–L4 / Phase 2 amendment。

---

## 6. E3–E4：Phase 5 证据与推送

```text
docs/evidence/code/<实际日期>-phase5-l5-wire-and-optional-install/OUTCOME.md
```

含：HEAD、成对 BUILD_ID、ACL 路径角色、E1 命令与结果、E5 做或 SKIP、`Explicitly not claimed`、§7 短报。

然后：

```sh
# stage：本文（若未入库）、long-horizon OUTCOME 改动、phase5 证据目录
git add docs/implementation-prompt-aster-phase5-l5-wire-and-optional-install.md \
  docs/evidence/code/2026-11-15-long-horizon-complex-e2e/OUTCOME.md \
  docs/evidence/code/*-phase5-l5-wire-and-optional-install/
git diff --cached --name-only   # 自审：无 .runtime / 无密钥
git commit -m "$(cat <<'EOF'
docs(evidence): record phase-5 L5 wire dialogue outcome

Close the long-horizon L5 gap with the ACP live interactive dialogue
result and keep install/Studio explicitly skipped unless authorized.
EOF
)"
git push origin HEAD
```

若需拆 commit：允许「合同」与「OUTCOME」分开，仍须 push。

---

## 7. E5（可选）：安装替换

仅点名时：

```sh
DST_DIR="${ASTER_INSTALL_BIN:-$HOME/.local/bin}"
cp -f target/debug/aster target/debug/aster-acp "$DST_DIR/"
"$DST_DIR/aster" --build-id | tee "$EV/evidence/e5-dst-aster.txt"
"$DST_DIR/aster-acp" --build-id | tee "$EV/evidence/e5-dst-acp.txt"
diff -u "$EV/evidence/build-id-aster.txt" "$EV/evidence/e5-dst-aster.txt"
```

只声称替换了 `DST_DIR` 下这一对；不声称全机所有副本。

---

## 8. 短报模板

```text
阶段：phase5-l5-wire-and-optional-install
E0：BUILD_ID=…；与安装对比=旧|同|…
E1-L5-W1：PASS|FAIL|BLOCKED
E2长程L5行：已更新|…
E5安装：SKIP|OK（path=…）
推送：OK|…
证据：docs/evidence/code/…/OUTCOME.md
未做：Studio；…
```

---

## 9. 完成定义

- E0 成对；E1 有诚实判定；E2 长程 L5 行与事实一致；E3 OUTCOME + 短报；E4 已 push。  
- 未点名则 E5/E6/E7 = SKIP。  
- 不声称 Studio / 全量 `shipped_tui_e2e` / `delayed_catalog` 已修。

### Explicitly not claimed

- Studio 宿主 E2E。  
- 全量 `shipped_tui_e2e` / 多平台矩阵。  
- W1 以外的 soak/restart/effort 案（除非 E6）。  
- 操作机全部 `aster` 路径已替换（仅 E5 点名目录）。  
- GUI agent-desktop 与 wire L5 同一模型 pin。  
- `delayed_catalog` flake 已修。
