# 发布规范达标 Runbook（2026-11-14）

> 权威依据：`docs/release-governance.md`
> 当前门禁：`python docs/evidence/studio/2026-11-14-release-readiness/release-readiness-check.py` → **PASS 8 / FAIL 2 / UNVERIFIABLE 3 → `NOT READY FOR RELEASE`**
> 定位：从「本地合规准备完成」到「真正符合发布规范」的**可执行命令 + 验收证据 + 责任方**。本文不替代用户决策，也不放宽任何断言。
> 前置阅读：`RELEASE-COMPLIANCE.md`（整改台账）、`docs/evidence/studio/2026-11-13-desktop-0.2.3/OUTCOME.md`（上次发布与公证记录）。

---

## 0. 本轮调研的四点口径纠正

### 0.1 「Gate A 100%」不是发布规范条款

`release-governance.md` **通篇没有** Gate A / 100% 覆盖率要求。G13 来自 `MATRIX.md` 的内部验收口径，把它计入「发布规范门禁」是台账归因过宽。且 `apps/studio/tests/e2e/COVERAGE_UPLIFT_PLAN.md`：

- §6（第 34–36 行）：不做 toyou 租户时 51 例永久跳过，Gate A 理论上限 **89.4%**，建议把 95% 目标**正式挂起**；
- §8 决策表（第 153 行）：「95% 目标是否正式下调 → **待你确认**」；
- §2（第 89–93 行）：P0 口径裁决是计量前提，P1 纳管后预期 428/483 = 88.6%。

结论：G13 在当前口径下**结构性不可达 100%**，属于「P0 口径裁决 + 产品级开发」问题，不是跑更多测试能解的，也不是 `release-governance.md` 的硬条款。门禁仍保留它为 **FAIL**（fail-closed），但归因改为「内部质量目标」而非「治理条款」。

### 0.2 CI 预检契约已经固化，G09 缺的是 run 结果

治理文档第 104 行「主 CI 与 CLI 发布预检都必须运行 `tests/release_governance.py`」已满足：

| 位置 | 证据 |
|---|---|
| `.github/workflows/ci.yml:69-70` | `Release tag and channel governance: python3 tests/release_governance.py`，矩阵 `ubuntu-latest` + `macos-latest` |
| `.github/workflows/release-aster-cli.yml:34` | `preflight` job 第一步运行该测试，且 build/publish 各 job `needs: preflight` |
| `.github/workflows/qualify-aster-cli.yml:88` | 资格校验同样运行 |

本机 Windows 因 `wsl.exe` 被安全策略黑名单拦截 + GBK 输出编码无法判定（UTF-8 模式复跑仍被拦截，按策略不再重试）。因此 G09 的正确解法不是在本机跑通，而是**推送后取得 CI run 的绿色结果**。

### 0.3 桌面发布流程存在签名/公证凭证缺口（本轮新发现，优先级最高）

`release-aster-desktop.yml` 的 build job（`macos-14`）调用 `pnpm package:host`，但其 `env`（第 36–42 行）只有 `CARGO_INCREMENTAL`、`ASTER_TENANT_SLUG`、`ASTER_DEFER_RUNTIME_COMPONENTS`、`ASTER_PLUGIN_ROOT_SHA256`、`ASTER_RUNTIME_COMPONENTS_LOCK`，**没有 `ASTER_NOTARY_PROFILE`，也没有注入 Developer ID 签名身份**。

对照 `apps/studio/scripts/package-host.sh`：

```bash
# 第 80-87 行：无 Developer ID identity 时退回 ad-hoc 签名
if [ -n "$identity" ]; then
  codesign --force --options runtime --timestamp ... --sign "$identity" "$app"
else
  echo "package-host: no Developer ID identity, falling back to an ad-hoc signature" >&2
  codesign --force --sign - "$app"
fi
# 第 89-98 行：仅当 ASTER_NOTARY_PROFILE 非空才公证
if [ -n "${ASTER_NOTARY_PROFILE:-}" ]; then
  xcrun notarytool submit ... --keychain-profile "$ASTER_NOTARY_PROFILE" --wait
  xcrun stapler staple "$app"; xcrun stapler validate "$app"
  spctl --assess --type execute --verbose=2 "$app"
fi
```

因此 CI 直接产出的 `Aster-darwin-aarch64-vX.Y.Z.zip` 默认是 **ad-hoc 签名、未公证**，而治理文档第 80 行要求「用桌面发布流程完成签名、公证和平台验证」。上次 v0.2.3 的签名/公证是**本地 macOS 手工跑 `package-dmg.sh`** 完成的（且被 Apple 403 阻断），不是 workflow 能力。这是比「账号协议过期」更根本的流程缺口：即使 Apple 403 解除，workflow 也不会自动公证。

> 修复方向（**需用户授权 + Apple 凭证，本轮未改 workflow**）：在 `macos-14` runner 导入 Developer ID Application 证书到 keychain；用 `xcrun notarytool store-credentials` 建立 keychain profile；在 workflow build job 注入 `ASTERSIGN_IDENTITY` 与 `ASTER_NOTARY_PROFILE`（作为 secrets/vars），并在 publish 前增加 `spctl --assess` 的硬断言。任何改 workflow 的动作都属于发布配置变更，必须单独授权。

### 0.4 不要创建长期 `release/*` 分支

治理文档 §分支卫生（第 94–102 行）：「禁止把 `release/*` 当作第二个长期集成线」「已完成发布的 `release/*` 分支在版本化 tag 与 Release 就绪后删除」。所以上一轮我建议的「为子模块 `bedc30698` 建 release 分支以保证可达」**不合规范**，予以纠正。

正确做法：子模块 detached HEAD 的可达性通过**推送该 SHA 到远程目标分支**（或在推送父仓前显式 `git push <studio-remote> bedc30698:refs/heads/<target>`）解决，由 tag / 父仓 gitlink 保留提交，不留长期分支。

---

## 1. 治理条款 → 当前状态映射

| 条款 | 要求 | 当前状态 | 证据 / 验收命令 | 责任方 |
|---|---|---|---|---|
| §标签与 Latest L7-21 | 桌面用 `vX.Y.Z`；`desktop-stable` 用 `--latest=false`；禁字面 `latest` tag | ✅ 已固化 | `release-aster-desktop.yml:143-147`；`tests/release_governance.py` | CI |
| §保留与清理 L23-34 | 版本化 Release 仅保留当前 + 上一版 | ⚠️ 远程状态未验证 | `gh release list --json tagName,isLatest`；`gh release view desktop-stable --json assets` | GitHub / 用户 |
| §构建边界 L38 | 固定工具链 + 锁文件 | ✅ PASS | `cargo metadata --locked` EXIT=0 | 本机已完成 |
| §构建边界 L39-41 | CLI pair / 麒麟通道 | ✅ CI 契约存在 | `ci.yml` CLI pair delivery；`tests/kylin_input_method.py` | CI |
| §构建边界 L42 | 桌面由 `release-aster-desktop.yml` 构建并更新 `desktop-stable` | ✅ workflow 存在 | `release-aster-desktop.yml:107-149` | CI |
| §构建边界 **L44** | **不得从未提交修改 / 未完成平台验证的工作树发布；发布记录可定位准确提交** | ⚠️ 前半 ✅、后半 ❌ | 工作树 0 dirty；G06 `ahead=3`、G10/G11 UNVERIFIABLE | 用户 / macOS |
| §CLI 发布顺序 L54-61 | 构建 → 草稿检查 → 版本化 tag → channel | ✅ 契约存在 | `release-aster-cli.yml` preflight + channel workflow | CI |
| §桌面发布顺序 **L80** | 签名、公证、平台验证 | ❌ **FAIL（新发现）** | workflow 未注入公证凭证，见 §0.3 | macOS / Apple |
| §桌面发布顺序 L81 | 发布版本化 `vX.Y.Z` 并标记仓库 Latest | ⚠️ workflow 只传 `desktop-stable` | `gh release view v0.2.4`；需确认由哪一步创建版本化 Release | GitHub / 用户 |
| §桌面发布顺序 L82 | `desktop-stable/desktop-latest.json` 指向新版本 | ✅ workflow 有 regression refusal | `release-aster-desktop.yml:119-131` + `desktop_release_manifest.py` | CI |
| §桌面发布顺序 L83 | 刷新 Latest 上的 CLI 兼容 `latest.json` | ⚠️ 需发布后验证 | `gh release download <latest-tag> --pattern latest.json` + 解析 | GitHub |
| §已发布内容修正 L87-90 | 不得移动已发布 tag / 替换已发布二进制 | ✅ 未发生 | 无 `v0.2.4` tag；线上 v0.2.3 未改动 | 用户 |
| §分支卫生 L92-102 | 禁长期 `release/*`；默认分支只有 `main` | ✅ 未创建分支 | `git branch -a`（子模块 detached HEAD 无新分支） | 用户 |
| §L104 | 主 CI 与 CLI 发布预检运行治理测试 | ✅ 已固化 | `ci.yml:70`、`release-aster-cli.yml:34` | CI |
| §运行时组件锁 L106-112 | `COMPONENTS` 与三份 lock 同步 | ✅ PASS | `tests/runtime_component_locks.py` 3/3 OK | 本机已完成 |

---

## 2. 剩余 5 项的精确诊断

| ID | 当前 | 真正根因 | 可解条件 | 验收证据 |
|---|---|---|---|---|
| **G06** | FAIL | 3 个本地提交（含 `bedc30698` 子模块 detached commit）未推送 | 用户授权推送；按 §0.4 用显式 SHA 推送子模块 | `git status -sb` 显示 `ahead 0`；`gh run list --workflow ci.yml --branch main` 绿色 |
| **G09** | UNVERIFIABLE | 本机 WSL 黑名单 + GBK；CI 契约已固化但无 run 结果 | 推送后取 CI run（ubuntu + macOS 双矩阵） | CI job `Release tag and channel governance` 日志 EXIT=0 |
| **G10** | UNVERIFIABLE | 发布目标平台 `macos-14` / Node 24.12，本机为 Windows | 在 macos-14 跑 `release-aster-desktop.yml` build job | workflow run 成功 + `Aster-darwin-aarch64-v0.2.4.zip` artifact |
| **G11** | UNVERIFIABLE | ① workflow 未注入公证凭证（§0.3）② Apple 账号协议 403 | 修 workflow 凭证 + 账号持有人接受协议；重跑 notarytool/stapler/spctl | `notarytool status Accepted`、`stapler validate OK`、`spctl accepted / Notarized Developer ID`、`.sha256` 重算 |
| **G13** | FAIL | Gate A 490 例仅 181 passed（36.9%）；目标 100% 非治理条款且理论上限 89.4% | **P0 口径裁决**（是否正式下调/挂起目标）+ P1 纳管 7 个 config + 4 条结构不可达功能需产品级开发 | 用户裁决记录 + 更新 `MATRIX.md` + gate 三元组 |

> 注意：即使 G06/G09/G10/G11 全部转绿，G13 仍需用户做 P0 口径裁决；反过来，G13 不裁决也不会被 G06 的推送自动解决。两件事互相独立。

---

## 3. 可执行发布序列（按责任方分段）

### 3.1 用户授权（本机，需明确确认后执行）

```bash
# 1) 确认待推送提交
git -C /d/code/aster log --oneline origin/main..HEAD          # 应为 3 条
git -C /d/code/aster/apps/studio rev-parse HEAD               # bedc30698…

# 2) 子模块：按 §0.4 用显式 SHA 推送到其远程目标分支（不建长期 release 分支）
#    <studio-remote> / <target-branch> 需按实际远程配置确认
git -C /d/code/aster/apps/studio remote -v
git -C /d/code/aster/apps/studio push <studio-remote> bedc30698c2ad714ae4b4bc5d43e3e602040d84f:refs/heads/<target-branch>

# 3) 父仓推送（推送前确认 CI 能按 gitlink 取到该 SHA）
git -C /d/code/aster push origin main

# 4) 复核同步状态
git -C /d/code/aster status -sb                              # 期望 ahead 0
```

> ⚠️ 以上第 2、3 步会改变远程状态，**未获授权不得执行**。WIP 仍在 `stash@{0}`，推送前请确认它不属于本次发布内容。

### 3.2 CI 侧（推送后自动触发）

```bash
# 取 CI run 结果（治理预检 + 全量契约）
gh run list --workflow ci.yml --branch main --limit 3
gh run view <run-id> --log | grep -A3 "Release tag and channel governance"
# 期望：ubuntu-latest 与 macos-latest 两个矩阵都 EXIT=0

# 本机等价只读检查（Linux/macOS 环境）
python3 tests/release_governance.py
python3 tests/runtime_component_locks.py
python3 tests/studio_land_guard.py
just studio-land-check
```

### 3.3 macOS 签名公证（发布机，需 Apple 凭证 + 协议已恢复）

```bash
# 0) 先确认 403 已解除
xcrun notarytool history --keychain-profile aster-notary

# 1) 带签名身份与公证 profile 打包（package-host.sh 会自动 notarytool + staple + spctl）
export ASTERSIGN_IDENTITY="Developer ID Application: <Team> (<ID>)"
export ASTER_NOTARY_PROFILE=aster-notary
pnpm package:host

# 2) 硬验收（任一失败即禁止发布）
codesign --verify --deep --strict <Aster.app>
xcrun stapler validate <Aster.app>
spctl --assess --type open --context context:primary-signature --verbose=2 <Aster.app>
# 期望：accepted / Notarized Developer ID
shasum -a 256 <asset>                     # staple 会改变字节，必须重算
```

> CI workflow 侧还需按 §0.3 注入这两个变量并加 `spctl` 断言，否则 CI 产物仍是 ad-hoc 未公证。此项为**发布配置变更，需单独授权**。

### 3.4 版本化 Release 与通道（GitHub，治理文档 §桌面版 81–83 步）

```bash
# 1) 触发桌面发布流程（workflow_dispatch，需 notes_en / notes_zh_cn）
gh workflow run release-aster-desktop.yml \
  -f version=0.2.4 -f defer_runtime_components=false \
  -f notes_en=<英文三段式 notes> -f notes_zh_cn=<中文三段式 notes>

# 2) 确认 desktop-stable 清单（治理 §82）
gh release download desktop-stable --pattern desktop-latest.json --output current.json --clobber
python3 -c "import json;d=json.load(open('current.json'));print(d['version'],d['assets'])"   # 期望 0.2.4
python3 scripts/desktop_release_manifest.py check --manifest current.json

# 3) 确认版本化 vX.Y.Z Release 并标记仓库 Latest（治理 §81；当前 workflow 不创建，需明确由哪一步完成）
gh release view v0.2.4 --json tagName,isLatest,assets
# 期望 isLatest=true，且资产与 SHA-256 对应本次构建

# 4) 刷新并验证 Latest 上的 CLI 兼容清单（治理 §83）
gh release download <latest-tag> --pattern latest.json --output cli-latest.json --clobber
python3 -c "import json;d=json.load(open('cli-latest.json'));print(d['tag'])"   # 必须指向 aster-cli-vX.Y.Z

# 5) 保留窗口复核（治理 §保留与清理）
gh release list --json tagName,isLatest
```

### 3.5 最终验收

```bash
python docs/evidence/studio/2026-11-14-release-readiness/release-readiness-check.py
# 期望：PASS 13 / FAIL 0 / UNVERIFIABLE 0 → READY
```

只有到这一步，且用户最后一次明确确认，才构成「符合发布规范」的发布候选。

---

## 4. 发布顺序四步验收清单（治理文档 §桌面版 80–83）

| # | 要求 | 验收证据 | 当前 |
|---|---|---|---|
| 1 | 签名、公证、平台验证 | `spctl accepted` + stapler validate + workflow build run | ❌ |
| 2 | 版本化 `v0.2.4` 安装包并标记仓库 Latest | `gh release view v0.2.4 --json isLatest` | ❌ 无该 tag |
| 3 | `desktop-stable/desktop-latest.json` 指向 0.2.4 | manifest `version` + `check` EXIT=0 | ❌ 当前 0.2.3 |
| 4 | 刷新 Latest 上 CLI 兼容 `latest.json` | 清单 `tag` 指向版本化 CLI Release | ❌ 未验证 |

---

## 5. 明确未做 / 禁止事项

- 未 push、未建 tag、未创建/上传任何 Release 资产、未触发任何 workflow、未部署网站。
- 未修改 `release-aster-desktop.yml`（公证凭证注入属发布配置变更，需授权 + Apple 凭证）。
- 未创建 `release/*` 长期分支（治理文档 §分支卫生禁止）。
- 未改 `MATRIX.md`、未替用户做 P0 口径裁决、未把 G13 从 FAIL 放宽。
- 未把 UNVERIFIABLE 包装成 PASS，未在本机 Windows 假装完成 macOS 平台验证。
- 未丢弃或合入 WIP（39 行 `reasoning_effort.rs` 仍在 `stash@{0}`）。

---

## 6. 复跑与证据

```bash
python docs/evidence/studio/2026-11-14-release-readiness/release-readiness-check.py
```

报告为本地派生产物（`.gitignore` 排除），复跑可复现。本机执行时 `wsl.exe` 被安全策略拦截的提示对应 G09，`CHECK_EXIT=1` 是门禁按设计返回，不是脚本崩溃。
