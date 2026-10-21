AsterDream Windows x64 **v0.1.1 已发布并通过下载回验**。沿用现有 [aster v0.1.1 Release](https://github.com/aster-ai-lab/aster/releases/tag/v0.1.1)，本次补充两个统一命名的资产，保留原有 macOS、麒麟资产及其摘要；没有修改自动更新 feed、推送源码或移动标签。

- [aster_0.1.1_x64-setup.exe](https://github.com/aster-ai-lab/aster/releases/download/v0.1.1/aster_0.1.1_x64-setup.exe)：27,398,910 字节。
- [aster_0.1.1_x64-setup.exe.sha256](https://github.com/aster-ai-lab/aster/releases/download/v0.1.1/aster_0.1.1_x64-setup.exe.sha256)。

```text
0e6602c78e0de6334b7baa2befbec024210ac584246aff0adaa4c04342d321af  aster_0.1.1_x64-setup.exe
```

安装器和实际包内主程序的 File/ProductVersion 均为 `0.1.1.0`；前端内嵌版本为 `0.1.1`，应用身份继续使用 AsterDream / `aster-dream` / `dev.a3s.studio`。[安装器校验](installer-verification.json)、[GitHub 元数据及实际下载字节回验](release-published-verification.json)和[发布说明](release-notes.md)保存最终结果。

| 验证 | 结果 |
| --- | --- |
| 固定工具链、冻结依赖、完整构建 | Rust 1.97.1；离线冻结前端依赖、ACP/Office release、Office WASM/Rslib、remote protocol/transport、renderer、字体子集、Windows NSIS 共 8 步全部退出 0。[构建记录](build-status.json)。 |
| 包内原生组件 | Host、ACP、Office 均为 x64。ACP `9.1.4` 和 Office `0.45.0` 的字节摘要与同次 release 构建完全一致，`--version` 均退出 0。保留上游包版本，不将它们误改为产品版本。[校验记录](smoke-verification.json)。 |
| Tauri 主程序标记 | 包内 Host 为 `fd4393e5e998067949780d1382b75510e5345f8797c5481204558aa4011e58bf`；构建目录 Host 为 `ca1db770a334503b620309165377b966bcc07f8282031c4df74283752c86ce4a`。仅唯一 27 字节 Tauri token 末尾 `UNK → NSS` 三字节不同，其余全文件一致；官方同版本 bundler 明确写入并还原该标记。[独立只读核对](nsis-marker-independent-audit.json)。 |
| 隔离启动 | 启动实际解包 Host，使用全新 APPDATA/LOCALAPPDATA 和独立实例 `win-v011-smoke`；日志显示 `AsterDream 0.1.1 (741eadf3)`，空账号登录页正常可见。[无账号截图](smoke-window.png)、[UIA 快照](smoke-window.json)。未使用指针输入，未复制用户会话或凭据；测试进程随后正常关闭。[清理记录](smoke-cleanup.json)。 |
| 内部依赖与工作区 | `tests/workspace_dependencies.py` 六个精确方法 6/6 PASS；原仓库与暂存区内部依赖/不可发布违规项均清零。[逐项记录](workspace-dependencies-summary.json)、[依赖清单](dependency-locality-inventory-r3.json)。 |
| Rust 格式 | 全部 1,070 个 target、162 个等价分批检查最终 PASS。原 `cargo fmt --all -- --check` 受 Windows OS206 限制未完成，未将等价覆盖冒充原命令成功。[范围与重试记录](fmt-check.batched-r2.json)。 |
| Gateway wire | `cargo check --locked -p a3s-gateway --features wire` 退出 0，确认 ACL、Sentry、Updater 本地路径可编译；不声称 wire 运行时测试通过。[记录](gateway-wire-check.json)。 |
| GitHub 发布 | 远端两个新增资产的大小、摘要与重新下载的完整字节均和本地一致；发布正文与准备的文本一致，原有平台资产保持不变。[最终回验](release-published-verification.json)。 |

Windows 安装器 **未做 Authenticode 签名**。[签名状态](authenticode.json)。本次验证包括解包和首次登录页启动，**没有执行安装器安装、覆盖旧版升级、登录后的完整 UI 回归或重新运行模型任务**。包内 OEM 搜索/文档解析默认凭据为空。验证期间出现的主程序摘要差异及一次 GitHub 只读网络超时均已核清并保留[历史说明](verification-history.json)，安装器冻结后未重建或修改。

源码基线为根仓库 `741eadf399f89993ec7966e959be6f21647537cb`、Work `9aad91f1e934c731e540cf99be25733e25c3a411`。初始快照纳入根仓库 11 项、Work 3 项既有 tracked 修改，因此不是 clean checkout 构建。没有复制 untracked 遗留目录、环境文件、账号或会话。原 Work 当前版本 `0.1.2` 保留；仅隔离副本的 package.json、Tauri 配置、Cargo 包版本及对应锁文件项统一为 `0.1.1`。

本轮补齐 Gateway、Sentry、Updater 的 `publish=false`，将 Gateway 的三项 A3S 依赖改为本地 path，保留原版本约束；仅移除对应 registry 锁记录。原仓库和副本同步把过时 `toyou/INFO.md` 资产检查迁移到当前 `tenant.rs` 实际嵌入的 aliases JSON 和 logo。[资产检查变更](workspace-dependencies-assets.overlay.json)。另仅在副本两处 OKF 文件应用三处格式换行，原文件保留。[格式变更](fmt-check.overlay.json)。

最终源文件清单沿用初始同一组 **28,052 个路径**，聚合 SHA-256 为 `9821d6da0c4bd1712546dbbe6c0dcca68a16d50a5d5247958e0075b2ae314cc5`；相对初始归档只有已披露的 7 个后续源文件差异。[最终来源与逐项差异](source-stage-final.json)、[初始来源](source-provenance-before.json)、[初始版本同步](source-stage.json)。完整逐文件哈希和原始构建/检查日志保留在本地 `target/packaging/aster-0.1.1-windows`；这里保存小型验收证据与公开截图，未复制私有运行日志。

此前 [T01 / DeepSeek Flash / Windows CUA 评测](../../studio/2026-10-20-t01-deepseek-flash-windows-cua/OUTCOME.md)已完成收尾：公开完整结果正确，本地独立场景 8/9，唯一失败为负零格式，模型提交未改写。它使用评测时的 debug 二进制并包含已披露的环境恢复与续行，不作为本次发行安装器的完整回归成绩。
