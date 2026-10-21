# T01 Windows CUA：为什么 probe 反复失败

反复出现的 `tool_effect_unresolved: mutating calls require reconciliation of earlier uncertain invocations` 是首次工具调用留下未决收据后触发的安全门禁；重复批准后续 probe 不会解除它。该现象来自本次 Windows 执行环境及收据链，不能据此判定 DeepSeek Flash 模型故障。

[首次运行审计](attempt-1/runtime-audit.json)中，seq 32 的原始错误是 `failed to reserve a Windows sandbox drive with error 5`，收据为 `unknown`、`incomplete`，并带有一个 `unresolved_external_operations` 身份；seq 48 起记录后续 `tool_effect_unresolved` 拒绝。[Windows 实现](../../../../crates/sandbox/src/platform/windows.rs)在 `WorkspaceDrive::create()` 中调用 `DefineDosDeviceW` 分配临时盘符；本次失败发生在该步骤，不是盘符用尽，也不能归因为 ACL 初始化失败。只读令牌及设备命名空间诊断、正常启动 CLI 输出 `sandbox-ready` 且退出 0 的结果见 [ATTEMPT-1](ATTEMPT-1.md)。

[收据实现](../../../../crates/code/core/src/fact_control/receipts.rs)将未返回完整执行证据的 `Err` 记为 `Unknown`，并为非只读调用保留未结算身份。后续准备工具时，只要 ledger 仍有这样的身份，就拒绝新的非只读调用。批准回答只授权它对应的调用，不提供先前调用是否执行、产生了什么效果的证据，所以连续点批准不能完成 reconciliation。原会话的未决记录没有被编辑、清空或核销。

当前采用环境恢复：正常启动同一 Host 二进制，让 CUA 继续控制前台窗口，并使用干净会话。第二次运行的[令牌诊断](attempt-2/launch-token-diagnosis.json)确认启动令牌错配消除；[执行审计](attempt-2/runtime-audit.json)记录 `echo test; exit 3` 实际输出 `test\r\n`，metadata 退出码为 3。用户目录中的 Python 随后出现已观测的执行失败，没有再产生上述未决身份门禁；其文件效果观测仍可能不完整，不能称为所有观测均完整。

针对 Python 的独立环境问题，已有 CPython 3.12.14 程序及标准运行时被准备到工作区工具目录，排除 `site-packages` 和已有 `__pycache__`，没有复制用户配置、凭据或应用会话。隔离预检在同一原生沙箱内导入所需标准库后输出 `123`、退出 0。新评测会话使用 `_toolchain/python/python.exe`；输入不变，最终验收仍只隔离模型提交的 `pipeline.py`。详见 [ATTEMPT-2](ATTEMPT-2.md)。

这是已验证的环境绕行与重新评测准备，没有修改产品源码、手改 ACL、放宽沙箱策略、关闭 AppContainer 或改写 ledger；也不是通用 reconciliation 或收据源码缺陷已修复的证明。未声称原未决调用已结算、T01 程序已完成、已评分或通过隐藏验收。
