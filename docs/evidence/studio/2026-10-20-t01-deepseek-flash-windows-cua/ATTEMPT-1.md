# T01 Windows CUA：首次运行环境故障

2026-10-20 的首次 Windows 运行在沙箱初始化后进入未决执行状态，于 09:40:56 UTC 由评测操作者通过 CUA「停止」按钮中止。Host 原生状态为 `aborted`，没有 `pipeline.py` 或 `output/results.json`。这是无有效提交的环境故障记录，评测总目标仍在继续；没有本轮代码正确性分数。

受测 Host 为 `target/debug/aster-dream.exe`，PID 157464；ACP 为同目录 `a3s-code-acp.exe`，PID 154892。实际参数为 `--model deepseek/deepseek-flash`。本轮会话 `01a158a1-2140-70b5-a78f-70ae2c2f7492` 的 instruction 与 11 个输入文件在开始及中止后均与当前 `tests/T01` 原始 SHA-256 一致。

首次 `python --version` 获批后，原生沙箱返回 `failed to reserve a Windows sandbox drive with error 5`。该调用的执行结果未确认，收据为 `unknown`、观测不完整；后续执行和写入被 `tool_effect_unresolved` 拒绝。重复批准 probe 并不会核销这条未决记录。本轮共 39 次模型调用、39 个工具结果（18 成功、21 失败）、19 次确认答复。确认答复包含停止时的拒绝/取消，不等于 19 次成功执行。模型尝试的探测文件均没有形成交付。

系统只读诊断显示：CUA 启动的 Host/ACP 为 Medium integrity，管理员组为 DENY_ONLY，却保留完整管理员登录的 AuthenticationId；该登录的本地 DOS devices 目录仅授予 SYSTEM/Admin 创建权限。`QueryDosDeviceW` 仅发现 C/D 两个映射，22 个候选盘符空闲。因此故障指向启动令牌与本地设备命名空间的权限组合，而非盘符用尽。正常继承现有终端令牌的原生沙箱 CLI 已实际输出 `sandbox-ready` 并退出 0。

恢复方案为正常启动同一个 Host 二进制、由 CUA 继续控制前台窗口，再创建干净会话重新评测。保留原有 AppContainer、工作区 ACL、Job Object 与逐次授权；没有改写未决账本或放宽沙箱策略。

控制使用窗口前置、UIA 控件和应用定向键盘输入，没有坐标点击或物理鼠标移动。完整任务提示、二进制身份、输入哈希、错误收据摘要及操作记录保存在 [attempt-1](attempt-1)。UIA 输入附带了界面占位提示文字，实际发送文本在操作日志中保留。

未声称 T01 编程任务完成、模型代码通过验收、官方隐藏评分通过，或把历史 macOS 的 8/9 计作本次 Windows 成绩。墙钟时间包含授权等待与诊断，不能作为纯模型推理速度。
