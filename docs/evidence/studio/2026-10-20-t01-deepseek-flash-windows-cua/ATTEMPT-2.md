# T01 Windows CUA：Python 环境预检

第二次会话 `01a158b5-86f8-7148-b87e-502af075f856` 使用正常启动的同一 Host（PID 173032）和 ACP（PID 126856）。[令牌诊断](attempt-2/launch-token-diagnosis.json)确认启动令牌错配已消除；AppContainer、工作区 ACL、Job Object 和逐次授权均保留。

这次沙箱可以执行 PowerShell：`echo test; exit 3` 的实际输出为 `test\r\n`，原始 metadata 退出码为 3。用户目录里的 uv Python 在沙箱内执行失败，命令没有输出，实际退出码为 1；失败已被观测，没有再次形成 `tool_effect_unresolved` 全局门禁。

代码及系统只读检查确认，原 Python 路径不在 Host PATH 中，也没有该沙箱 AppContainer 的读取授权。仅将根目录放入 PATH 的标准工具链发现还不足以让嵌套标准库可读。评测操作者于 09:54:12 UTC 通过 CUA「停止」中止本轮，Host 为 `aborted`。共 16 次模型调用、19 个工具结果（14 成功、5 失败）、4 次确认答复；没有 `pipeline.py` 或 `output/results.json`，不计算本轮代码分数。输入和二进制均未变化。

随后将已有 CPython 3.12.14 的程序与标准运行时复制到隔离预检工作区，排除 `site-packages` 与已有 `__pycache__`，共 2,297 个原始文件、48,629,551 字节。没有复制账号、模型配置、凭据或应用会话。通过同一个原生沙箱，运行相对路径解释器并导入 `csv,json,hashlib,decimal,datetime,argparse`，实际输出 `123`、退出 0。没有手改 ACL、关闭沙箱或执行 Host fallback。

第三次干净项目在初始输入前准备 `_toolchain/python/python.exe`，初始提示明确指出这个标准解释器。最终评分仍只复制模型生成的 `pipeline.py` 到独立目录，用评测方 Python 执行；运行时不会成为提交的自写模块依赖。

本记录及 [attempt-2](attempt-2) 仅证明环境诊断与恢复，不代表 T01 编程任务成功、官方隐藏评分通过或模型能力成绩。
