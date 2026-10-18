# macOS 工作区目录传输

Host→Shim→Guest 现在实现了逐项授权的目录 virtio-fs 挂载。Runtime 公布必选的
v2 包移交；内部清单绑定原始配置、授权、源路径、设备和 inode。Shim 钉住私有
配置、清单和调用方目录描述符，在 VM 入口再次验证。既有清单原子发布代码移入
Unix 共用模块，Linux 原始块设备和 TAP 逻辑未改变。

Guest 将目录挂入精确的自有 bundle 保留子目录，生成相对 bind 源；Linux
executor 继续使用原有 BundleOnly 描述符边界，未增加绝对路径豁免。
宿主 Seatbelt 仅给逐项授权的目录读或读写权限，继续拒绝链接、宿主执行和旁路网络。
调用方目录不做 chmod，退出清理只删除运行时拥有的代次目录。

## 缺陷与验证

这些检查分别捕获路径/摘要漂移、目录替换、缺失授权、重放覆盖、只读降级和
删除调用方数据等错误，而不是只固定函数调用次数。

- SDK 198、协议 10、Runtime Utility VM 81、Shim 64、Guest 源绑定 6 项通过。
- Shim 的 1 个 ignored 测试是由父测试单独启动的 Seatbelt 子进程，不是跳过安全门。
- Linux Guest/Runtime 的测试目标通过 Zig 交叉编译；未在 Linux 硬件执行。
- 五个受影响 crate 的全部目标严格 Clippy、格式检查通过。
- 原始日志保留于 `checks.log.gz`。

公共 SDK 示例 `qualify_hvf_workspace` 通过真实 HVF VM：只读/读写目录包含中文、
引号及反斜杠；读写输出在宿主可见；Guest 返回真实退出码 7；创建重放相同；
删除后调用方内容和 0755 权限保留，自有 share 已删除。测试特意给 Guest
CAP_SYS_ADMIN 和 CAP_DAC_OVERRIDE，成功 remount,rw 后宿主仍拒绝写只读目录。
原始输出先为 EROFS，重新挂载后为 EPERM，正向输出为 workspace-contract-passed。

`diagnostic-*` 是未提交源码的诊断运行，不能视作干净发布候选验收。
签名提交后应冻结重建，再保留目录运行及原有 25 轮公共生命周期兼容回归。

## 产品状态

尚未接入 AsterDream 默认 Bash。调用方凭据拒绝策略、资源分发、网络与工具链、
产品端到端仍未完成。此次没有取消原生进程生命周期保护，没有推送、发布或触发 CI。

## 干净源码验收

签名提交 `86e6cd2a21025875ba0903d7be74da58c7a66224`、干净工作区重建并冻结
Host、已签名 Shim、静态 Guest 和镜像，产物摘要记录于 candidate.json 与报告。

- 公共 SDK 目录验证退出码 0，真实 Guest 退出码 7；读写、只读、特权 remount
  后宿主拒写、调用方权限/内容保留、精确 share 清理全部通过。
- 该次目录测试全流程耗时约 17.33 秒，包含服务启动、fixture 复制、VM、验证、
  清理；这是单次观察，不能作为 Bash 热路径延迟承诺。
- 原有公共 Host Service 门禁通过：所有公布的操作、I/O、终端、文件与文件系统、
  生命周期重放通过；宿主 SIGKILL 后精确恢复、重放及清理通过。
- 25/25 轮循环、25 个 VM 代次通过，三个阶段描述符均 13→13。每轮进程、
  端点和临时状态清理通过。观察到 28 个工作进程，随机环境探针均未泄漏。

目录运行与公共回归使用同一冻结候选及镜像。qualified-config.json 保留特权反例的
精确 OCI 配置，qualified-attachments.json 保留公共授权；两个运行脚本和原始报告
均随证据保留。上述结论仍不包括 AsterDream 默认 Bash 或产品界面端到端。
