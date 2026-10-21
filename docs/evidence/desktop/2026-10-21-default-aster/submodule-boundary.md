# 私有桌面源码边界

用户明确要求把合并后的桌面应用保留为 `apps/studio` 子仓库，远程为
`git@github.com:kense-labs/studio.git`，分支为 `main`。父仓库只记录一个
`160000` gitlink；原 `apps/work` 与 `apps/desktop` 路径删除。
根 Cargo 工作区、依赖路径与根锁文件继续使用，未建立第二个 Cargo 工作区。

默认 `aster` 是无账号本地产品；`toyou` 保留组织认证与界面。
旧本地应用的未提交源文件保存在被忽略的 `.local-archive/work-20261021`，
没有迁移用户数据、环境密钥或会话。

旧 `apps/work/` 历史曾包含完整源码。历史清理同时覆盖它和
`apps/studio/`，另清理旧界面别名与含桌面实现的证据补丁。
证据原文转存于私有子仓库的 `docs/evidence/parent-workspace/`；
公共共享 Office 库仍在父工作区维护。

实际子仓库转换后，根工作区依赖检查 6/6、CLI 配套检查 9/9 通过。
根全量格式检查发现另一个进行中工作树的 Effect 测试格式差异；未覆盖该改动。
桌面三个相关 Rust 文件已用固定工具链格式化并复验。功能、包和原生验收参见
[交付结论](OUTCOME.md)及[独立包检查](mac-r4-independent-review.md)。

CI 的七个 Cargo/前端检出入口读取父仓库固定的 gitlink 提交，不跟随远程
`main` 漂移。执行前需要配置仅能读私有桌面仓库的 `STUDIO_READ_TOKEN`；
当前远程没有这个 secret，因此本次不声明远程 CI 通过。

历史重写的可验证范围是远程可写分支与标签。GitHub 的只读 PR 引用、旧提交
缓存以及他人已有克隆不能由普通 force push 清除；需要平台支持或持有人处理。
参见 [GitHub 历史清理说明](https://docs.github.com/zh/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)。
