# 桌面规划、执行与输入体验对齐验收

状态：实现、拥有者回归、最新本地 R4 桌面主流程、组织 R4 历史/模型重开和最终 macOS 双包独立检查已验证；设置页面像素、实际升级及其余整合仍待完成。本文不声明 spec 003 整体验收通过。

范围见 [spec](../../../../specs/003-desktop-work-alignment/spec.md)、[plan](../../../../specs/003-desktop-work-alignment/plan.md) 和 [tasks](../../../../specs/003-desktop-work-alignment/tasks.md)。后续用户要求由 [spec 004](../../../../specs/004-desktop-default-aster/spec.md) 替代两个独立桌面应用的假设：保留 `apps/studio` 共享宿主，默认本地构建 `aster` 无账号，`toyou` 保留组织认证。原有云端、API、CLI 及其他并行修改未纳入本地通过声明。本记录不包含产品发布；后续用户授权的独立子仓库迁移、提交与推送另行记录。

## 执行证据

| 项目 | 已确认结果 | 证据 |
| --- | --- | --- |
| 基线与边界 | 保留开始时其他工作流的改动和原产品数据；没有导入用户凭据/会话 | [基线](BASELINE.json)、[后续退休与数据边界](../2026-10-21-default-aster/work-retirement.json) |
| 输入法、富文本及快速回复 | 初版 13 suites / 429 pass；最终 R4 的真实 Tiptap/IME、审批切换、同 DOM/editor、选择、草稿与焦点保持另有 6 suites / 62 pass。阶段间重复覆盖，不求和 | [输入实现](IME-RENDERER.md)、[R4 真实编辑器回归](../2026-10-21-default-aster/local-r4-final-validation.json) |
| 规划、目标与进度 | 原 UX 27 files / 749 pass / 1 原有 skip；后续单卡成功更新/失败/空计划/折叠回归 112 pass / 1 原有 skip，最终邻近 82 pass；同一回合复用一张卡 | [UX 实现](ux-implementation.md)、[单卡回归](../2026-10-21-default-aster/plan-rollup-after-r2.log)、[最终邻近](../2026-10-21-default-aster/plan-final-r3-regression.log) |
| 原生协议闭包 | 修复扩展方法/通知拼写、严格 result/error 解包、审批完整身份、停止原因闭集、目标顺序/期限与跨 owner 重验；录得 86 个唯一通过测试名，不能再与邻近套件求和 | [独立协议复查](ux-native-independent-review.md)、[实际线协议表](ux-acp-wire-map.md) |
| 实际 ACP 正向 | 工作区真实 ACP 经私有模型完成规划拒写、确切批准、写入/读回；目标 active/paused/cancelled 来自实际 typed RPC；继承网关密钥的本地链路不产生网关请求 | [原实际协议日志](native-real-acp-protocol-after.log)、[当前无账号 ACP 与网关证明](../2026-10-21-default-aster/native-pure-local-final-validation.json) |
| 模型默认值与存储 | 三项 device 默认值同步、重开读取、保存失败回滚和组织准入负向均有拥有者回归；本地/组织 profile 与身份隔离保留 | [当前 native 回归](../2026-10-21-default-aster/native-final-validation.json)、[纯本地后续回归](../2026-10-21-default-aster/native-pure-local-final-validation.json) |
| 原生更新与技能 | 最新两产品 updater 各 35 pass，拒绝错误产品/代际/缺资源；技能 resolver 各 4 pass；未来目标的合法新增资源允许，不绑定旧客户端的 63 文件清单 | [最新原生合同](../2026-10-21-default-aster/native-bundled-skills-final-validation.json) |
| 前端及原生构建 | R4 两种 production renderer 成功；根 `just build-studio aster` / `just build-studio toyou` 均成功，绑定实际宿主、ACP、Office 哈希；Office 移除旧目录后构建成功 | [R4 前端](../2026-10-21-default-aster/renderer-local-r4-builds.json)、[本地原生](../2026-10-21-default-aster/native-host-closed-final-aster.json)、[组织原生](../2026-10-21-default-aster/native-host-closed-final-toyou.json)、[Office](../2026-10-21-default-aster/office-post-retirement-build.json) |
| 最新本地 CUA | F 全新无账号 profile；通过 UI 创建助手、选目录、首条消息建会话；只读规划→分别批准 Edit/Write→读回完成，文件在各自批准前保持边界；R4 两个预览都无旧输入卡遮挡；单张 4/4 卡展开/折叠、Tab/空格开关及后续中文回复通过 | [F 主流程](../2026-10-21-default-aster/native-local-f-r4-completed.json)、[F 后续回复](../2026-10-21-default-aster/native-local-f-r4-followup.json) |
| 组织 R4 重开 | F/R4 使用既有合成成员 profile，历史、成员菜单、托管模型、后续中文回复和文件不变通过；设置 AX 核对版本与无本地 provider，设置页面像素未接受 | [组织 F/R4 收据](../2026-10-21-default-aster/native-toyou-f-r4-reopen.json) |
| 最终 macOS 双包 | 两个精确产品身份、2.1.3 版本、R4 前端、完整资源/63 文件技能和 strict deep codesign 通过；UTF-8 ZIP 中文路径、原生 zip 7.2 解码、完整成员/字节/CRC/权限及 updater 容量边界通过 | [独立双包报告](../2026-10-21-default-aster/mac-r4-independent-review.md)、[聚合收据](../2026-10-21-default-aster/mac-r4-independent-final-receipt.json) |
| Linux/输入机制 | 真实 GTK/private-bus 8 项协议、模块 RTLD_NOW 与 IBus 注册、缺资源拒绝；迁移后的当前 11 项输入机制通过。真实三程序与最终产品 stage 仍单独待验 | [Linux/麒麟机制](IME-KYLIN-PACKAGING.md)、[当前 11 项](../2026-10-21-default-aster/delivery-current-ime-mechanisms-final.log) |
| 根门禁与审查 | fmt rc 0；移除旧 member 后 CLI/工作区 15 pass；dropdown 3、dialog/motion 20 pass；根 Cargo 聚焦 sqlite/desktop-contract 为 3+11 pass；本次未扩大 allowlist | [fmt](../2026-10-21-default-aster/final-workspace-fmt.json)、[迁移后 guards](../2026-10-21-default-aster/delivery-linux-root-guards-post-migration.json)、[UI 门禁](../2026-10-21-default-aster/ui-ratchets-final.json)、[根 Cargo 范围](../2026-10-21-default-aster/native-workspace-validation.json)、[合并独立复查](../2026-10-21-default-aster/final-independent-review.md) |

最新 F 的 UI 验证使用隔离签名 debug QA app 和 R4 production renderer，没有 Inspector、viewport resize 或 DOM/CSS 注入。R3 的真实绘制不一致失败保留在 [现场记录](../2026-10-21-default-aster/native-gui-local-r3-plan-paint-before.json)；修复只增加 inactive primary 的透明绘制门控，不卸载编辑器。没有同现场 opacity A/B，不将其冒称某一已确诊的上游 WebKit bug。

macOS 独立聚合收据 SHA-256 为 `be93e915ad6069f801713a7f938cc3d24c94ec3207462cd102ebfaf530133bf6`。两份 ZIP 修复前的中文解码和过多资源叉条目失败均保留；修复后的 Aster/组织包分别为 2786/2779 项。当前补充再验覆盖 37 个本地依赖包及 3302 项 Rust/manifest/config 输入，不假装是原包构建前快照。Aster 较早 ACP 与新产物的原始哈希不同，仅源码戳、Mach-O UUID 及对应签名字节有差异的证明单独保留。此结论不包含实际更新安装/重启，签名为本机 ad-hoc，未公证或发布。

原 Office 依赖链接曾指向未补丁包，修正现有 pnpm 链接后实际构建恢复，未改锁图；见 [诊断](ux-office-dependency-diagnosis.md)。原生构建使用独立 `target/studio-macos-alignment`，没有删除其他构建的缓存或终止其进程。Work 退休、21 项 Office 合并及 8 份法律文件保留的当前证据见 [spec 004 OUTCOME](../2026-10-21-default-aster/OUTCOME.md)。

## FR-001–FR-012 核对

| 需求 | 当前结论 |
| --- | --- |
| FR-001 同代 ACP/Office | 根双产品构建、缺失/混代拒绝及 macOS 两包资源与传递依赖补充复查通过；实际安装/重启仍未执行 |
| FR-002 输入法所有权 | 真实 Rich/IME 与候选键/取消机制回归通过；实体输入法候选窗仍未验 |
| FR-003 输入与回复 | 接受发送、跨 session 拒绝和快速回复拥有者回归通过；F 完成后中文回复与文件不变已实测 |
| FR-004 规划审阅执行 | stale/unknown/queue 等回归通过；F 规划、两次批准、执行、单卡完成通过；审阅修改与原生完整重连场景的最新整合证据仍需收齐 |
| FR-005 目标 | 当前 task/session/revision 绑定、终态清理、来源及顺序/期限回归通过，真实 ACP 已读 active/paused/cancelled；不声称宿主重启后恢复旧 goal |
| FR-006 审批身份与停止 | 错绑、单次回复、attach/reconnect/abort 撤回和终态来源拥有者测试通过；F 分别批准两次真实文件操作通过；最终窗口停止/重连仍待整合 |
| FR-007 模型持久化 | 三默认值、回滚、重开读取及准入回归通过；组织 R4 实际窗口的历史/托管模型重开与后续回复通过，设置页面像素不计通过 |
| FR-008 完整产品更新 | 资源/身份/缓存/重试/安装状态合同通过；后续 spec 004 明确 Aster 新 feed 未发布时拒绝，不查询组织旧 feed；隔离旧版本合成升级待验 |
| FR-009 Linux/IME 交付 | 源码、原生 GTK/portal/模块和缺资源拒绝已验；最终真实应用 stage、严格 Flatpak export 与实体麒麟仍有边界 |
| FR-010 原有设计与归属 | 保留 dockContent、输入/模式/焦点及 session ownership 回归；后续按用户要求恢复原本地导航并隔离组织入口；不以本地证明覆盖云端 |
| FR-011 配置与闭集 | 继续 ACL；规划/目标/停止/协议/产品身份来自 typed 或显式闭集，无按文本猜状态；相关拥有者回归与审查通过 |
| FR-012 证据 | 真实命令、源/产物哈希、失败与独立审查已保留；尚缺的交付、平台和最终交互没有标成完成 |

## 待完成的整体验收

- 组织 R4 设置页面像素验收；已有 AX、历史/模型重开及回复记录不能代替设置截图。
- macOS 隔离旧版本合成 fixture 的安装、升级与重启，以及安装后脱离构建机源码实际加载技能。升级 CUA 因用户新增子仓库结构任务而暂停，未执行，不能勾选通过。
- Linux 选定产品最终宿主、ACP、Office、R4 前端与技能 stage；完整真实应用的交互与 strict export 不能由 GTK fixture 代替。
- 最新窗口仍缺的审阅修改、停止/重连、目标及多 session 交互证据收齐，最后源/包审计与本任务自有进程清理。

## Explicitly not claimed / 明确不声称

- 全树 TypeScript 通过。R4 同基线作用域为 33→33、无新增诊断；R3 页脚已有 2 个 lint 层级错误未扩大，R4 修改文件本身 lint/format 通过。
- 全根工作区检查通过。实际 `cargo check --locked --workspace --all-targets` rc 101，原因是本任务未改的 `a3s-use` 33 项缺失 fixture 和 gateway benchmark 的 Vec/Bytes 不匹配；[原失败和聚焦通过](../2026-10-21-default-aster/native-workspace-validation.json) 均保留。
- 不将各阶段重叠测试数相加，不将精确 crate 运行等同于完整 Cargo 或包验收；合成模型不代表外部模型质量。
- F 中文粘贴/回复不代表 macOS 实体输入法候选窗通过；没有物理 Windows、实体麒麟或原生 Wayland 验收。
- stock Flatpak 在本容器内因 `PR_SET_SECCOMP EINVAL` 拒绝，生产路径没有绕过；[失败](ime-kylin-stock-flatpak.log) 与 [strict package 拒绝](ime-kylin-strict-package.log) 保留。
- 旧版本升级 fixture 为原始基线源码加合成较低版本，不能冒称已发布历史二进制；debug QA app 不是 release 包。
- 不声称 host 重启后恢复旧 goal；没有当前 runtime 时返回 unavailable。文件存储有同步失败补偿，不宣称断电原子性。
- 没有用户登录状态/凭据复制、旧数据迁移、在线更新源修改、公证、上传或发布。历史目录发生过外部改名/改写，当前收据绑定当前字节，不宣称原历史 JSON 的哈希从未变化。

## 最终结构与 Linux 验证

用户追加要求桌面源码转为私有子仓库并清理父仓库历史，见[边界收据](../2026-10-21-default-aster/submodule-boundary.md)。Linux 两种宿主真实 release 构建、三份 ELF/链接、完整 generation、技能与启动拒绝检查通过；严格 Flatpak 导出均被当前容器内核 seccomp 拒绝，未导出或安装。最终证明为 `delivery-linux-r4-final-proof.json`（SHA256 `3541f5c54c5ecff2d89374ef938d7b0d80efa2e7ba25bbadc50d79269d881132`）。原未完成的旧版升级 CUA 仍不声明通过。
