# Aster 第六阶段：本机安装替换收口 执行提示词

状态：连接恢复 → 长程 GUI → kimi CL → land → push → L5 W1 **均已闭合并在 `origin/main`**。  
操作机 `~/.local/bin/aster` 仍观测为**旧** BUILD_ID（`8b86e521…`），checkout 成对 tip 为 `70787face…`。Studio / 其它 wire 案仍未做。  
本文件是**第六阶段**权威执行合同。日期基线：2026-11-15。

工作目录：Aster 仓库根。**直接把本文交给执行智能体。**

> **授权边界：** 执行本提示词 = 授权 §4 **安装替换**到 `$HOME/.local/bin`（或环境变量 `ASTER_INSTALL_BIN`）、写证据、以及证据/本合同的 **docs commit + `git push origin HEAD`**（禁 force）。  
> **Studio / 额外 wire 案 / 全量 shipped_tui_e2e** 默认跳过，须点名。

| 文档 | 角色 |
| --- | --- |
| **本文** | 第六阶段执行合同 |
| `docs/evidence/code/2026-11-15-phase5-l5-wire-and-optional-install/OUTCOME.md` | 上阶段：L5 PASS；安装 SKIP |
| `docs/evidence/code/2026-11-15-long-horizon-complex-e2e/OUTCOME.md` | 战役 PASS（含 L5 W1） |
| `docs/implementation-prompt-aster-phase5-l5-wire-and-optional-install.md` | 上阶段合同（E5=安装） |

不要重跑已绿 L2–L5 / kimi CL，除非安装后冒烟失败且需归因。  
不要改产品语义。不要把密钥写入证据。不要 Studio（除非点名另合同）。不要 `push --force`。

---

## 0. 当前事实（不得否认）

| 项 | 状态 |
| --- | --- |
| 产品恢复 + 证据 | 已在 `origin/main` |
| 长程战役（含 L5 W1） | **PASS** |
| checkout `target/debug/aster{,-acp}` | BUILD_ID `70787face…`（成对） |
| `~/.local/bin/aster` | **旧** `8b86e521…`（Phase 5 对照） |
| Studio | 未做 |

本阶段**主线**是把操作约定路径上的 `aster`+`aster-acp` 换成**本 checkout 成对构建**，并留下可核对的 BUILD_ID 证据。  
这是操作面收口，**不**重新打开 GUI 全战役。

---

## 1. 必须完成 / 可选

| ID | 目标 | 完成标准 |
| --- | --- | --- |
| **I0** | 本 checkout 成对重建 | `aster`/`aster-acp` BUILD_ID 一致；记录安装前 dst BUILD_ID |
| **I1** | 安装替换 | `cp` 成对到 `DST_DIR`；替换后 dst BUILD_ID == src |
| **I2** | 冒烟 | `DST_DIR/aster --build-id`；`DST_DIR/aster-acp --build-id`；可选 `--help` 非空退出 0 |
| **I3** | Phase 6 OUTCOME + 短报 | 新证据目录；src/dst 路径与 BUILD_ID；未声称全机替换 |
| **I4** | 证据入库 | docs commit（含本合同若未入库）+ push |

可选（默认 **SKIP**）：

| ID | 目标 | 点名 |
| --- | --- | --- |
| **I5** | 安装后 agent-desktop 断连冒烟（如 `drive_connection_recovery.py v1`） | 「安装后冒烟 GUI」 |
| **I6** | 额外 wire 案 | 「加跑 soak / restart」 |
| **I7** | Studio | 「Studio」→ 另写合同；`studio-land-discipline` |

---

## 2. 约束

- 默认 `DST_DIR="${ASTER_INSTALL_BIN:-$HOME/.local/bin}"`。若用户路径不同，以环境变量或本轮明示为准。  
- **只**替换该目录下的 `aster` 与 `aster-acp`；不做卸载器、不删其它副本、不改 PATH。  
- 源必须是本 checkout `target/debug/`（或本阶段刚 build 的同对）；禁止把旧 `~/.local/bin` 再拷回自己冒充成功。  
- debug 构建可安装；若用户点名 release，先 `cargo build --release --locked -p aster -p aster-acp` 并用 `target/release/`，OUTCOME 写明 profile。  
- `.runtime/` 不提交；无密钥。  
- 不 `git reset --hard`；保留无关 dirty。

---

## 3. I0：构建与安装前对照

```sh
EV=.runtime/tui-full-e2e/phase6-install-$(date +%Y%m%d)
mkdir -p "$EV/evidence"
git rev-parse HEAD | tee "$EV/evidence/i0-git.txt"
git status -sb | tee "$EV/evidence/i0-status.txt"
DST_DIR="${ASTER_INSTALL_BIN:-$HOME/.local/bin}"
echo "DST_DIR=$DST_DIR" | tee "$EV/evidence/i0-dst-dir.txt"
cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp
SRC_ASTER=target/debug/aster
SRC_ACP=target/debug/aster-acp
"$SRC_ASTER" --build-id | tee "$EV/evidence/i0-src-aster.txt"
"$SRC_ACP" --build-id | tee "$EV/evidence/i0-src-acp.txt"
diff -u "$EV/evidence/i0-src-aster.txt" "$EV/evidence/i0-src-acp.txt"
# 安装前（可能不存在）
"$DST_DIR/aster" --build-id 2>/dev/null | tee "$EV/evidence/i0-dst-aster-before.txt" || echo "missing" | tee "$EV/evidence/i0-dst-aster-before.txt"
"$DST_DIR/aster-acp" --build-id 2>/dev/null | tee "$EV/evidence/i0-dst-acp-before.txt" || echo "missing" | tee "$EV/evidence/i0-dst-acp-before.txt"
```

src 不一致 → **停止**，不安装。

---

## 4. I1–I2：替换与冒烟

```sh
cp -f "$SRC_ASTER" "$SRC_ACP" "$DST_DIR/"
"$DST_DIR/aster" --build-id | tee "$EV/evidence/i1-dst-aster-after.txt"
"$DST_DIR/aster-acp" --build-id | tee "$EV/evidence/i1-dst-acp-after.txt"
diff -u "$EV/evidence/i0-src-aster.txt" "$EV/evidence/i1-dst-aster-after.txt"
diff -u "$EV/evidence/i0-src-acp.txt" "$EV/evidence/i1-dst-acp-after.txt"
# which 应优先命中 DST（若 PATH 含该目录）
command -v aster | tee "$EV/evidence/i2-which-aster.txt"
command -v aster-acp | tee "$EV/evidence/i2-which-acp.txt"
"$DST_DIR/aster" --help >/dev/null
"$DST_DIR/aster-acp" --help >/dev/null
```

`diff` 失败 → **FAIL**，调查 PATH/权限/拷贝目标；不要改写 BUILD_ID 声称。

I5 点名时：用**新** bin 路径跑既有连接恢复 v1 冒烟；失败记 BLOCKED/FAIL，不回滚安装除非用户另令。

---

## 5. I3–I4：OUTCOME 与推送

```text
docs/evidence/code/<实际日期>-phase6-install-replace-closeout/OUTCOME.md
```

含：HEAD、profile（debug/release）、DST_DIR、before/after BUILD_ID、I2 结果、I5–I7 SKIP 或结果、`Explicitly not claimed`、§6 短报。

可选一句：更新 long-horizon / phase5 OUTCOME 的「安装未做」表述为「Phase 6 已替换 `DST_DIR`」——**推荐**，避免文档矛盾。

然后 docs commit + push（可与本合同同 commit）：

```sh
git add docs/implementation-prompt-aster-phase6-install-replace-closeout.md \
  docs/evidence/code/*-phase6-install-replace-closeout/ \
  docs/evidence/code/2026-11-15-long-horizon-complex-e2e/OUTCOME.md \
  docs/evidence/code/2026-11-15-phase5-l5-wire-and-optional-install/OUTCOME.md
git diff --cached --name-only
git commit -m "$(cat <<'EOF'
docs(evidence): record phase-6 install replace closeout

Replace the operator pair under the agreed bin dir with the checkout
BUILD_ID and keep Studio / extra wire cases explicitly skipped.
EOF
)"
git push origin HEAD
```

---

## 6. 短报模板

```text
阶段：phase6-install-replace-closeout
I0：src=…；dst_before=…
I1安装：OK|FAIL；DST=…；dst_after=…
I2冒烟：OK|FAIL
I5-GUI：SKIP|…
推送：OK|…
证据：docs/evidence/code/…/OUTCOME.md
未做：Studio；…
```

---

## 7. 完成定义

- I0–I2 绿（或诚实 FAIL）；I3 OUTCOME + 短报；I4 已 push。  
- 未点名则 I5–I7 = SKIP。  
- 只声称 `DST_DIR` 这一对已替换。

### Explicitly not claimed

- 全机每一个 `aster` 副本已替换。  
- release 发布通道 / GitHub Release 资产已更新（本阶段是本地 debug 对拷，除非点名 release）。  
- Studio / 全量 `shipped_tui_e2e` / 其它 wire 案。  
- `delayed_catalog` flake 已修。  
- 安装后长时间 GUI 全战役回归。
