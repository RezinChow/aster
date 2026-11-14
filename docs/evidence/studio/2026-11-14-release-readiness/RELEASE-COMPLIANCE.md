# 发布规范合规台账（2026-11-14，本地整改完成）

> 权威依据：`docs/release-governance.md`（构建与发布规范）
> 目标：把「要符合发布规范」落成**可复跑、可验证**的门禁，而不是口头判断。
> 证据目录：`docs/evidence/studio/2026-11-14-release-readiness/`
> 复跑命令：`python docs/evidence/studio/2026-11-14-release-readiness/release-readiness-check.py`
> 输出：`readiness-report.json` / `readiness-report.txt`（**本地派生产物，可复跑、不入库**）；**门禁脚本全程只读**，整改写操作是用户授权后单独执行的，不由脚本代劳。
>
> ⚠️ **状态更新**：本文 §1–§6 是**代码推送前**的本地整改快照（当时 `PASS 8 / FAIL 2 / UNVERIFIABLE 3`）。之后的「代码推送」与「桌面发布链路 fail-closed 整改」见 **§8**；最新门禁为 **`PASS 9 / FAIL 1 / UNVERIFIABLE 3`**，verdict 仍为 `NOT READY FOR RELEASE`。

---

## 0. 一句话现状

**`NOT READY FOR RELEASE`**：本地整改后 **PASS 8 / FAIL 2 / UNVERIFIABLE 3**（起点为 PASS 2 / FAIL 8 / UNVERIFIABLE 3）。

本地可以做的合规准备已全部做完：G01–G05、G07、G08、G12 共 8 项转绿，`just studio-land-check` EXIT=0，工作树完全干净。剩余 **2 项 FAIL**（G06 用户明确选择不推送、G13 契约门禁需产品级开发）与 **3 项 UNVERIFIABLE**（G09 CI 环境、G10 macOS 平台、G11 Apple 公证）都不是本机 Windows 能解决的。

---

## 1. 门禁项逐条对照（以 `readiness-report.json` 为准）

| ID | 治理条款 | 检查项 | 当前实测 | 判定 | 需用户决策 |
|---|---|---|---|---|---|
| G01 | L44 | 父仓工作树干净 | `tracked deletions=0, tracked modifications=0, untracked=0, other=0` | ✅ **PASS** | — |
| G02 | L44 + `cmd_dirty` | 子模块工作树干净 | `porcelain rows=[]` | ✅ **PASS** | — |
| G03 | 发布顺序 + `studio_land_guard.py` | `just studio-land-check` | **EXIT=0**（dirty / pointer / messages 三段全过） | ✅ **PASS** | — |
| G04 | L44 | gitlink ↔ 子模块 HEAD | 父仓 `bedc3069` = 子模块 `bedc3069` | ✅ **PASS** | — |
| G05 | L38「固定工具链和锁文件」 | 四处版本一致 | 四处均 **0.2.4**；`cargo metadata --locked` EXIT=0 | ✅ **PASS** | — |
| G06 | L44 + CI 从远程 main 构建 | 与 `origin/main` 同步 | `behind=0, ahead=3` | **FAIL** | ✅ 用户选择不推送 |
| G07 | 发布顺序「干净提交」 | `git diff --check` | 父仓 EXIT=0、子模块 EXIT=0 | ✅ **PASS** | — |
| G08 | L110 | `tests/runtime_component_locks.py` | 3/3 OK | ✅ **PASS** | — |
| G09 | L104 | `tests/release_governance.py` | 本机 Windows 因 **WSL 黑名单 + GBK 输出编码** 无法判定 | ⚠️ **UNVERIFIABLE** | — |
| G10 | L42 + L80 | 发布目标平台验证 | workflow `runs-on: macos-14`；本机 Windows | ⚠️ **UNVERIFIABLE** | — |
| G11 | L80 | 签名 + 公证 + staple | 11-13 记录 `notarytool 403`；线上 v0.2.3 为**知情未公证发布** | ⚠️ **UNVERIFIABLE** | — |
| G12 | L44（发布候选质量） | 无已知功能回归 | 历史 rerun F01 2×FAIL 归档保留；当前候选冷启动复跑 **2×PASS** 且 renderer 与证据基线无差异 | ✅ **PASS** | — |
| G13 | `MATRIX.md` 口径 | Gate A 100% | 正式配置 **36.9%**；Gate B UNMEASURABLE；F 层严格达标 2/17 | **FAIL** | — |

统计：**PASS 8 / FAIL 2 / UNVERIFIABLE 3，需用户决策 1 项**（G06）。

---

## 2. 关键事实

### 2.1 445 条删除标记（已解决）

| 检查 | 整改前 | 整改后 |
|---|---|---|
| `git status --porcelain` 分类 | 445 ` D`、1 ` M`、5 `??` | 全部为 0 |
| 磁盘实存性 | 445/445 `MISSING` | HEAD tree `packages/ui` 2376 文件，`disk_missing=0` |
| HEAD tree 文件数 / 磁盘 | 2376 / 1931，差值恰 445 | 2376 / 2376 |
| `packages/ui` 是否子模块 | 否，普通 `040000 tree` | 同左 |
| `.git/index` mtime | 11-14 07:00，早于本日 E2E 操作 | 仅作为当年诊断线索保留在此，不再写入门禁报告（保证报告可复现） |

处置：`git restore --source=HEAD -- packages/ui` 无损恢复。恢复后因 `.gitattributes` 的 `eol=lf` + `core.autocrlf=true`，index stat 缓存产生 433 条假阳性 ` M`；单文件核验 `git hash-object -- packages/ui/.gitignore` 与 index blob 同为 `df5ef5bc…`、`git diff --numstat` 为空，故用 `git add -u -- packages/ui` 重算哈希刷新 stat，并以 `git diff --cached --exit-code` = 0 确认**没有任何 staged 内容变化**。

### 2.2 既成发布事实

`docs/evidence/studio/2026-11-13-desktop-0.2.3/OUTCOME.md` 记录：**v0.2.3 已发布为 GitHub Latest 并联动网站**，状态为「Developer ID 已签名、Apple 公证未完成（notarytool 403）」，且是用户知情、接受 Gatekeeper 风险后发布的。因此：

- 「当前 checkout 能否再发」与「线上 v0.2.3 是否达标」是两件事；
- `scripts/desktop_release_manifest.py` 第 142 行拒绝 `existing_version >= version`，所以 **0.2.4 合规、0.2.3 及更低会被拒绝**；
- 治理文档第 87 行：不得把已发布 tag 移到另一个提交，也不得替换已发布二进制冒充原版本。

### 2.3 门禁脚本自身的精度校验（四处已修）

1. `git()` 原先对 `git status --porcelain` 的**整段 stdout** 做 `.strip()`，会剥掉首行前导空格；` M apps/studio` 恰是路径排序首行，导致 G01 早期漏报 `tracked modifications=0`（实为 1）。改为 `strip=False` + 按 `r[:2]` 的 XY 列分类；G01 判定与 `studio_land_guard.cmd_dirty` 对齐（任何非空行含 `??` 都算 dirty）。
2. G12 原先静态读旧 rerun `OUTCOME.md` 的「2×FAIL」字符串。改为读取 `f01-rerun/f01-release-run.json`，要求 `all_pass` + 证据基线 `head == gitlink` + `runtime_unchanged` + 恰好 2 轮 PASS，并额外校验**当前候选 HEAD 与证据基线之间 `src/renderer` 无差异**，使提交后的新 gitlink 仍可引用该 AX 证据；detail 中保留历史 FAIL 说明，不改写归档。
3. G01/G02 的 remediation 与「需用户决策」标记改为按当前状态动态生成；已 PASS 的项不再打印误导性 NOTE。
4. 移除 detail 里的 `.git/index mtime`：它随每次提交变化，会让已入库的报告在复跑时反复产生差异。诊断价值改由本文件 §2.1 承载。

以上均为门禁自身精度修正，**不放宽任何断言**；总体统计的改善来自真实整改与提交。

### 2.4 结构性约束（已通过提交解决）

实测两次 `just studio-land-check`：

| 时点 | 子模块状态 | 结果 |
|---|---|---|
| 基线对齐后、版本改动前 | 干净，HEAD = gitlink = `944864f2` | **EXIT=0** |
| 四处版本改为 0.2.4 后 | 3 个版本文件 ` M` | **EXIT=1** `refused: apps/studio worktree is dirty` |
| 两个本地提交后 | 干净，HEAD = gitlink = `bedc3069` | **EXIT=0** |

根因：`Cargo.toml` / `package.json` / `tauri.conf.json` 都在子模块内，`cmd_dirty` 检查子模块 `git status --porcelain`；版本 bump 未提交时 G01/G02/G03 必然连锁 FAIL。用 `git update-index --assume-unchanged` 之类手段掩盖 dirty 属伪造工作树状态，明确禁止；唯一干净解法是提交。

---

## 3. 本轮已执行的整改（用户授权：仅本地合规准备，不推送）

| # | 动作 | 证据 / 结果 |
|---|---|---|
| ① | 保全用户 WIP | `wip-backup/reasoning_effort-wip.patch`（57 行），sha256 `ae7f4036225522042da4b8ee8e5bda1c3deb77aaedbfbaf522ede1f5fcc55a4f` 与历史逐字节一致；`stash@{0}: release-readiness-2026-11-14-reasoning-effort-wip`。WIP **未提交、未丢弃**。 |
| ② | 恢复 445 个 tracked 文件 | `git restore --source=HEAD -- packages/ui`；2376/2376 落盘；`git add -u` 消假阳性后 `git diff --cached --exit-code` = 0。 |
| ③ | 对齐子模块基线 | `git -C apps/studio checkout --detach 944864f2…`；自然带入 `cc0a7bd09`（F01 修复），**未手工修改产品源码**。 |
| ④ | 四处版本统一 0.2.4 | `Cargo.lock` / `Cargo.toml` / `package.json` / `tauri.conf.json`；`cargo metadata --locked` EXIT=0。 |
| ⑤ | F01 冷启动复跑 | `f01-rerun/f01-release-run.json`：窗口 `w-133432886` / pid 28652；Phase 0 全绿；run1 `RLF0117217`、run2 `RLF01255A3`，各 5 条 AX 断言全 OK，`RUN_EXIT=0`。`Studio.exe` 由本树重建（sha256 `d9e03eb0…`）；`runtime.tsx` 前后哈希一致。 |
| ⑥ | 忽略 WIP patch 备份 | `.gitignore` 新增 `/docs/evidence/studio/2026-11-14-release-readiness/wip-backup/`：patch 留在磁盘但不入库，避免把未提交的用户代码写进 git 历史。 |
| ⑦ | **本地提交 1（子模块）** | `bedc30698 chore(studio): bump desktop version to 0.2.4`（3 个版本文件）。 |
| ⑧ | **本地提交 2（父仓）** | 提交信息 `chore(release): align studio pointer and record 2026-11-14 verification evidence`（`Cargo.lock`、gitlink bump、`.gitignore`、5 个证据目录共 292 个文件）。父仓 HEAD 哈希会因后续合并变化，以 `git log -1` 为准；子模块提交 `bedc30698` 不受影响。 |
| ⑨ | 收尾 | 父仓 / 子模块 `git status --porcelain` 均为空；`ahead=3, behind=0`；`just studio-land-check` EXIT=0；`944864f2..bedc30698 -- src/renderer` 无差异。窗口 `[]`、4318 释放。 |

**口径未变**：未改 `MATRIX.md`、未发布任何认证覆盖率数字；历史四轮 E2E 的 FAIL / 弱证据归档保留、未改写；本轮 F01 新证据写入独立 `f01-rerun/`。

---

## 4. 剩余决策项与已知风险

> 完整的条款映射、根因诊断与可执行命令序列见同目录 **`RELEASE-RUNBOOK.md`**（本轮新增）。

1. **G06 推送**：用户本轮明确选择「仅本地合规准备」→ 不推送，`ahead=3` 保持 FAIL。若要转绿需另行授权 push `origin/main`。
2. **G13 口径（归因已纠正）**：**「Gate A 100%」不是 `release-governance.md` 条款**，而是 `MATRIX.md` 内部质量目标；`COVERAGE_UPLIFT_PLAN.md` §6 指出不启用 toyou 时理论上限 **89.4%**、95% 目标「待你确认」。需要 P0 口径裁决 + P1 纳管 + 产品级开发，非执行次数可解。门禁**仍保留 FAIL**（fail-closed），仅把归因改准确。
3. **G09**：治理文档 L104 的「主 CI 与 CLI 发布预检」**契约已固化**（`ci.yml:70` 双矩阵、`release-aster-cli.yml:34` preflight），本机 WSL 黑名单不可判定，缺的是推送后的 CI run 绿色结果。
4. **G10/G11（本轮新发现）**：除 Apple 账号协议 403 外，**`release-aster-desktop.yml` build job 未注入 `ASTERSIGN_IDENTITY` / `ASTER_NOTARY_PROFILE`**，导致 `package-host.sh` 退回 ad-hoc 签名并跳过公证（门禁报告 `workflow_notary_env=False; workflow_sign_identity=False`）。这是流程级缺口，仅解决 403 不足以达标；修 workflow 属发布配置变更，需单独授权 + Apple 凭证。
5. **⚠️ detached HEAD 风险（纠正上一轮建议）**：子模块提交 `bedc30698` 落在 detached HEAD，无分支引用。按治理文档 §分支卫生 L94–102，**不要创建长期 `release/*` 分支**（上一轮「建 release 分支」的建议不合规范，予以撤回）；正确做法是用显式 SHA 推送到远程目标分支，由 tag / 父仓 gitlink 保留提交，见 `RELEASE-RUNBOOK.md` §0.4 / §3.1。
6. **WIP 仍在 stash**：39 行 `reasoning_effort.rs` 未提交、未丢弃，也未合入发布候选；若它属于待发布功能，需由用户决定归属。

---

## 5. 明确不做（边界）

- 不推送 `origin/main`、不创建 tag、不触发 `release-aster-desktop.yml`、不上传任何 release 资产。
- 不丢弃 WIP、不 `stash pop`、不把 `wip-backup/` 纳入 git 历史。
- 不伪造工作树干净状态（禁止 `assume-unchanged` 之类的掩盖手段）。
- 不手工修改产品源码、不改 `MATRIX.md`、不改写或删除历史 FAIL / 弱证据归档。
- 不把 UNVERIFIABLE 包装成 PASS，不在 Windows 上假装完成 macOS 平台验证。
- 真正触发发布仍需用户最后明确确认。

**WIP 还原方式**（如需回到原开发态）：`git -C apps/studio checkout 07ffdfcf5` 后执行 `git -C apps/studio stash pop`；或直接套用 `wip-backup/reasoning_effort-wip.patch`。patch 与 stash 双保险，两者内容一致。

---

## 6. 合规路径（按依赖顺序，含本轮进度）

1. ✅ 恢复 445 个 tracked 文件、WIP 处置。
2. ✅ 对齐子模块基线、同步四处版本到 0.2.4、`--locked` 通过。
3. ✅ F01 冷启动复跑 2×PASS（历史 FAIL 归档保留）。
4. ✅ 2 个本地提交 → G01/G02/G03 转绿，`land-check` EXIT=0。
5. ⬜ **待决策**：处置 3 个未推送提交（含 detached HEAD 可推送性）→ G06 转绿。
6. ⬜ P0 口径裁决 + 更新 `MATRIX.md` → G13 需产品级开发。
7. ⬜ CI 的 Linux/macOS 跑 `tests/release_governance.py` → G09 转 PASS。
8. ⬜ `macos-14` / Node 24.12 跑发布流程，解决 notarytool 403，完成签名 + 公证 + staple → G10/G11 转 PASS。
9. ⬜ 全部 PASS 后，才具备「符合发布规范」的发布候选资格；触发发布**仍需用户最后明确确认**。

---

## 7. 复跑

```bash
python docs/evidence/studio/2026-11-14-release-readiness/release-readiness-check.py
```

退出码 `0` = 全部 PASS；非 `0` = 仍存在 FAIL 或 UNVERIFIABLE。报告输出到同目录 `readiness-report.json` / `readiness-report.txt` / `readiness-run.stdout.log`，这三个派生产物由 `.gitignore` 排除、不入库——否则门禁复跑会把自身证据变成 dirty，形成自指 FAIL；内容已去除易变字段，复跑可复现。本机执行时 `wsl.exe` 被安全策略拦截会打印提示，这正是 G09 被标为 `UNVERIFIABLE` 的原因，不代表脚本崩溃；`CHECK_EXIT=1` 是门禁按设计返回。

---

## 8. 增量：代码推送与桌面发布链路 fail-closed 整改（2026-11-14 晚）

> 对应指令「尽快完成发布推送」→「继续完成符合规范的发布」。
> **结论：代码推送完成；发布链路已改为符合治理文档 L80 的 fail-closed；但 v0.2.4 正式发布未执行，且当前客观条件不允许执行。**

### 8.1 代码推送（已完成）

fetch 时发现 `origin/main` 已被推进 1 个提交 `a2fd94d08`（`feat(tui): add /init and prepare CLI 0.3.5 / Core+ACP 9.2.3`），本地从 `ahead 3` 变为 `ahead 3 / behind 1`，直接 push 会 non-fast-forward。本地未推送历史含 merge commit `b3ebd90e`，rebase 会展平历史；`git merge-tree --write-tree` 只读预演无冲突，故采用**非破坏性 merge**，`Cargo.lock`（远程 Core/ACP 9.2.3 段 vs 本地 aster-studio 0.2.4 段）自动合并成功，生成 `842d82d6a`。

| 仓库 | 推送 | 结果 |
|---|---|---|
| `aster-ai-lab/studio` | `944864f27..bedc30698 → main`（显式 SHA，不建 `release/*`） | EXIT=0 |
| `aster-ai-lab/aster` | `a2fd94d08..842d82d6a → main` | EXIT=0 |

推送前 `cargo metadata --locked` EXIT=0、`just studio-land-check` EXIT=0、四处版本 0.2.4、`gitlink == sub HEAD == bedc30698`；推送后两仓 `ahead=0 / behind=0`、工作树 0 行 dirty、远程 gitlink 可解析、无 `v0.2.4` tag。G06 由 FAIL 转 **PASS**，门禁变为 **`PASS 9 / FAIL 1 / UNVERIFIABLE 3`**。

### 8.2 新发现：桌面发布流程会静默产出不合规产物

- 仓库 secrets **只有 `STUDIO_READ_TOKEN`**；variables 只有 `ASTER_PLUGIN_ROOT_SHA256`；无承载签名/公证凭证的 environment。
- `release-aster-desktop.yml` build job 原 `env` 无 `ASTERSIGN_IDENTITY` / `ASTER_NOTARY_PROFILE`；`apps/studio/scripts/package-host.sh:80-98` 在无身份时退回 ad-hoc 签名、无 profile 时跳过 `notarytool` / `stapler` / `spctl`，**但仍继续 archive 并把 zip 上传 `desktop-stable`**。治理文档 L80 要求签名、公证和平台验证，因此直接 `workflow_dispatch` 会把未公证包写入稳定通道。
- `ci.yml` 的 `name: Rust` 就是 L104 所指主 CI，`Release tag and channel governance` 在第 70 行；但本次 push 的 `check (ubuntu/macos)` 在更靠前的 `Format`（`cargo fmt --check`）就失败，治理测试**根本没执行到** → G09 仍无绿色结果。该 rustfmt 失败与推送前 `a2fd94d08` 的失败逐行一致，非本次引入。

### 8.3 已落地的整改（仅父仓，不动已验证的 0.2.4 发布候选）

| 文件 | 改动 |
|---|---|
| `.github/workflows/release-aster-desktop.yml` | build job `env` 注入 `ASTERSIGN_IDENTITY` / `ASTER_NOTARY_PROFILE` secrets；新增 **`Require signing and notarization credentials`**，缺任一 secret 即在构建/上传前 `exit 1`；新增 `Release governance preflight` 运行治理测试 |
| `tests/release_governance.py` | 新增 `test_desktop_release_refuses_missing_notarization_credentials`，固化凭证注入 + `exit 1` 契约 |
| `release-readiness-check.py` | G11 detail 增加 `workflow_fail_closed` 与凭证未配置事实；**status 仍 `UNVERIFIABLE`**（流程修复 ≠ 公证完成证据，不放宽） |

**验证**：`yaml` 解析 OK（build env 8 项、preflight 位于构建之前、`publish.needs=build`）；`python3 -m unittest tests.release_governance.ReleaseContracts -q` → `Ran 7 tests OK`；提取 preflight 实测：缺凭证 `exit 1` + `::error::Refusing to publish an unsigned or unnotarized desktop build...`，凭证齐全 `exit 0`。

> 签发与公证的**实际执行**还依赖 macOS runner 导入证书、建立 keychain profile、Apple 协议恢复。本轮未实现证书导入（需额外 secrets 且本机无法验证），也未伪造这些能力。

### 8.4 为什么 v0.2.4 正式发布仍未执行

整改后的 workflow 在凭证缺失时**按设计拒绝发布**——这是当前「符合规范」的正确结果。仍缺：

1. secrets：`ASTERSIGN_IDENTITY`（值须以 `Developer ID Application:` 开头）、`ASTER_NOTARY_PROFILE`；
2. `macos-14` runner：导入 Developer ID 证书与私钥、`xcrun notarytool store-credentials` 建立 profile（需 Apple ID / Team ID / app-specific password）；
3. Apple 账号持有人接受协议，解除 `notarytool` 403；
4. 主 CI `check (ubuntu/macos)` 转绿、治理测试 step 实际执行（G09）；
5. macOS 平台验证与 `notarytool` / `stapler` / `spctl` 绿色证据（G10/G11）；
6. 治理 §L81/L83：版本化 `v0.2.4` Release 并标记仓库 Latest、刷新 Latest 上 CLI 兼容 `latest.json`（当前 workflow 只更新 `desktop-stable`）；
7. G13 的 P0 口径裁决（`MATRIX.md` 内部目标、非治理条款，但门禁仍 fail-closed）；
8. 用户最后一次明确确认触发发布。

### 8.5 边界

未创建 `v0.2.4` tag、未 `workflow_dispatch release-aster-desktop.yml`、未上传任何 Release 资产、未改动 `desktop-stable`、未改 `docs/release-governance.md`、未改 `MATRIX.md`、未改产品源码、未 `stash pop` WIP。WIP 仍在 `stash@{0}` 与 `wip-backup/reasoning_effort-wip.patch`。
