# T2026-11-20-ci-regression-fix

Date: 2026-11-20. Scope: named `/k-yolo` slice — 交付后 CI 验证闭环。
Trigger: 上一轮 H2 交付（commit/push）后，main CI 暴露三处失败，逐一诊断并修复。

## 因果链

`/k-yolo` sense：审计 high 缺口已全关、L3 正常，唯一 gap 已由 H2 交付闭环关闭。
推送后检查 main CI（44691062449）发现失败 → 新的、unblocked、可复跑的 productive slice：让交付代码在 CI 上真实通过。

## 三处失败与修复

### 1. Rust 格式（check ubuntu/macos → Format）
- 症状：`cargo fmt --all -- --check` exit 1，257 处差异 / 89 个 .rs 文件（code/core、code/acp、effect），来自 925f196fb 提交的 crates 源码未 fmt。
- 修复：`cargo fmt --all` 全量应用。`cargo fmt --all -- --check` 复验 0 差异。
- 注：89 个文件中 80 个在 925f196fb 内，9 个是历史遗留未 fmt 文件——CI 要求全 workspace 格式正确，这 9 个也必须 fmt 才能过门禁，非越界。

### 2. Studio launcher 契约（desktop-frontend → Studio launcher contracts）
- 症状：`scripts/__tests__/studioDev.test.ts` 2 失败（expected 4318 to be 4319；expected 'reuse' to be 'tenant-mismatch'）。
- 根因：tenant 迁移（87ed6624d1，单 tenant = aster）遗留的错误断言——期望 `rendererPort('aster')` 两次调用返回不同端口，期望相同 aster/aster 输入产生 tenant-mismatch。均不可能成立。
- 修复：断言改为匹配单 tenant 现实——端口固定 4318 + 显式端口覆盖；tenant-mismatch 用 `servedTenant: 'other'`。焦点测试 6/6 通过。Studio 推送 fe812121ca。

### 3. 静态 musl ACP 编译（check ubuntu/macos → Compile current static guest agents）
- 症状：exit 101。
- 根因（5d2d6ad90 引入，非本轮改动）：CI step 编译不存在的 crate `aster-oci-agent`（git 全历史无此 crate），且用 rust-lld 链接——证据 `2026-11-20-acp-musl-static` 明确记录 rust-lld 失败于 `-lstdc++` / 重复 CRT，正确方案是 zig 0.16.0。
- 修复：step 重写为 release-code.yml 已验证的 zig 方案（pin + SHA + CC/CXX/LINKER/RUSTFLAGS），构建真实 `aster-acp` bin，双 musl target 覆盖。bash -n + YAML 解析通过。

### 4. 静态编译步骤的三层迭代（均在 5d2d6ad90 既有缺陷上）
- 该 CI step 在 5d2d6ad90 引入时就是错的（main CI 此后一直红），非本轮交付改动造成。逐层修：
  1. crate 名 `aster-oci-agent`→`aster-acp`（该 crate 全 git 历史不存在）。
  2. rust-lld→zig 0.16.0 方案（证据明确 rust-lld 失败于 `-lstdc++`/重复 CRT）。首轮 `NAME='value with spaces'` 前缀赋值被 bash 当成命令名（exit 127）→改用 `env 'NAME=value with spaces'` 并本地验证展开。
  3. 双 target 交叉编译在 CI 上 warning 刷屏、进度停滞→收窄为 x86_64（证据：regular CI gate 只 build x86_64，aarch64 由 release matrix 覆盖）+ 抑制 zig libc++ nullability warning。
- 结果：44696464302 run 中 "Compile current static ACP binaries" **通过**，CI 推进到后续 step 才暴露下一处遗留。

### 5. Kylin tenant/OCR 测试遗留（check → Kylin input method launcher）
- 症状：`ValueError: unsupported product tenant: toyou`（tests/kylin_input_method.py:179）与 flatpak test_delivery.py 的 `MODEL` ImportError / `toyou`/OCR 陈旧断言。
- 根因：tenant 单 tenant 化（87ed6624d1）+ document-assets v2（PDFIUM，无 MODEL/OCR）后测试 fixture 未同步。
- 修复：
  - `tests/kylin_input_method.py`：只测 `aster`（11 tests OK）。
  - `apps/studio/scripts/kylin-flatpak/test_delivery.py`：用 importlib 从上级目录加载 document_assets；`MODEL`→`PDFIUM[("linux","x64")][2]`；manifest 补 v2 `schema` 字段；删除两个测已移除功能的陈旧测试（legacy tenant 桌面身份、OCR 权重 receipt）。24/24 OK。

### 6. macOS check 平台回归（最终 run 44699158998）
- 症状：`check (macos-latest)` 在 "Compile current static ACP binaries" 以 exit 1 失败：`unsupported Zig host: arm64`。
- 根因：本轮第 3/4 项把原本平台无关的 rust-lld 编译步骤替换成 Linux-only 的 zig 0.16.0 下载方案，但 `check` job 是 `ubuntu-latest` + `macos-latest` 矩阵；macOS runner 的 `uname -m` 是 `arm64`，不在 `x86_64|aarch64` 分支内。Linux 专用 `acp-musl` job 已独立覆盖同一编译 + `acp_musl.py` 验证 + wire conformance。
- 修复：给该 step 加 `if: runner.os == 'Linux'`，macOS 跳过；静态编译仍由 `acp-musl` job 与 Linux 矩阵门禁保证。YAML 解析验证 step `if` 生效；`git diff --check` 0 差异。

### 7. `--all-targets` 陈旧 fixture / dev-dependency（run 44700973749，ubuntu+macos）
- 症状：两侧 `check` 均在 `cargo check --locked --workspace --all-targets` 失败（5 errors each）。唯一集合：
  - `capabilities_aix_tests.rs:899` 编译期读取 `apps/api/vendor/web/public/cases/acp-cloud-agent.aix`（仓库/HEAD 均无此文件）。
  - `capabilities.rs:3983` 编译期读取 `use-registry/packages/review/aster-use-extension.acl`（已迁到 `apps/use-registry/packages/*`；HEAD 无旧路径）。
  - `local_documents/library_tests.rs:190/194` 两个 OCR evidence fixture（ignored 测试仍做了编译期 include）。
  - `code_cli_launch_tests.rs:20` macOS-only ignored 测试读取已不存在的 e2e fixture。
  - Linux 额外：`runtime_components_cache_tests.rs` 用 `ring`，但 `ring` 只在 macOS target dependencies。
- 根因：外部 checkout 中的旧 fixture 路径被写死在编译期宏里；`ring` 依赖没有 dev 口径。非本轮交付引入。
- 修复（Studio 子模块，最小且保持断言）：
  - acp-cloud 测试：从仓库内已跟踪 `tests/fixtures/aix/acp-cloud-agent/` 在运行时拼出等价 zip（`agent.mjs`→`agent/acp-agent.mjs`），保留 AIX 安装准入 + 双轮 ACP 流式断言。
  - review ACL：include 改指向已跟踪 `artifacts/official-writing/review-package-1.3.0/aster-use-extension.acl`（surfaces 与断言一致）。
  - 两个 ignored 测试：编译期 include 改运行时 `fs::read`，语义不变（本来就需要显式外部资源）。
  - `Cargo.toml`：把 `ring` 加进 `[dev-dependencies]`，保留 macOS target 生产依赖。
- 验证：`cargo fmt --all -- --check` 0 差异、`git diff --check` 0 差异、`cargo check -p aster-studio --all-targets` EXIT=0（18m57s，Cargo.lock 无变化）；两处受影响测试单跑通过（review plugin install 1/1；acp-cloud 双轮 ACP 1/1）。运行时路径基准必须是 `CARGO_MANIFEST_DIR`（= src-tauri）上一层，不是源码 include 的两层——首次写错已修正并复跑通过。

## 提交

| 仓库 | commit | 内容 |
| --- | --- | --- |
| Studio | fe812121ca | launcher 契约断言修正 |
| 主仓 | f9034af32 | cargo fmt + studio gitlink→fe812121ca |
| 主仓 | 6d405d11a→65bd40c80→0090d7e48 | ci.yml 静态编译三步修正（crate/env/单 target+warning） |
| 主仓 | 7fd86a273 | Kylin input method tenant 修正 |
| Studio | b621f191ff | flatpak delivery fixture v2 同步 |
| 主仓 | 073bf3171 | gitlink→b621f191ff + 本证据初稿 |
| 主仓 | c2ed67976 | macOS check 静态编译步骤 runner 守卫 + 本证据第 6 项 |
| Studio | 1cb9204f13 | 陈旧 fixture / ring dev-dep 修复（5 文件） |
| 主仓 | (本轮) | gitlink→1cb9204f13 + 本证据第 7 项 |

## 验证

- `cargo fmt --all -- --check`：0 差异。
- studioDev 焦点测试：6/6 PASS。
- 全部 CI Python 测试本地预跑：11 个 unittest 模块 OK、flatpak 24/24 OK。
- ci.yml：YAML 解析 OK、抽取 run 块 `bash -n` OK、env 展开本地验证。
- CI 递进证据：44691062449（fmt+launcher 失败）→44691837701（fmt 过、musl crate 名失败）→44693615766（env 127）→44694053135（编译推进、Kylin toyou 失败）→44696464302（musl 编译通过、Kylin flatpak 失败）→44699158998（Kylin/flatpak 过、macOS zig arm64 失败）→44700973749（macOS 守卫生效、两侧 `--all-targets` 陈旧 fixture 失败）→最终 run（见下）。

## 边界

- 交付闭环（commit/push）≠ 产品 Pass；%≠Pass。
- musl 编译步骤是 5d2d6ad90 既有缺陷，本轮让 main CI 首次具备全绿条件；release 通道实机证据、headed/daily-use Pass 仍未认领（park）。
- `fact-log-byte-limit-fix` 等其它未跟踪证据目录非本轮产物，未触碰。
