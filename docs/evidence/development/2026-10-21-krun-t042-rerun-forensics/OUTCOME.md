# krun / T0.4.2 引导失败重跑取证（2026-10-21）

| Field | Value |
| --- | --- |
| Task | specs/005 T015 取证腿（T0.4.2 runbook 首执行的环境阻塞诊断） |
| Input | runbook「Environment recon 2026-10-19」结论：剩余失败「inside the krun boot chain」 |
| Workstation | macOS/arm64（Darwin 25.6），a3s-box 3.3.0 install（`~/.local/share/a3s-box`），aster main @ 593fa9011，fork aster-ai-lab/libkrun main @ 02e1414 |

## 结论（根因定案）

2026-10-19 诊断的「krun 引导链内部失败」**不是 krun 失败**，是
**10-19 硬拷贝修复不完整导致的 dyld 加载失败**：

- 10-19 把 `a3s-box-shim` 硬拷至 `~/.a3s/bin/`（stock CLI 的
  `find_shim` 第二优先级），但该 shim 的 LC_RPATH 是
  `@executable_path/../lib` → 解析到 `~/.a3s/lib/`，而该目录不存在。
- shim 进程 dyld 解析 `@rpath/libkrun.1.17.0.dylib` 失败、立即退出，
  被 CLI 报为「VM process exited before the guest exec server became
  ready」——与 10-19 记录的措辞一致。dyld 错误原文见
  `stock-shim.stderr.log`（wrapper 截获，本目录副本）。
- 修复（工作站态，非代码）：把安装件 `~/.local/share/a3s-box/lib/`
  的 `libkrun*.dylib`/`libkrunfw*.dylib` 拷至 `~/.a3s/lib/`，
  补全硬拷贝丢失的 rpath 上下文。终验：stock 3.3.0 链对
  `deploy/dev/compose.acl` 两服务 **All converged**。

## 实验矩阵（全部 2026-10-21，同一 compose.acl、同一镜像摘要缓存）

| # | CLI | shim | libkrun | 结果 |
| --- | --- | --- | --- | --- |
| 1 | repo 3.2.7（插桩链） | repo 3.2.7 | fork 插桩（NET=1 BLK=1） | ✅ converged |
| 2 | repo 3.2.7 | repo 3.2.7 | vendored 未插桩 | ✅ converged |
| 3 | stock 3.3.0 | stock 硬拷贝 `~/.a3s/bin` | 安装件 lib | ❌ 复现 10-19 失败 |
| 4 | stock 3.3.0 | stock 硬拷贝 | repo staged lib（DYLD_LIBRARY_PATH 覆写） | ❌ 同失败（排除 libkrun） |
| 5 | repo 3.2.7 | stock 硬拷贝（repo shim 暂挪） | — | ❌ dyld 明文失败（定位 rpath 缺库，见 stderr 副本） |
| 6 | stock 3.3.0 | stock 硬拷贝 + `~/.a3s/lib` 补全 | 安装件 lib | ✅ converged（终验） |

fork 插桩全程未触发（无 `KRUN_BOOT_ABORT` 行）——与「失败不在 krun」
互证。repo 链引导时 guest init 侧启动痕（init.krun entered main →
mount_filesystems ok）见 `repo-shim.stderr.log`。

## 对 T0.4.2 三解阻塞的修订

- ~~krun 引导链~~ → **清除**（#6 绿；属工作站态修复，可复现步骤如上）。
- D-D（pinned postgres digest）→ **box 路径下不再相关**：compose 引导
  用的正是 `postgres:17-alpine@sha256:742f…2193`（box 自有 OCI 拉取/
  缓存，非 docker.io pull）。Docker fallback 的 digest 问题独立存在，
  但 T0.4.2 不再依赖该 fallback。
- D-A（本地 a3s-auth issuer 的私有 CA 准入）→ **成为唯一剩余阻塞**
  （Cloud 侧 webpki-only trust，#[cfg(test)] 例外；步骤 4–6 需要它）。
  步骤 2–3 已于 10-20 交付（成员面 e2e）。

## 附带产出

- fork 构建修复：macOS 交叉 `make` 在 init/init 链接处缺 crt/libgcc
  （Debian sysroot 的 gcc 产物不在 lld 默认搜索路径）。临时以
  `linux-sysroot/usr/lib/aarch64-linux-gnu/` 符号链接解决；Makefile
  持久修复随 fork 提交（见 fork 提交记录）。
- 上游 Box issue 素材（D-F/T027 队列）：`find_shim` 会选中脱离安装
  上下文的硬拷贝 shim，其 dyld 失败被报成 VM boot 失败——错误分类
  应区分「shim 未加载」与「VM 退出」；或 find_shim 校验 shim 可解析
  其 rpath。argv/config 捕获件（stock-shim-argv.json、
  repo-shim-argv.json）两链同形（`:copy` 目录卷、同 entrypoint 模式）。

## 复现与产物

- 引导命令：`a3s-box compose --file apps/cloud/deploy/dev/compose.acl
  up --detach --timeout 120`（run_cloud.sh 同源）。
- repo 插桩链构建：crates/box 以 `Cargo.toml.box-workspace` 临时激活 +
  根 workspace 表镜像拼接种 + `A3S_USE_SYSTEM_LIBKRUN=1` +
  `PKG_CONFIG_PATH` 指 fork target/release/pkgconfig（文档化逃生口；
  未提交任何构建面改动，临时清单已撤）。
- 产物：本目录 4 个捕获件；fork 侧 Makefile 修复提交。

## 显式不声明

- T0.4.2 e2e **未执行**：步骤 1、4–6 仍卡 D-A（私有 CA 准入决策）。
- 不声称 stock 3.3.0 install 在其他工作站可用；本修复仅覆盖
  「shim 硬拷至 ~/.a3s/bin」这一已知工作站形态。
- stock 3.3.0 的失败 box 清理仍无保留日志（T022 仅存在于本树构建）。
- 用户在跑的 3 个 box 全程未受影响（实验前后进程集合一致）。
