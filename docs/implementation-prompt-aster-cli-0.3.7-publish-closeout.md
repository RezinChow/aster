# Aster CLI 0.3.7 / ACP 9.2.5 — 打 tag + 发布收口 执行提示词

状态：**发布未完成。**  
R0–R4 已完成：版本在 `main`，准备提交 `1a8e38d51` 上 `qualify-aster-cli` + `qualify-code` 均为 **success**。  
**尚无** `aster-cli-v0.3.7` / `aster-acp-v9.2.5` tag，**尚无**版本化 Release，**通道仍指向旧窗**（当前 stable 为 `aster-cli-stable`，未含 0.3.7）。  
本文件是 **R5–R6 发布收口**权威执行合同。日期基线：2026-11-15。

工作目录：Aster 仓库根。**直接把本文交给执行智能体。**

> **授权边界：** 执行本提示词 = 授权在指定 SHA 上 **打并推送** `aster-acp-v9.2.5` 与 `aster-cli-v0.3.7`，监视 release 工作流，按治理 **发布版本化 CLI/ACP Release（`--latest=false`）**，并运行 **`release-aster-cli-channel.yml`（输入 `0.3.7`）**。  
> 禁止 force；禁止移动/覆盖 `aster-cli-v0.3.6` / `aster-acp-v9.2.4`；禁止把桌面 Latest 改成 CLI。

| 文档 | 角色 |
| --- | --- |
| **本文** | 发布收口合同（R5–R6） |
| `docs/implementation-prompt-aster-cli-0.3.7-acp-9.2.5-release.md` | 准备合同（R0–R4 已闭） |
| `docs/evidence/code/2026-11-15-cli-0.3.7-acp-9.2.5-release/OUTCOME.md` | 准备证据；本阶段追加发布结果 |
| `docs/release-governance.md` | 通道与 Latest 规则 |
| `scripts/publish-aster-cli.sh` | CLI 草稿/上传 |

---

## 0. 事实（不得否认）

| 项 | 值 |
| --- | --- |
| 版本 bump + RELEASE 提交（**推荐 tag 点**） | `1a8e38d51747e91a44ec11385fdea8fd4f8f6225` |
| 该 SHA qualify-cli | success — run `43691256330` |
| 该 SHA qualify-code | success — run `43691256356` |
| 后续 docs tip | `9253244ec…`（仅 OUTCOME；可后推，**不要**用未绿 tip 打 tag） |
| Tag / Release 0.3.7 | **不存在** |
| 用户可见变更 | 见 `crates/code/manual/RELEASE_9.2.5.md`（断连恢复） |

**Tag 固定落在 `1a8e38d51`（全文 SHA 如上）。** 若必须带 OUTCOME tip：先等 tip 的 qualify 绿，再改 tag 点——默认不改。

---

## 1. 必须完成

| ID | 目标 | 完成标准 |
| --- | --- | --- |
| **P0** | 复核 | `git fetch`；确认 tag 不存在；确认 `1a8e38d51` 仍含 `0.3.7`/`9.2.5` 与 `6c2916864` 祖先 |
| **P1** | 打 tag | 同 SHA：`aster-acp-v9.2.5`、`aster-cli-v0.3.7`；`git push origin` 两 tag |
| **P2** | 监视构建 | `release-code.yml`（ACP）与 `release-aster-cli.yml`（CLI）对 tag 跑完；记录 run id / 结论 |
| **P3** | 发布 CLI | 按治理下载归档到 `dist/`，`BUILD_SHA=1a8e38d51…` + `ARTIFACT_RUN_ID=<cli release run>`，干净 checkout 该 SHA 上跑 `publish-aster-cli.sh`；核草稿后 **publish**（非 draft）；`--latest=false` |
| **P4** | 发布 ACP | 确认 `aster-acp-v9.2.5` Release 已按 `release-code.yml` 产出并发布（或流程自动完成）；`--latest=false` |
| **P5** | 通道 | `gh workflow run release-aster-cli-channel.yml -f version=0.3.7`（或 UI 等价）；成功后 `aster-cli-stable` 清单指向 `aster-cli-v0.3.7` |
| **P6** | 证据 + 短报 | 更新 OUTCOME：tag、Release URL、channel、SHA；push docs |

---

## 2. 约束

- 发布机 `git checkout` / 工作树须满足 `publish-aster-cli.sh`：`HEAD == BUILD_SHA`，CLI 输入路径干净。  
- 归档成员与 SHA-256 按脚本与治理核对；缺 `embedding/` 等必需成员 → 停止。  
- 桌面 Latest 归属不变；只更新 CLI stable + Latest 上的**兼容** `latest.json`（由 channel 流程负责）。  
- Studio 不在范围。

---

## 3. P0–P1

```sh
EV=.runtime/tui-full-e2e/cli-0.3.7-publish-$(date +%Y%m%d)
mkdir -p "$EV/evidence"
RELEASE_SHA=1a8e38d51747e91a44ec11385fdea8fd4f8f6225
git fetch origin --tags
git rev-parse "$RELEASE_SHA"
git cat-file -t "$RELEASE_SHA"
# 确认无 tag
git ls-remote --tags origin 'aster-cli-v0.3.7' 'aster-acp-v9.2.5' | tee "$EV/evidence/p0-tags-before.txt"
# 应为空
git merge-base --is-ancestor 6c2916864 "$RELEASE_SHA"

git tag -a aster-acp-v9.2.5 "$RELEASE_SHA" -m "aster-acp v9.2.5"
git tag -a aster-cli-v0.3.7 "$RELEASE_SHA" -m "aster-cli v0.3.7"
git push origin aster-acp-v9.2.5 aster-cli-v0.3.7 2>&1 | tee "$EV/evidence/p1-push-tags.log"
```

---

## 4. P2–P5

```sh
# 监视（示例）
gh run list --workflow=release-aster-cli.yml --limit 5
gh run list --workflow=release-code.yml --limit 5
# 待 CLI release run 成功后：
# 1) 下载该 run 的 aster-cli-{macos,linux,linux-arm64,windows}（及可选 kylin）到 dist/
# 2) git checkout "$RELEASE_SHA" 且 CLI 输入干净
# 3)
#    export GH_REPO=aster-ai-lab/aster
#    export BUILD_SHA=$RELEASE_SHA
#    export ARTIFACT_RUN_ID=<release-aster-cli run id>
#    bash scripts/publish-aster-cli.sh
# 4) 人工/脚本确认草稿：提交、成员、版本、SHA-256 → gh release edit … --draft=false
#    （若脚本已直接 create 非 draft，以脚本行为为准并记录）
gh workflow run release-aster-cli-channel.yml -f version=0.3.7
# 等待 channel 成功；核对 aster-cli-stable / 兼容 latest.json 指向 aster-cli-v0.3.7
```

ACP：跟随 `release-code.yml` 对 `aster-acp-v9.2.5` 的产物与 Release；失败则停止通道更新并记 FAIL。

---

## 5. P6 证据

更新：

`docs/evidence/code/2026-11-15-cli-0.3.7-acp-9.2.5-release/OUTCOME.md`

追加：P1 tag、P2 run、P3/P4 Release URL、P5 channel、终态短报。  
docs commit + push（可在发布完成后）。

---

## 6. 短报模板

```text
阶段：cli-0.3.7-publish-closeout
P1-tag：OK|FAIL；SHA=1a8e38d51
P2构建：cli=…；acp=…
P3-CLI-Release：OK|…；url=…
P4-ACP-Release：OK|…
P5-channel：OK|…；stable→0.3.7
证据：docs/evidence/code/2026-11-15-cli-0.3.7-acp-9.2.5-release/OUTCOME.md
```

---

## 7. 完成定义

- 两 tag 在 origin；两产品版本化 Release 已发布（非 draft）；CLI stable 指向 `aster-cli-v0.3.7`；OUTCOME 已更新。  
- 桌面 Latest 仍属桌面；CLI 使用 `--latest=false`。

### Explicitly not claimed

- `0.3.6` 用户已自动升到含恢复的版本（取决于其是否跑 update / 重装）。  
- Studio 已发。  
- 全量 shipped_tui / delayed_catalog 已修。
