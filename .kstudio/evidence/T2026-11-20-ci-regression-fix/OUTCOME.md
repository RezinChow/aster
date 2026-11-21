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

### 8. 陈旧测试目标与 feature（run 44707705516，ubuntu+macos）
- 症状：Ubuntu `cargo check --workspace --all-targets` 之后，`aster` 的 `tui_913_real_llm` 测试编译失败：`tui_read` 未解析；该文件 `#![cfg(target_os = "macos")]`，Linux 上是空模块，但调用点未门控。macOS "Check optional harness contracts" 失败：`aster-core` 已无 `advanced-harness` feature（仅剩 `deep-live`，并有替代口径 `ci-all = ["full"]`）。
- 修复：
  - `apps/aster/tests/tui_913_real_llm.rs`：`mod tui_read` 和唯一使用它的 `real_llm_tui_turn_shows_assistant_text`（ignore 文案本就写明 macOS pager gate）都加 `#[cfg(target_os = "macos")]`；Linux 不再编译 macOS-only 测试，macOS 行为不变。
  - `.github/workflows/ci.yml`：可选契约检查改为 `--features ci-all,deep-live`（Cargo.toml 注释推荐 `ci-all` 代替 `--all-features` / 过时 feature）。
- 验证：`cargo fmt --all -- --check` 0 差异、YAML 解析 OK、`cargo check --locked -p aster --test tui_913_real_llm` EXIT=0、`cargo check --locked -p aster-core --features ci-all,deep-live` EXIT=0。
- 注：改 `apps/aster` 测试文件会改变 CLI pair 的 BUILD_ID（哈希覆盖整个 `apps/aster`），但 CI 的 pair identity 测试用 fixture 源动态算 digest，无 golden 常量；本地未跑 `cargo build`，默认产物未被覆盖。

### 9. Desktop identity 构建缺 document 资源（run 44714192342）
- 症状：Ubuntu `check` 的 "Build and test the desktop product identity" 中 tauri-build 失败：`resource path .../target/debug/studio-resources/document doesn't exist`。
- 根因：CI 手写复制了 `justfile` 的 Studio 构建流程，但漏掉 `python3 apps/studio/scripts/document_assets.py "$CARGO_TARGET_DIR/debug/studio-resources/document"`；`tauri-config --target-dir` 会声明该映射，非 deferred 构建必须先 stage。
- 修复迭代：
  1. 先按 `justfile` 补 `document_assets.py` staging；本地 /tmp 实测 EXIT=0（16 MiB）。
  2. run 44720302123 的 Ubuntu 暴露新依赖：CI checkout 没有 `packages/office/node_modules/@embedpdf/fonts-sc/fonts/NotoSansHans-Regular.otf`（未跟踪），脚本在 `digest(font)` 处 `FileNotFoundError`。该字体只存在于本地 node_modules。
  3. 最终改为 `mkdir -p "$target_dir/debug/studio-resources/document"`——tauri-build 只校验映射目录存在；真实 PDFIUM/字体资产由 release packaging 的 `document_assets.py` 负责，CI 门禁不装 node_modules。保留完整资源映射，不用 `ASTER_DEFER_RUNTIME_COMPONENTS=1` 缩减覆盖。
- 注：`crates/oci-runtime` 已不存在，`sandbox_assets_expected()` 为 false，macOS 也不会顺带 stage document，故两侧都需要这一步。

### 10. Studio tenant 测试的 legacy 遗留（run 44727782165）
- 症状：Ubuntu "Build and test the desktop product identity" 的 `tenant::` 测试 11 passed / 4 failed：
  - `default_aster_identity_is_closed_and_the_compiled_product_is_authoritative`：`HostIdentity::parse("legacy")` 变成 unknown released tenant。
  - `default_aster_preserves_the_published_legacy_bundle_id`：`bundle_identifier("legacy")` 已不是 `dev.aster.studio`。
  - `side_instances_keep_the_released_tenant_brand_and_assets` / `loads_the_selected_tenant_files`：`load_slug("legacy")` 因 tenant 目录已删而 NotFound。
- 根因：单 tenant 化后遗留断言（与 Kylin/flatpak 同类）。
- 修复（Studio 子模块）：4 处断言改为 aster 口径——删除 legacy released tenant 行、bundle id 测试只断言 aster、`load_slug` 改 aster；并把 `selected_development_slug(Some("aster"))` 从非法列表移除（现在编译 tenant 就是 aster，它合法）。
- 验证：本地 `cargo test --locked -p aster-studio --lib --no-default-features --features tenant-aster tenant:: -- --test-threads=1` **16 passed / 0 failed**（首轮暴露第 5 个断言，修正后复跑全绿）；fmt 0 差异。

### 11. Codex effort 能力校验与 provider 测试（run 44735587567）
- 症状：Ubuntu `providers::` 组 97 passed / 6 failed（5 个 codex accounted text + 1 个 gateway metadata），本地同命令可稳定复现，非网络抖动。
- 根因链（用临时错误链诊断得到，诊断代码已回滚）：
  - 真实错误是 `NonRetryableLlmError { message: "reasoning controls are unknown for this model" }`，`probe_error` 找不到 typed status 时统一兜底成 502，掩盖了原因。
  - `generate_accounted()` 把用户选择的 `none` 改写成 `minimal`，但 source-owned reasoning 目录对 Codex 模型登记的是 `none`（如 gpt-5.4），`minimal` 不在任何 Codex 能力集 → 请求前就被拒绝。
  - 测试 fixture 用未登记的 `gpt-test`，进一步导致能力为 None。
  - `api_model_metadata...` 仍把 AnthropicMessages 发给 openai 模型，现在被 `protocol_incompatible` 正确拒绝。
- 修复（Studio）：
  - 生产：`generate_accounted()` 直接传递 canonical effort，不再把 `none`→`minimal`。
  - 测试 fixture：`prepared()`/输入模型改 `gpt-5.4`，断言 wire effort 为 `none`；gateway metadata 用例改用兼容的 OpenaiChat。
- 验证：本地 `cargo test --locked -p aster-studio --lib --no-default-features --features tenant-aster providers:: -- --test-threads=1` **103 passed / 0 failed / 1 ignored**；fmt 0 差异。中途自引入一处 `calls[0].1["model"]` 断言仍写 gpt-test，已修正并复跑。

### 12. Windows portable tests 的 Cursor 状态库平台分支（run 44750505720）
- 症状：`Core/ACP portable tests (windows-latest)` 在 `Test loop convergence and replay` 失败；`cargo test --locked -p aster-acp --lib permission_denial_closes_each_tool_row_once` 编译时报 `error[E0423]: expected value, found built-in attribute 'path'`（`crates/code/acp/src/cursor_account.rs:402`）。同 run 的 Ubuntu、macOS Core/ACP 测试和 Cross-platform text 均成功。
- 根因：提交 `4ab8a452f` 为 Linux 引入 `xdg_config_home()` 时，把 `let path` 分别挂在 `#[cfg(target_os = "macos")]` / `#[cfg(target_os = "linux")]`，但 `#[cfg(not(any(...)))]` 分支只有 `return None;`。公共尾部 `path.is_file().then_some(path)` 在 Windows 仍参与编译，Windows 下没有名为 `path` 的变量，编译器把 `path` 解析成内置 attribute。
- 修复：把三个平台分支都改成各自包含返回值的 cfg block；macOS/Linux 返回文件存在性判断，其它平台直接 `None`。
- 验证：`cargo fmt -p aster-acp -- --check` 与 `git diff --check` 均 0 差异；macOS 宿主 `CARGO_TARGET_DIR=/tmp/aster-acp-host-check cargo check --locked -p aster-acp --lib` EXIT=0；Windows GNU 交叉 `CC_x86_64_pc_windows_gnu="zig cc -target x86_64-windows-gnu" ... cargo check --locked -p aster-acp --lib --target x86_64-pc-windows-gnu` EXIT=0。Windows MSVC 目标在本地因 macOS 缺 CRT 头文件（`assert.h`）无法完成，CI Windows job 是最终 gate。
- CI 复验：44756558617 的 `Core/ACP portable tests (windows-latest)` 整组 success，关键步骤 `Test loop convergence and replay` 由 ProductMismatch 失败转为 success。

### 13. delivery manifest fixture 的 legacy tenant 遗留（run 44756558173）
- 症状：Rust `check (ubuntu-latest)` 在 `Build product and companion` 的 `cargo test -p aster-studio --lib ... app_updater::` 失败，5 个 `app_updater::delivery_manifest::tests` 报 `ProductMismatch` / 断言失败；同 run 的 `Qualify aster` 三平台全绿，说明不是通用 ACP tenant 问题。
- 根因：`apps/studio/src-tauri/src/app_updater/delivery_manifest_tests.rs` 的 fixture 仍写 `tenant: "legacy"`、`tenant/legacy/*` 资源路径与 `product: Legacy`。单 tenant 化后 `HostIdentity::parse("legacy")` 失败，`validate()` 在校验任何内容前就返回 `ProductMismatch`。
- 修复：fixture 整体改 aster 口径——tenant `aster`、资源路径 `tenant/aster/*`、INFO product `Aster`；原本“合法信息被改写为不匹配”的用例改为 `product: Aster → Legacy`；非法 tenant 用例改 `aster-cua`。
- 验证：`cargo fmt -p aster-studio -- --check` 0 差异；本地 `app_updater::` **45 passed / 0 failed**（其中 `delivery_manifest::tests` 15/15），`bundled_skills::` 0 tests / 0 failed。首次本地复跑受 macOS SwiftPM `sandbox-exec: sandbox_apply: Operation not permitted` 阻塞，使用既有 `/tmp/aster-swift-nosandbox/swift` 包装器后通过；这是本地环境限制，CI 不受影响。

### 14. CLI update 测试用 shell fixture 触发 glibc 基线门禁（run 44768812278）
- 症状：Rust `check (ubuntu-latest)` 在 `Product and runtime tests` 的 `cargo test -p aster --test cli_update` 失败，6 个 `shipped_update_*` 用例都在 `apps/aster/tests/cli_update.rs:131` 报 `package-aster-cli.sh failed`；其它 workspace 检查与全部 Qualify 任务均通过。
- 根因：`package()` 用 shell script 夹具模拟 `aster`/`aster-acp` 并调用 release 打包脚本；Linux 分支会执行 `check-glibc-symbols.py --max 2.31`，而 `readelf` 无法读取 shell script（本地用 `--readelf /usr/bin/false` 复现为 exit 2）。此前多轮 CI 都在更早步骤失败，这层直到本轮才暴露。
- 修复：`package-aster-cli.sh` 新增仅测试可显式设置的 `ASTER_CLI_PACKAGE_SKIP_GLIBC=1`；release 流程不设置，glibc 2.31 基线仍是强制门禁。`cli_update.rs` 的 fixture 打包显式设置该变量，并把 `status()` 改为 `output()`，失败时输出脚本 stdout/stderr，避免再次只看到裸 `failed`。
- 验证：`bash -n scripts/package-aster-cli.sh`、`cargo fmt --all -- --check`、`git diff --check` 均 0 差异；本地 `cargo test --locked -p aster --test cli_update -- --test-threads=1` **10 passed / 0 failed**。CLI 打包相关 Python 测试 59 项中 54 passed / 5 failed；5 项失败均为 WorkBuddy 本机 FS shim 的 `file rollback is not tracked for these tar options` / `rmdir ... Operation not permitted`，与本次改动无关。

### 15. Studio native contracts 缺 Node 依赖与 product 大小写断言（run 44777531891）
- 症状：Rust `check (ubuntu-latest)` 到 `Studio native contracts` 时，`aster-studio-desktop-contract` 的 3 个 `native_boot_scripts_*` 用例失败：`Error: Cannot find module 'jsdom'`。此前多轮 CI 都在更早步骤失败，这层直到本轮才暴露。
- 第二层潜在缺陷：本机已有 jsdom 时复跑，12 个用例中仍有 1 个失败——`tests/helpers/nativeBootScripts.cjs` 断言 `dataset.asterProduct === 'legacy'`，但 contract fixture 传给 `boot_initialization_script`/`main_renderer_resume_script` 的 product 是 `Legacy`。
- 修复：
  - Studio helper 的 product 断言改为 `Legacy`（tenant 断言仍为 `legacy`，与 fixture 参数一致）。
  - check job 在 `Studio native contracts` 前加 `actions/setup-node` + `pnpm install --frozen-lockfile`（`working-directory: apps/studio`），与 `desktop-frontend` job 使用同一 Node/pnpm 版本。
- 验证：CI YAML 解析 OK、`git diff --check` 0；本地 `cargo test --locked -p aster-studio-desktop-contract --lib -- --test-threads=1` **12 passed / 0 failed**。

### 16. Linux 的 chrome 期望硬编码（run 44791594953）
- 症状：run 44791594953 的 `Qualify aster` 三平台全绿、`Cross-platform text` 全绿、Rust 的 Static ACP / desktop-frontend / check(macos) 也推进正常；`check (ubuntu-latest)` 在补装 Node 依赖后越过 jsdom，`Studio native contracts` 仍剩 1 个失败：`native_boot_scripts_keep_runtime_on_trusted_documents`。日志显示 `http://127.0.0.1:9/` 处 `AssertionError`：actual `overlay` / expected `native`。
- 根因：`tests/helpers/nativeBootScripts.cjs` 把 `chrome` 期望写成 `platform === 'darwin' ? 'overlay' : 'native'`。生产代码里 Windows 恒为 `native`，macOS 恒为 `overlay`，Linux 则只有 `ASTER_SYSTEM_TITLE_BAR=1` 时才是 `native`，默认是无边框 `overlay`。本地 macOS 用例两个分支都是 `overlay`，所以 12/12 一直通过；Linux CI 首次跑到这一步才暴露。
- 修复：Rust contract 输入新增 `systemTitleBar: host_family::keeps_system_frame()`，helper 按 `win32 || (linux && systemTitleBar)` 计算期望值；与生成脚本共用同一个 `keeps_system_frame()` 判定源，不是复制环境判断。
- 验证：`cargo fmt --all -- --check`、`git diff --check` 0 差异；本地默认与 `ASTER_SYSTEM_TITLE_BAR=1` 两轮 `cargo test --locked -p aster-studio-desktop-contract --lib -- --test-threads=1` 均 **12 passed / 0 failed**。Linux 分支由下一轮 CI 最终确认；run 44802458866 已越过 native contracts，本项修复生效。

### 17. ACP integration 的并行写门禁用例时序竞态（run 44802458866）
- 症状：Linux chrome 修复后，run 44802458866 与 44815861478 的 `check (ubuntu-latest)` 都推进到 `ACP integration`，`v912_seam.rs` 的 `v912_readonly_git_parallel_commit_opens_the_gate` 均返回 `Ok(_)`，断言 "a foreign concurrent write must open the completion gate" 失败；同 run 其它 9 个用例通过。
- 根因（经 Linux 容器复现与插桩确认）：ACP 的 completion gate 依据 `MutationLedger`，而 ledger 中这条路径来自 bash 工具对 `changed_paths` 的 before/after 快照（`tools/builtin/bash.rs::span.finish`），不是 `RunWatch::baseline_changes`（那是 loop_runtime 路径）。旧用例用固定 `sleep(300ms)` 让外部提交撞进 turn：负载高时写入发生在 bash 工具启动**之前**，工具的 before 快照已包含 guest.txt，于是没有 changed_paths、ledger 为空、gate 正确地 Allow。中途试过「mock 收到请求就通知外部写」，仍早于工具快照；写文件但保持未提交也一样，都不是生产回归。
- 最终修复（仅测试）：mock 生成的只读 bash 命令第一步写一个工作区外的标记文件；外部写线程轮询到该标记后才落盘 guest.txt，保证写入发生在工具 before 快照之后、结束后才被记为未发布变更。bash 改为等文件存在而非等 `HEAD:guest.txt`；gate 断言完成后再 `git add/commit` 满足最终 `cat-file` 校验。
- 验证：`cargo fmt --all -- --check`、`git diff --check` 0 差异；用已有 `aster-followup-tests:1.97.1-arm64` 镜像在 Linux 容器复现旧失败（gate 日志 `DECIDE empty=true`）并验证新逻辑：单跑 1/1 PASS，连续 10 次全 PASS，完整 `v912_seam` 10 passed / 1 ignored。macOS 宿主受 WorkBuddy `sandbox-exec` 限制不能端到端跑该用例，Linux 容器与 CI 才是等价环境。

### 18. Qualify aster 的 macOS reasoning 用例瞬时超时（run 44802458957）
- 症状：同一提交的 `Qualify aster` 在 run 44791595251 三平台全绿；run 44802458957 的 `Core/ACP tests (macos-latest)` 在 `shipped_tui_e2e.rs::reasoning::delayed_catalog_keeps_draft_and_explicit_effort` 报 `timed out waiting for "slow/gpt (none)"`，其余 25 个用例通过，Ubuntu/Windows job 均成功。
- 判断与复验：本轮未改 CLI reasoning 路径；本地连续 3 次单跑该用例均 **1 passed / 0 failed**（6.2–6.5 s），上一轮同代码 CI 也全绿。属于 27 个 TUI 用例并行时的偶发等待超时，未改代码；run 44815861584 同提交的 `Core/ACP tests (macos-latest)` 已 success，确认偶发。

### 19. 最新一轮剩余失败（run 44831476902 / 44831477104）
- `check (ubuntu-latest)` 的 `ACP integration` 仍失败，但症状变了：v912 用例的 `spawn_blocking` 报 `read-only tool never signalled readiness`，说明 mock 根本没生成 READONLY-GIT 的 bash 工具调用，而不是写入时序问题。原断言在 committer 等待阶段 panic，掩盖了 `say()` 的真实响应。
- 已在测试中把 committer 改为「没收到 marker 就不写文件、不 panic」，并把 `Ok(_)` 分支的 panic 改成输出完整 `PromptResponse`，下一轮可直接看到是没有工具调用还是 gate 判定问题。Linux 容器 10/10 复验的是工具正常出现的路径；CI 特有路径仍待诊断。
- `Qualify aster` 的 macOS `reasoning::delayed_catalog_keeps_draft_and_explicit_effort` 再次 `timed out waiting for "slow/gpt (none)"`；屏幕最终状态是 `mock/gpt (none)`，两条 scrollback 为 `Switched to slow/gpt` 与 `Switched to mock/gpt (none effort)`。本地单跑 10/10 PASS，但本地按 CI 方式跑完整 `shipped_tui_e2e` 套件也复现了 PTY 用例失败（本次是另一个 `shipped_tui_launch_resume_and_visible_commands`），说明是 PTY 套件在负载下的时序敏感问题，不是单一用例可修；暂不改产品/用例逻辑，记录为已知 flake，不能宣称 CI 全绿。

### 20. CI 沙盒下的 v912 门禁与 macOS prune 进程检查（run 44842923937 / 44842924047）
- run 44842923937 的 Ubuntu `ACP integration` 仍失败，完整响应是 `EndTurn` + `modelCalls=2`。早先据此判断「mock 没生成工具调用」是误读：两次模型调用恰好对应「发起 bash 工具 → 收到工具结果 → 结束回合」。真实原因是 CI/容器 VM 中原生 ksandbox 无法运行 bash，产品默认 fail-closed，bash 命令从未执行，所以 marker 从未创建。容器 A/B 对比确认：不带沙盒开关 1/1 FAIL，带 `ASTER_ALLOW_PROCESS_HOST_SANDBOX=1` 1/1 PASS。
- 修复：v912 测试自己启动的 `aster-acp` 子进程显式设置 `ASTER_ALLOW_PROCESS_HOST_SANDBOX=1`（CI VM 本身就是外层隔离边界；产品默认安全 posture 不变），marker 继续放在 workspace 内被 gate 源路径排除的 `.aster/`。CI 等价 Linux 容器（不带任何额外 env）完整 `v912_seam` 10 passed / 1 ignored；定点用例连续 10/10 PASS。
- 同 run 的 `check (macos-latest)` 失败：`env_manager.rs:416` 报 `cannot inspect native process 7960: Input/output error (os error 5)`。根因是 macOS `KERN_PROCARGS2` 对退出中/受保护进程会返回 `EIO`，而 `process_error()` 只把 `ESRCH` 归一为可忽略错误，导致一个无关进程就能中断整条 `aster tool prune`。已把 `ESRCH`/`EIO` 都归为不可检视并加纯函数单测；本地 frozen 参考 12/12 PASS、新增单测 3/3 PASS。另 4 个 `aster-use-tool-acquire` lib 单测失败经无改动 stash 基线复跑同样失败，属既有问题，与本次改动无关。
- `Qualify aster` 的 macOS 套件继续失败，但用例从 reasoning PTY 变成 `retrieval::shipped_retrieval_stdio_executes_embedded_semantic_search`；本地单跑 10/10 PASS，本地按 CI 方式串行跑完整 `shipped_tui_e2e` 又复现 `shipped_tui_launch_resume_and_visible_commands`，失败用例随负载漂移，归为套件时序敏感。不改产品或用例断言，也不宣称 Pass。

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
| 主仓 | 7ffaa2e96 | gitlink→1cb9204f13 + 本证据第 7 项 |
| 主仓 | 21ba5695c | macOS-only TUI 测试门控 + ci-all feature + 本证据第 8 项 |
| 主仓 | e250d1572 | CI 补 document assets staging（首版） |
| 主仓 | 08d6aebb6 | CI 改为 mkdir document 空目录 + 本证据第 9 项定稿 |
| Studio | fcccc33a52 | tenant 测试改 aster 单 tenant 口径 |
| 主仓 | c09cb5596 | gitlink→fcccc33a52 + 本证据第 10 项 |
| Studio | d9663cc91c | Codex canonical effort + provider fixture 修正 |
| 主仓 | 667d1105c | gitlink→d9663cc91c + 本证据第 11 项 |
| 主仓 | 41bdc5d33 | ide_state_db 平台分支修复 + 本证据第 12 项 |
| 主仓 | 04c6f8c33 | 证据补记第 12 项 commit SHA |
| Studio | 8360624e45 | delivery manifest fixture 改 aster 单 tenant 口径 |
| 主仓 | 53044e937 | gitlink→8360624e45 + 本证据第 13 项 |
| 主仓 | 07defdb8f | CLI fixture 打包跳过 glibc 检查 + 失败诊断输出 |
| 主仓 | df0255218 | 本证据第 14 项 |
| Studio | 08ab1a982f | native boot script product 断言改 Legacy |
| 主仓 | ec5a1a603 | check job 安装 Studio Node 依赖 + gitlink→08ab1a982f + 本证据第 15 项 |
| Studio | a1a8d5d10f | native boot chrome 期望按平台与系统标题栏判定 |
| 主仓 | 84023b3e6 | gitlink→a1a8d5d10f + 本证据第 16 项 |
| 主仓 | 3bb9fb7b2 | 证据补记 84023b3e6 SHA |
| 主仓 | 716b4a8e0 | v912 并行写门禁用例第一版去时序依赖 + 本证据第 17/18 项 |
| 主仓 | c0ac15c34 | v912 改用 bash 内标记同步，Linux 容器 10/10 复验 + 证据定稿 |
| 主仓 | 1a0f7cf75 | v912 失败诊断可读化 + 证据第 19 项 |
| 主仓 | ca21e1d18 | v912 子进程 process-host 沙盒 opt-in + marker 入 `.aster`；macOS prune 忽略 EIO + 单测 |

## 验证

- `cargo fmt --all -- --check`：0 差异。
- studioDev 焦点测试：6/6 PASS。
- 全部 CI Python 测试本地预跑：11 个 unittest 模块 OK、flatpak 24/24 OK。
- ci.yml：YAML 解析 OK、抽取 run 块 `bash -n` OK、env 展开本地验证。
- `aster-acp` 双目标检查：macOS host 与 Windows GNU 交叉 `cargo check --locked -p aster-acp --lib` 均 EXIT=0。
- Studio `app_updater::` 45/45 PASS（delivery_manifest 15/15）；本地 SwiftPM 沙盒限制用既有 no-sandbox wrapper 绕过。
- CLI `cli_update` 10/10 PASS；`package-aster-cli.sh` `bash -n` 0 差异。
- `aster-studio-desktop-contract` 12/12 PASS；CI YAML 解析 OK。
- v912 门禁用例：Linux 容器 `aster-followup-tests:1.97.1-arm64` 单跑 1/1、连续 10 次全 PASS、完整套件 10 passed / 1 ignored；最终修复后在不带任何沙盒 env 的 CI 等价容器再次单跑 10/10 PASS、完整套件 10 passed / 1 ignored。
- macOS prune 进程检查：`prune::process::tests` 3/3 PASS；`env_manager` frozen 参考 12/12 PASS；`aster-use-tool-acquire --lib` 另 4 例失败已用无改动 stash 基线证明为既有失败。
- PTY/检索套件：`shipped_retrieval_stdio_executes_embedded_semantic_search` 本地单跑 10/10 PASS；完整串行 `shipped_tui_e2e` 仍会出现用例漂移式超时，未认领为稳定绿。
- CI 递进证据：44691062449（fmt+launcher 失败）→44691837701（fmt 过、musl crate 名失败）→44693615766（env 127）→44694053135（编译推进、Kylin toyou 失败）→44696464302（musl 编译通过、Kylin flatpak 失败）→44699158998（Kylin/flatpak 过、macOS zig arm64 失败）→44700973749（macOS 守卫生效、两侧 `--all-targets` 陈旧 fixture 失败）→44791594953/44791595251（Qualify aster 三平台与 Cross-platform text 全绿；Rust ubuntu 到 native contracts 剩 Linux chrome 期望失败）→44802434279/44802458866/44802458957（chrome 修复生效，ubuntu 推进到 ACP integration 暴露 v912 时序竞态；macOS Qualify 一例 TUI 等待偶发超时）→下一轮 CI 待结论。

## 边界

- 交付闭环（commit/push）≠ 产品 Pass；%≠Pass。
- musl 编译步骤是 5d2d6ad90 既有缺陷，本轮让 main CI 首次具备全绿条件；release 通道实机证据、headed/daily-use Pass 仍未认领（park）。
- `fact-log-byte-limit-fix` 等其它未跟踪证据目录非本轮产物，未触碰。
- Windows portable gate 已由 CI run 44756558617 验证全绿；44791595251 再次确认 Qualify aster 三平台全绿。delivery manifest、CLI update、desktop contract 均已本地验证；Linux chrome 期望已修并经 CI 越过该步骤。v912 用例已在 Linux 容器中按 CI 等价条件复验（不设沙盒 env），根因是 CI VM 中原生沙盒无法执行 bash；修复是测试子进程显式 opt-in process-host，产品默认仍 fail-closed。PTY/检索套件在完整串行运行下会出现用例漂移式时序失败（CI 侧 retrieval、本地侧 launch/resume），`shipped_tui_e2e` 整体不能宣称稳定绿。
