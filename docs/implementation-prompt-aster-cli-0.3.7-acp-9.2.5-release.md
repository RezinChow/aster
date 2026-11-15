# Aster CLI 0.3.7 / Core+ACP 9.2.5 发布执行提示词

状态：连接恢复战役 **CLOSED-PASS**；修复 tip `6c2916864` 已在 `main`，但 **不在** 已发布的 `aster-cli-v0.3.6` / `aster-acp-v9.2.4`（tag = `e74ecd8d9`）。  
本文件是把断连恢复（及同 tip 上已合入的 pager/core 修复）打成**下一正式版**的权威执行合同。日期基线：2026-11-15。

工作目录：Aster 仓库根。**直接把本文交给执行智能体。**

> **授权分层：**  
> - 执行本提示词 = 授权 **R0–R4**（升版本、写 RELEASE、本地卫生、commit、push 到 `origin/main`、等待/核对 qualify）。  
> - **R5 打 tag / R6 发布归档与通道** 默认不做，须本轮点名「打 tag」「发布 CLI」等。  
> - 禁止 `git push --force`；禁止移动已有 `aster-cli-v0.3.6` / `aster-acp-v9.2.4` tag；禁止改已发布二进制。  
> - Studio / 全量 shipped_tui / delayed_catalog **不**挡本发布。

| 文档 | 角色 |
| --- | --- |
| **本文** | 本版发布合同 |
| `docs/release-governance.md` | 标签、Latest、通道、成对归档 |
| `crates/code/manual/RELEASE_9.2.4.md` | 上版说明模板 |
| `docs/evidence/code/2026-11-15-phase7-campaign-final-closeout/OUTCOME.md` | 战役 CLOSED-PASS |
| `docs/evidence/code/2026-11-15-agent-connection-recovery/OUTCOME.md` | 产品修复根 |

版本目标（固定，勿改号除非用户另令）：

| 产品 | 新版本 | Tag |
| --- | --- | --- |
| Aster CLI | `0.3.7` | `aster-cli-v0.3.7` |
| Core / ACP | `9.2.5` | `aster-acp-v9.2.5` |

---

## 0. 事实（不得否认）

| 项 | 状态 |
| --- | --- |
| 已发布 CLI | `aster-cli-v0.3.6` @ `e74ecd8d9` |
| 已发布 ACP | `aster-acp-v9.2.4` |
| 连接恢复 | `6c2916864` **之后**才进 main；本地战役 BUILD_ID `70787face…` |
| 工作区 Cargo | 仍写 `0.3.6` / `9.2.4` → 本阶段须升到目标号 |
| Studio | 不在本发布范围 |

用户可见主因（写入 RELEASE）：ACP 断连恢复硬化（stdin line-buffer、bridge/stderr 诊断、TUI bail、合法 catalog miss → `__parse_error`），附交叉引用战役证据；勿声称 Studio / 全量 TUI 矩阵已绿。

---

## 1. 必须 / 可选

| ID | 目标 | 完成标准 |
| --- | --- | --- |
| **R0** | 卫生 | `main` 对齐 origin；无本任务无关脏文件进提交；确认 `6c2916864` 为 `HEAD` 祖先 |
| **R1** | 升版本 | `apps/aster` → `0.3.7`；`crates/code/core` 与 `crates/code/acp` → `9.2.5`（两处一致）；按仓库惯例更新锁/引用若需要 |
| **R2** | RELEASE 说明 | 新建 `crates/code/manual/RELEASE_9.2.5.md`（结构对齐 9.2.4；含用户可见变更、资格、Known limits） |
| **R3** | 本地快检 | `cargo build --locked -p aster -p aster-acp`；utf8 + transport hermetic；版本号自检脚本（见 §3） |
| **R4** | 入库 | 单（或拆）commit + **push `origin/main`**；OUTCOME 记 SHA；等待 `qualify-aster-cli`（及 ACP 侧 `qualify-code`）对**该 SHA** 成功 |
| **R5** | 打 tag | 仅点名：同一干净 SHA 上 `aster-acp-v9.2.5` 与 `aster-cli-v0.3.7`（顺序见 §5） |
| **R6** | 发布 | 仅点名：核草稿 → 发布版本化 Release（`--latest=false`）→ `release-aster-cli-channel.yml` 更新 stable |

短报：§7。证据目录：`docs/evidence/code/<日期>-cli-0.3.7-acp-9.2.5-release/OUTCOME.md`。

---

## 2. 约束

- 只改发布所需路径；不借机重构。  
- Core 与 ACP **版本字符串必须相同**。  
- Tag 必须落在**已 push 且 qualify 绿**的 commit；tag 名必须匹配 Cargo 版本。  
- CLI 与 ACP **成对**从同一提交构建；归档含共享 BUILD_ID + SHA256SUMS + `embedding/`。  
- Known limits 可保留 9.2.4 中仍成立的 shipped-TUI / PTY 条目；**新增**「连接恢复战役证据见 …；不声称 Studio」。  
- 不 `amend` 已推送提交；不 force；不删除旧版 tag 除非治理清理另令。

---

## 3. R0–R3：准备

```sh
EV=.runtime/tui-full-e2e/cli-0.3.7-release-$(date +%Y%m%d)
mkdir -p "$EV/evidence"
git fetch origin
git status -sb | tee "$EV/evidence/r0-status.txt"
git rev-parse HEAD | tee "$EV/evidence/r0-head.txt"
git merge-base --is-ancestor 6c2916864 HEAD
```

版本编辑（精确）：

1. `apps/aster/Cargo.toml`：`version = "0.3.7"`  
2. `crates/code/core/Cargo.toml`：`version = "9.2.5"`  
3. `crates/code/acp/Cargo.toml`：`version = "9.2.5"`  
4. 若工作区其它成员 **必须** 跟随声明同一 ACP/core 版本，按现有依赖写法更新（勿扩大范围）。  
5. `cargo metadata` / 构建会碰 `Cargo.lock` 时，只纳入与版本 bump 相关的 lock 变更。

新建 `crates/code/manual/RELEASE_9.2.5.md`，用户可见至少含：

- ACP/TUI 断连恢复：line-buffered stdin、bridge 退出/stderr 定位、欢迎/会话断连 bail 文案、Cursor catalog miss 走 `__parse_error` 而非 fail-closed 身份错误。  
- 交叉引用：`docs/evidence/code/2026-11-15-agent-connection-recovery/OUTCOME.md` 与 phase7 总账。  
- Qualification：`qualify-code` + `qualify-aster-cli`；tags `aster-acp-v9.2.5` / `aster-cli-v0.3.7`；`--latest=false`。

本地快检：

```sh
cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp
cargo test --locked -p aster-acp --test acp_conformance_stdio \
  fragmented_utf8_session_new_survives_outbound_interleave -- --test-threads=1
cargo test --locked -p aster-pager --lib acp::aster_spawn::transport_tests -- --test-threads=1
# 版本自检
python3 - <<'PY'
from pathlib import Path
def ver(p):
    for line in Path(p).read_text().splitlines():
        if line.startswith("version = "):
            return line.split('"', 2)[1]
    raise SystemExit(p)
assert ver("apps/aster/Cargo.toml") == "0.3.7"
assert ver("crates/code/core/Cargo.toml") == ver("crates/code/acp/Cargo.toml") == "9.2.5"
print("version_ok")
PY
```

可选：`python3 tests/release_governance.py`。

---

## 4. R4：commit + push + qualify

建议 message：

```text
release(cli): prepare Aster CLI 0.3.7 with Core/ACP 9.2.5

Ship the ACP disconnect-recovery hardening on a new immutable CLI/ACP
version pair; 0.3.6/9.2.4 remain the prior published window.
```

Stage：Cargo 版本、`Cargo.lock`（若有）、`RELEASE_9.2.5.md`、本提示词、本阶段 OUTCOME（可先草案后补 SHA）。

```sh
git push origin HEAD
# 记录 SHA；用 gh 等待 qualify（示例）
gh run list --workflow=qualify-aster-cli.yml --branch main --limit 5
gh run list --workflow=qualify-code.yml --branch main --limit 5
```

**R4 完成标准：** 目标 SHA 上 `qualify-aster-cli` **success**；ACP 变更故 `qualify-code` 亦须 **success**（若工作流对该路径触发）。失败 → 修 main，**不要**打 tag。

---

## 5. R5–R6（仅点名）

在 **同一 SHA**（R4 绿）：

```sh
# 顺序建议：先 ACP 源码 tag，再 CLI tag（或按团队既有习惯，但须同 SHA）
git tag -a aster-acp-v9.2.5 -m "aster-acp v9.2.5"
git tag -a aster-cli-v0.3.7 -m "aster-cli v0.3.7"
git push origin aster-acp-v9.2.5 aster-cli-v0.3.7
```

监视 `release-code.yml` / `release-aster-cli.yml`。  
CLI：按治理在发布机 `dist/` + `bash scripts/publish-aster-cli.sh`（`GH_REPO`、`BUILD_SHA`、`ARTIFACT_RUN_ID`）；核草稿成员/版本/SHA-256 后发布；**`--latest=false`**。  
然后 `release-aster-cli-channel.yml` 输入 `0.3.7`，更新 `aster-cli-stable` 与 Latest 上兼容 `latest.json`。

不得把桌面 Latest 改成 CLI。

---

## 6. OUTCOME

```text
docs/evidence/code/<实际日期>-cli-0.3.7-acp-9.2.5-release/OUTCOME.md
```

含：准备 SHA、qualify run URL/结论、tag 做或 SKIP、发布做或 SKIP、与 `6c2916864` 祖先关系、`Explicitly not claimed`、§7 短报。

---

## 7. 短报模板

```text
阶段：cli-0.3.7-acp-9.2.5-release
R1版本：aster=0.3.7；acp/core=9.2.5
R4：SHA=…；qualify-cli=…；qualify-code=…
R5-tag：SKIP|OK（aster-cli-v0.3.7 / aster-acp-v9.2.5）
R6发布：SKIP|OK；channel=…
证据：docs/evidence/code/…/OUTCOME.md
```

---

## 8. 完成定义

- **默认（未点名发布）：** R0–R4 完成；版本已在 `origin/main`；qualify 绿；OUTCOME 写明 tag/发布 SKIP。  
- **点名发布后：** R5–R6 完成；版本化 Release 非 draft；通道清单指向 `aster-cli-v0.3.7`；公开下载与 `--latest=false` 复核。

### Explicitly not claimed

- `0.3.6` 二进制「已含」断连恢复。  
- Studio / 桌面 `v*` 同步升级。  
- 全量 `shipped_tui_e2e` / 多平台手跑矩阵已绿。  
- `delayed_catalog` flake 已修。  
- 未点名时 tag 或 stable 通道已更新。
