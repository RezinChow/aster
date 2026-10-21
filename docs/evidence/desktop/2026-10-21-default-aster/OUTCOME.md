# 默认 AsterDream 租户与任务进度展示验收

状态：源码、拥有者回归、双产品构建、本地 R4 桌面主流程、组织 R4 历史/模型重开及最终 macOS 双包独立检查已验证；设置页面像素、实际升级及其他整体验收仍有未完成项。本文不声明全部验收通过。

范围见 [spec](../../../../specs/004-desktop-default-aster/spec.md) 和 [tasks](../../../../specs/004-desktop-default-aster/tasks.md)。宿主保持在 `apps/studio`，默认 `aster`，`toyou` 保留组织托管行为。仅合并功能和品牌，不导入旧应用数据、会话、配置或凭据。本记录不包含产品发布；后续用户授权的独立子仓库迁移、提交与推送另行记录。

## 当前证据

| 范围 | 已确认结果 | 证据 |
| --- | --- | --- |
| 产品与能力选择 | `A3S_TENANT_SLUG` 同时选择前端静态能力与互斥原生 feature；默认本地版，错误或混合身份拒绝；本地保留原导航、设置与项目工作流 | [R3 本地边界](local-r3-final-validation.json)、[原生回归](native-final-validation.json) |
| 品牌与生产前端 | 星轨 logo、蓝银主题、独立品牌资源和自定义主题保留；R4 两种 production 构建均成功，101 项构建输入未变，89 项拥有者源码无漂移 | [R4 构建](renderer-local-r4-builds.json)、[产物逐项验证](renderer-local-r4-artifact-proof.json)、[源码收据](local-r4-source-ready.json) |
| 无账号本地版 | 本地包没有登录 onboarding 组件 chunk；不挂载用户头像/资料及组织页脚，不发送成员、组织、IM 或托管目录查询；原生拒绝相关入口且不读取成员文件 | [本地前后回归](native-pure-local-final-validation.json)、[R3 目录及页脚](LOCAL-R3-CATALOG-FOOTER.md)、[R4 产物](renderer-local-r4-artifact-proof.json) |
| 两种认证边界 | 原生 authority 本地构建 30 pass，组织构建 45 pass；继承的网关密钥被本地 ACP 子进程清除，真实本地 ACP 的网关请求计数为零 | [原生验证](native-pure-local-final-validation.json)；这些拥有者测试相互重叠，不求和 |
| 任务进度与开关 | 同一助手回合的一系列成功规划更新复用首张卡；失败输出不覆盖，明确空计划可清除投影；完成默认折叠；进行中橙色、成功绿色、失败红色、待处理灰色；真实键盘开关通过 | [投影回归 112 pass / 1 原有 skip](plan-rollup-after-r2.log)、[最终邻近回归 82 pass](plan-final-r3-regression.log)、[F 桌面验收](native-local-f-r4-completed.json) |
| 审批遮挡修复 | R3 真机窗口出现 DOM 已隐藏而旧普通输入卡仍绘制的现象；R4 只给 inactive primary 增加 `opacity-0`，继续保留原编辑器实例、inert、ARIA 和选择状态；6 suites / 62 pass | [修复及边界](local-r4-final-validation.json)、[保留的 R3 失败现场](native-gui-local-r3-plan-paint-before.json)、[真实 Rich/IME 回归](composer-paint-after-rich-isolated.log) |
| 最新本地端到端 | F 为全新无账号 profile，通过 UI 创建默认助手、选目录、发首条消息建会话；规划只读，Edit 与 Write 分别批准，最终读回；两个审批预览完整，无普通卡遮挡；只剩一张折叠 4/4 任务卡 | [F 完成收据](native-local-f-r4-completed.json)、[UI 创建记录](native-local-f-ui-provisioned-plan.json) |
| 后续中文回复 | 完成后输入框恢复，中文后续消息得到回复；三文件哈希未变，成员文件不存在，组织请求为零 | [F 后续收据](native-local-f-r4-followup.json) |
| 组织构建 R4 重开 | 使用现有合成组织 profile 重开 F/R4，成员菜单、历史、托管模型选择及中文回复通过，三文件不变；设置 AX 确认无本地 provider 入口及版本身份，但截图未同步设置页面，设置像素不计通过 | [组织 F/R4 重开收据](native-toyou-f-r4-reopen.json) |
| 原生与伴随程序 | 根目录 `just build-studio aster`、`just build-studio toyou` 均成功；每份收据绑定实际宿主、ACP 和 Office 字节，构建期间源未变 | [本地构建](native-host-closed-final-aster.json)、[组织构建](native-host-closed-final-toyou.json) |
| 最终 macOS 双包 | 两份 2.1.3 `.app` 的精确产品身份、R4 前端、63 个技能文件、完整资源哈希及 strict deep codesign 通过；修正 ZIP 中文 UTF-8 标志及资源叉条目后，原生 zip 7.2 解码、完整成员/字节/权限/CRC/安全边界均通过，Aster 2786 项、组织版 2779 项 | [独立报告](mac-r4-independent-review.md)、[聚合收据](mac-r4-independent-final-receipt.json)、[ZIP 合同](mac-r4-independent-archive-contract.json) |
| Office 与旧目录退休 | 21 项必要 Office 源码/构建入口迁入根包；`apps/work` 已原子移至本机忽略的 `.local-archive/work-20261021`，保留未提交修改；8 份许可证/通知逐字节保留；移除旧目录后 `pnpm build:office` 成功 | [Office 来源](office-relocation-source.json)、[退休收据](work-retirement.json)、[脱离旧目录构建](office-post-retirement-build.json)、[导入兼容回归 27 pass](office-import-compatibility.log) |
| 内置技能交付合同 | 当前 8 技能 / 63 文件列入资源合同；runtime 使用自身编译清单，updater 使用未来目标的有界安全自述清单；缺失、额外、空文件、符号链接、混代及错误哈希拒绝，合法新增未来资源允许 | [原生两产品：updater 各 35、resolver 各 4](native-bundled-skills-final-validation.json)、[封装工具 48 pass](delivery-skills-final.log)、[交付说明](DELIVERY-BUNDLED-SKILLS.md) |
| 格式与边界门禁 | `cargo fmt --all -- --check` rc 0；移除旧 member 后 CLI/工作区 guards 15 pass；现有 dropdown 3、dialog/motion 20 pass，未扩展 allowlist；根 Cargo 聚焦数据/桌面合同 3+11 pass | [fmt](final-workspace-fmt.json)、[迁移后 guards](delivery-linux-root-guards-post-migration.json)、[UI 门禁](ui-ratchets-final.json)、[原生工作区记录](native-workspace-validation.json) |
| 独立审查与文档 | 源码边界复查未发现新的退休依赖或组织回归；确认并修复技能前向更新限制。现行说明清理，技术路径及产品身份数据保持准确；内置知识检查通过 | [合并复查](final-independent-review.md)、[文档复查](documentation-final-readonly-review.json)、[身份修复记录](brand-definition-identity-repair.json)、[知识检查](builtin-knowledge-after.log) |

F 使用签名的隔离 debug QA bundle 与 R4 production renderer，实际窗口没有打开 Inspector、调整 viewport、改变 DOM/CSS 或替换定时器。它证明该构建的真实主流程，不替代 release 包安装验收。R3 的 Inspector resize 曾清除旧绘制；没有完成同现场 opacity A/B，因此不声称诊断了某一具体上游 WebKit 缺陷或版本。

macOS 聚合收据 SHA-256 为 `be93e915ad6069f801713a7f938cc3d24c94ec3207462cd102ebfaf530133bf6`。补充传递依赖检查覆盖 37 个本地包、3302 项 Rust/manifest/config 输入和实际伴随程序再构建；这是当前再验，不是倒造包前快照。Aster 包内较早 ACP 与再构建产物的原始哈希不同，独立检查确认差异仅在显式源码戳、Mach-O UUID 和对应签名字节，未宣称原始字节相同。双包使用本机 ad-hoc 签名，未公证或发布；实际安装/更新/重启仍是单独门禁。

展示选择参考 [VS Code 1.104 Todo List tool](https://code.visualstudio.com/updates/v1_104)：稳定进度入口与折叠完成内容适合本产品的长消息流。这是结合现有界面的设计判断，并非外部规范的强制要求。

## 需求核对

| 需求 | 当前结论 |
| --- | --- |
| FR-001 默认入口 | 实现、entry/CI shell 合同通过；没有终止旧用户应用进程 |
| FR-002 品牌 | 两前端产物、本地 R4 窗口和 macOS 双包身份通过；组织 R4 重开、成员/模型身份与回复通过，设置页面像素未接受 |
| FR-003 既有能力 | 规划/审批/输入恢复已有 F 实测；目标、停止、重连与模型边界有真实 ACP 和拥有者回归，最终整合仍见 spec 003 |
| FR-004 数据隔离 | 原生 profile/WebView/锁/runtime 与合成哨兵回归通过；F 是新 profile，没有成员文件，未迁移旧用户状态 |
| FR-005 交付身份 | 两种根构建及 macOS 两包完整资源、签名和 ZIP 原生解码/安全边界通过；Linux 选定产品 stage 待验 |
| FR-006 更新身份 | 两产品原生 updater 各 35 pass，错误资源/产品拒绝，Aster 未发布渠道先于网络拒绝；旧版合成升级待验 |
| FR-007 本地权限 | 无账号/无组织请求、真实 BYOK ACP 正向及组织准入负向通过 |
| FR-008 证据 | 源码、回归、双构建和本地 R4 CUA 完整记录；两产品最终交付验收未全部结束 |
| FR-009 互斥构建 | 无 feature / 双 feature 编译拒绝；两种合法构建通过，前端能力裁剪已查实际 JS 产物 |
| FR-010 状态与开关 | 语义状态、禁用/IME 拥有者回归与 F 实际 Tab/空格/鼠标通过；不据粘贴测试宣称实体输入法候选窗通过 |
| FR-011 文档 | 当前说明已清理并复查；准确技术标识、许可及历史记录不作产品名称替换；不宣称外部改写过的历史 JSON 哈希始终未变 |
| FR-012 稳定任务卡 | 投影负向回归与 F 实际单卡折叠/展开通过，原始消息历史不删除 |
| FR-013 原本地设计 | 本地导航/设置/目录/默认助手流程、组织静态及原生边界通过；组织 R4 历史/模型重开通过，设置 AX 与像素验收分别记录 |
| FR-014 退休与技能 | Office 合并、退休及源合同回归通过；最终 macOS 两包的 63 文件技能与引用、资源哈希和签名通过，安装后脱离源码实际加载/升级尚未执行 |

## 待完成的整体验收

- 组织构建 R4 设置页面的像素验收；已有 AX、历史/模型重开及回复证据不冒充设置截图通过。
- macOS 隔离旧版本合成 fixture 的实际安装、升级和重启；因用户新增子仓库结构任务而暂停，仍未执行，不勾选为通过。双包静态/签名/ZIP 检查不替代此流程。
- Linux 选定产品最终宿主/ACP/Office/R4 前端与技能完整 stage、ELF/ldd 和身份核对；预热输出不算最终产物。
- spec 003 尚缺的最终交互/升级闭环、最终源/包收据复核及本任务自有进程清理。

## Explicitly not claimed / 明确不声称

- 全树 TypeScript 仍有既有错误。R4 对同一基线的作用域比较为 33→33，新增诊断为空；R3 页脚 ESLint 有 2 项未变的既有层级错误，R4 三项修改文件自身 lint/format 通过。没有修改规则或 allowlist 掩盖它们。
- 根 `cargo check --locked --workspace --all-targets` 已实际执行并返回 101：`a3s-use` 测试有 33 项缺失 fixture，`apps/gateway/examples/protocol_benchmark_load.rs:138` 存在 Vec/Bytes 不匹配，均非本任务改动。记录见 [工作区限制](native-workspace-validation.json)，不宣称全工作区检查通过。
- 各阶段/相邻套件重复覆盖，不把 464、137、112、82、62 或各原生计数相加成唯一测试总数。精确真实 crate 测试不等于完整 Cargo、签名安装包或系统验收。
- 未进行实体麒麟、原生 Wayland、物理 Windows 或 macOS 中文候选窗验收。真实 GTK/portal/container 机制证明有其边界；stock Flatpak 在本容器内返回 `PR_SET_SECCOMP EINVAL`，生产脚本保留拒绝，没有绕过沙箱。
- Aster 新产品更新源尚未发布；没有查询组织产品旧源以代替，也没有改在线源、公证、上传发布或迁移旧数据。

## 最终结构与 Linux 验证

用户追加要求桌面源码转为私有子仓库并清理父仓库历史，见[边界收据](submodule-boundary.md)。Linux 两种宿主真实 release 构建、三份 ELF/链接、完整 generation、技能与启动拒绝检查通过；严格 Flatpak 导出均被当前容器内核 seccomp 拒绝，未导出或安装。最终证明为 `delivery-linux-r4-final-proof.json`（SHA256 `3541f5c54c5ecff2d89374ef938d7b0d80efa2e7ba25bbadc50d79269d881132`）。原未完成的旧版升级 CUA 仍不声明通过。
