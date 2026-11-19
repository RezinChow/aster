# 任务与产物

此模板尚无完成记录。仅登记本项目真实交付，不复制模板来源项目的历史。

每个任务以 H2 标题记录稳定的 `T日期-slug` ID，正文写明完成日期、具体结果、可打开的实际产物及验证依据/限制。新完成项置前，历史保留；未知日期、产物或验证不得补造。

单人任务可自行登记；并行工作由指定的 D/O 或台账写入者汇总真实短报后，再发布最终完成报告。证据不足时保持部分完成/未验证，不列为完成。

每个任务的验收证据分路径保存，不覆盖旧报告。当前源码链接可更新，历史结论以回执或快照为准；`/wiki` 刷新本页入口并打包实际引用的产物。

## T2026-11-19-tb4-kburn-on-rerun

- **完成日期**: 2026-11-19
- **结果**: 充值后重跑 TB4.0 首任务 KBurn 开启臂，正常退出且无 402；模型明确加载 KBurn `go`，首个工具为 `Skill`。最终 **reward 0 / verifier 1/5**，未复现此前 3/5。
- **产物**: `.kstudio/evidence/T2026-11-19-tb4-kburn-on-rerun/OUTCOME.md`；`docs/evidence/code/2026-11-19-tb4-kburn-on-rerun/OUTCOME.md`；`artifacts/tb4-kburn-comparison-2026-11-19/comparison-rerun.json`
- **验证**: agent 1894.955 秒 / 27 streams / 188 工具 / 42.41M tokens；off 为 2016.258 秒 / 29 / 165 / 34.30M；独立脚本生成差值且保留旧对照
- **限制**: 单次波动显著，不能宣称提分、降 token 或效率收益；无 k=5、无全量任务、无 Windows；总体 Meta Harness 与发布证据仍未完成

## T2026-11-19-tb4-kburn-comparison

- **完成日期**: 2026-11-19
- **结果**: `/go` — TB4.0 首任务同模型开／关对照完成。优先提示进入首条用户消息后，开启臂首个工具实际为 `Skill`；verifier 从 1/5 提升到 3/5，但两臂 reward 均为 0，开启臂最终因 DeepSeek 402 退出。
- **产物**: `.kstudio/evidence/T2026-11-19-tb4-kburn-comparison/OUTCOME.md`；`docs/evidence/code/2026-11-19-tb4-kburn-comparison/OUTCOME.md`；`artifacts/tb4-kburn-comparison-2026-11-19/{comparison.json,analyze.py,jobs/}`
- **验证**: off 165 工具 / 34.30M tokens / 2016.258 秒；on 122 工具 / 20.14M tokens / 1380.682 秒 / 1 次 Skill；runner 29/29、Clippy、musl build、ACP PTY 均通过；独立脚本重算差值
- **限制**: 单任务单臂一次，提前 402 停止使时延/token 下降不能证明效率收益；静态镜像未证明 factory seeds 物化；Core 单测受并发缺失 `dsh/tests.rs` 阻塞；无全量 Core/ACP、无 k=5、无 Windows、≠ Meta Done / 产品 Pass

## T2026-11-19-acp-kburn-auto-mode

- **完成日期**: 2026-11-19
- **结果**: `/yolo` — ACP/Core KBurn 三态开关落地：默认仅检测 `.aster` 工程标记；`kburn = true` / `--kburn` 显式开启并物化缺失 seeds；`kburn = false` / `--no-kburn` 关闭自动物化与技能注入；`.kstudio` 单独存在不再自动触发，显式 `skill_dirs` 保留。
- **产物**: `.kstudio/evidence/T2026-11-19-acp-kburn-auto-mode/OUTCOME.md`；`docs/evidence/code/2026-11-19-acp-kburn-auto-mode/OUTCOME.md`；`artifacts/kburn-acp-2026-11-19/`
- **验证**: 四条真实 Aster+ACP PTY 4/4；确定性 TUI **74/0/1**；全量 Core **5984 通过 / 0 失败 / 33 忽略 / 616.24 秒**；Core/ACP Clippy 与配套构建 exit 0；自然语言 Skill 调用保留权限确认
- **限制**: ACP 全库 **542 通过 / 4 失败 / 10 忽略**，失败位于工程输入计数、推理传输和 LocalSet 路径，未宣称已修或全库绿；无真实模型、无 Windows 原生验证；空工作区物化 seeds 不等于内嵌 12 技能正文；命名切片完成，≠ Meta Done / 产品 Pass

## T2026-11-19-completion-gate-pass-status

- **完成日期**: 2026-11-19
- **结果**: `/yolo` — 修复完成证明状态绑定：effect digest 匹配且 required checks 全绿但总体为 `Skipped` 的宿主报告不再被误判为 `Verified`；attestor 文档同步明确总体必须为 `Passed`。
- **产物**: `.kstudio/evidence/T2026-11-19-completion-gate-pass-status/OUTCOME.md`；`docs/evidence/code/2026-11-19-completion-gate-pass-status/OUTCOME.md`；`artifacts/completion-gate-2026-11-19/`
- **验证**: 反例先红后绿；harness 89/89、attestor 18/18、read-only 5/5；TUI 70/0/1；全量 Core **5982 通过 / 0 失败 / 33 忽略 / 616.74 秒**；Core/ACP Clippy 与配套构建 exit 0
- **限制**: 首轮 TUI 因文档编辑后的单边重编出现 BUILD_ID 失配，配对重建后全绿；格式检查仅受既有 terminal example 影响；无真实模型、无 Windows 原生验证；命名切片完成，≠ Meta Done / 产品 Pass

## T2026-11-19-store-cas-fencing

- **完成日期**: 2026-11-19
- **结果**: `/yolo` — 修复快照 CAS 的跨进程 TOCTOU：同一 flock 覆盖摘要比较与提交，双写者反例由 2 成功降为 1；WAL/租约/加密与崩溃恢复完成验证。
- **产物**: `.kstudio/evidence/T2026-11-19-store-cas-fencing/OUTCOME.md`；`docs/evidence/code/2026-11-19-store-cas-fencing/OUTCOME.md`；`artifacts/store-cas-2026-11-19/`
- **验证**: 存储 85/1；40 代快照 + 5 次崩溃注入 1/1；capability 74/74；TUI 70/0/1；全量 Core **5981 通过 / 0 失败 / 33 忽略 / 619.13 秒**；Clippy 与配套构建 exit 0
- **限制**: 仅测试构建的 MCP 冷启动窗口为 10 秒，生产仍 3 秒；无真实模型、无 Windows 原生验证；命名切片完成，≠ Meta Done / 产品 Pass

## T2026-11-19-ptc-quickjs-boundaries

- **完成日期**: 2026-11-19
- **结果**: `/yolo` — PTC/rquickjs 权限与资源边界切片关闭：证实 `eval/*x*/` 可执行后，改为 VM 全局禁用 `eval` 与 `Function`；补动态导入、内存、栈反例，无真实模型消耗。
- **产物**: `.kstudio/evidence/T2026-11-19-ptc-quickjs-boundaries/OUTCOME.md`；`docs/evidence/code/2026-11-19-ptc-quickjs-boundaries/OUTCOME.md`；`artifacts/ptc-quickjs-2026-11-19/`
- **验证**: PTC 49 + 资源 2 + 程序 26 + 失败回执 2；TUI **70/0/1**；全量 Core **5980 通过 / 0 失败 / 33 忽略 / 613.80 秒**；Core/ACP Clippy 与配套构建 exit 0
- **限制**: 默认模块加载器已拒绝测试模块，未声称模块绕过修复；仅命名切片完成，未做 Windows 原生验证，≠ Meta Harness Done / 产品 Pass

## T2026-11-19-aster-architecture-tui-e2e

- **完成日期**: 2026-11-19
- **结果**: 继续推进真实 TUI 架构分析，仅一次 `deepseek/deepseek-flash` 回合，首份有效答案 **109.298 秒**，**3 工具波次 / 7 回执**，正常保存退出。
- **产物**: `.kstudio/evidence/T2026-11-19-aster-architecture-tui-e2e/OUTCOME.md`；`docs/evidence/code/2026-11-19-aster-architecture-tui-e2e/OUTCOME.md`；`artifacts/tui-architecture-2026-11-19/{summary.json,independent-verification.json,final-answer.md,screens/}`
- **验证**: 事实日志 3 工具型 model.turn + 7 tool.result；命令全部只读；答案 9,679 字符；TUI 显示 `Worked for 1m43s`；退出含 `[进程已完成]`
- **限制**: TUI 累计 98.3k tokens，非单轮账单；持久化 usage 不可用；原摘要 `1m` 为解析截断，独立复核为 1m43s；单回合非 SLO / 答案等价审计 / 产品 Pass

## T2026-11-19-aster-tui-e2e

- **完成日期**: 2026-11-19
- **结果**: `/go` — 用最新配对 Aster TUI 完成确定性 PTY 与真实 Terminal 验收；修复预分析导致的两个测试夹具时序缺陷，无生产源码改动。真实 `HI` 首份有效答案 **8.501 秒 / 0 工具调用**，保存并退出进程。
- **产物**: `.kstudio/evidence/T2026-11-19-aster-tui-e2e/OUTCOME.md`；`docs/evidence/code/2026-11-19-aster-tui-e2e/OUTCOME.md`；`artifacts/tui-e2e-2026-11-19/{deterministic-summary.json,independent-verification.json,live-answer-history.txt,live-quit-history.txt,screens/}`
- **验证**: 三组确定性 TUI **70 通过 / 0 失败 / 1 忽略**；真实模型仅一次；退出截图含 `[进程已完成]`；ACP Clippy 与配套构建 exit 0；配对 BUILD_ID 一致
- **限制**: 原驱动 `quit_failed` 为退出判定假阴性，保留原文，由独立进程证据复核，未改判定或重烧模型；单回合非 SLO，token 为会话累计非账单；≠ 产品 Pass / Meta Done

## T2026-11-19-cutover-test-settlement

- **完成日期**: 2026-11-19
- **结果**: `/yolo` — 关闭 cutover 永久等待及后续独立失败；修正权限、包摘要、回执、目录、黄金值与退休竞态夹具；修复跨 Run 问题上限被全局 elicitation ID 冲突绕过的生产缺陷，双 Run 反例先红后绿。
- **产物**: `.kstudio/evidence/T2026-11-19-cutover-test-settlement/{OUTCOME.md,diagnosis.md}`；`docs/evidence/code/2026-11-19-cutover-test-settlement/OUTCOME.md`；`artifacts/kbox-real-comparison/evidence/core-lib-serial-final-2026-11-19.log`
- **验证**: 最终独占全量 Core lib **5975 通过 / 0 失败 / 33 忽略 / 608.96 秒**；capability-runtime 74/74；fact_log 87/87；FactControl 59/59；长任务 18/18；deep-live 包绑定 1/1；Clippy 与 Aster+ACP 构建 exit 0
- **限制**: `cargo fmt --all -- --check` 仅因原样保留既有 `terminal_bench_runner.rs` 改动而 exit 1；未调用真实模型，未做 Windows 原生验证；Core lib 绿 ≠ 产品 Pass / Meta Harness Done

## T2026-11-18-similarity-audit

- **完成日期**: 2026-11-18
- **结果**: `/go` — 同类审计新增两项真实权限缺陷并先红后绿修复：上层参数化 Allow 可见性、技能特判自身 Deny；补图片双向回归；纠正 host-disabled 的旧不安全期望。
- **产物**: `.kstudio/evidence/T2026-11-18-similarity-audit/{OUTCOME.md,audit.md}`；`docs/evidence/code/2026-11-18-similarity-audit/OUTCOME.md`
- **验证**: fact_log 87/87；nested 8/8；governed 9/9；history 29/29；safety 12/12；permissions 128/128；Clippy/构建 exit 0
- **限制**: 全 Core 未完成：cutover 用例独立运行超 120 秒无结算；未以 skip 冒充全量 Pass；≠ Meta Done

## T2026-11-18-fact-log-five-repairs

- **完成日期**: 2026-11-18
- **结果**: `/yolo` — 五项 `fact_log` 失败逐项隔离并关闭：辅助用量夹具、跨用户回合图片恢复、无授权工具投影、指令技能内容、运行期诊断夹具。
- **产物**: `.kstudio/evidence/T2026-11-18-fact-log-five-repairs/OUTCOME.md`；`docs/evidence/code/2026-11-18-fact-log-five-repairs/OUTCOME.md`
- **验证**: fact_log **87/87**；历史 28；直接权限 7；安全门 12；权限 128；阶段综合 4；Core Clippy/构建 exit 0
- **限制**: 两项为测试数据修正；未跑全 Core/真实供应商复测；≠ Meta Harness Done / 产品 Pass

## T2026-11-18-staged-read-only-synthesis

- **完成日期**: 2026-11-18
- **结果**: `/yolo` — 修复真实 FactRun 未接软门与 `--no-plan` 无意图输入；结构化只读意图 + 两波综合 + 一波具名缺口 + 空工具结算进入生产路径。
- **产物**: `.kstudio/evidence/T2026-11-18-staged-read-only-synthesis/{OUTCOME.md,review.md}`；`docs/evidence/code/2026-11-18-staged-read-only-synthesis/OUTCOME.md`
- **验证**: 生产 E2E 4/4；no_count 9/9；planning 57/57；pre_analysis 11/11；stream 19/19；Core/ACP Clippy exit 0；真实 kbox **272.282 秒首答**，5 波 / 12 次执行 / 126.7k 累计 tokens；真实 HI **19.4 秒 / 0 工具**
- **限制**: 单次真实切片，非普遍 SLO/答案质量审计；扩展 fact_log 82/5，五项当前失败保留；≠ Meta Harness Done / 产品 Pass

## T2026-11-18-kbox-real-tui-comparison

- **完成日期**: 2026-11-18
- **结果**: `/yolo` — 用最新 Core/TUI + `deepseek/deepseek-flash` 在原始 kbox 只读工作区完成前后对照；并行读取生效，但 **600 秒无有效答案，产品收敛未通过**。
- **产物**: `.kstudio/evidence/T2026-11-18-kbox-real-tui-comparison/OUTCOME.md`；`docs/evidence/code/2026-11-18-kbox-real-tui-comparison/OUTCOME.md`；`artifacts/kbox-real-comparison/`
- **验证**: 最终 after 13 个工具执行组 / 15 次调用 / TUI 累计 247.4k tokens；基线截图 736 秒无结算答案 / 累计 216.8k tokens；最终脚本化 E2E 2/2
- **限制**: 两侧均无首份有效答案，不能计算加速比；token 非单轮计费；无答案质量等价证明；未创建 kbox 副本；≠ Meta Harness Done / 产品 Pass

## T2026-11-18-read-only-delivery

- **完成日期**: 2026-11-18
- **结果**: `/yolo` — 只读分析链落地：能力门控并行读取、原生 explore 8 轮、交互式两波软综合提示、去重与 checkpoint 状态恢复。
- **产物**: `.kstudio/evidence/T2026-11-18-read-only-delivery/OUTCOME.md`；`docs/evidence/code/2026-11-18-read-only-delivery/OUTCOME.md`
- **验证**: 真实 AgentSession/文件工具/task 委托 E2E 2 项；no_count 9 项；Core/ACP 全目标 Clippy exit 0
- **限制**: 真实 kbox 对照 600 秒未收敛；无时延/token 改善或答案质量证明；≠ Meta Harness Done / 产品 Pass

## T2026-11-17-d1-d2-f2-honesty

- **完成日期**: 2026-11-17
- **结果**: `/yolo` — D1/D2/F2 诚实登记（known/intentional）。≠行为改。
- **产物**: `.kstudio/evidence/T2026-11-17-d1-d2-f2-honesty/OUTCOME.md`
- **验证**: audit + PROTOCOL/源码口径
- **限制**: ≠改 observe 线名；≠ Meta Done

## T2026-11-17-b1-b2-write-parallel-honesty

- **完成日期**: 2026-11-17
- **结果**: `/yolo` — B1/B2 诚实关闭（路径去重≠权限闸；异路径并发 by design）。≠行为改。
- **产物**: `.kstudio/evidence/T2026-11-17-b1-b2-write-parallel-honesty/OUTCOME.md`
- **验证**: `parallel_tool_runtime` 源码口径
- **限制**: ≠加全局写锁；≠ Meta Done

## T2026-11-17-tui913-hermetic-reconfirm2

- **完成日期**: 2026-11-17
- **结果**: tui_913_hermetic **11/11**。≠ headed。
- **产物**: `.kstudio/evidence/T2026-11-17-tui913-hermetic-reconfirm2/OUTCOME.md`
- **验证**: `cargo test -p aster-acp --test tui_913_hermetic`
- **限制**: ≠ Meta Done

## T2026-11-17-a7-fg-lease-honesty

- **完成日期**: 2026-11-17
- **结果**: `/yolo` — A7 记为 by-design（FG model `task` 继承父 run lease；host 用 `schedule_foreground`）。≠行为改。≠ Meta Done。
- **产物**: `.kstudio/evidence/T2026-11-17-a7-fg-lease-honesty/OUTCOME.md`
- **验证**: 源码注释 + `schedule_foreground` 分支
- **限制**: ≠改调度语义；≠ B1/B2

## T2026-11-17-unattended-e2e-yolo-reconfirm2

- **完成日期**: 2026-11-17
- **结果**: unattended_e2e **33/33** 再确认。≠ headed Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-unattended-e2e-yolo-reconfirm2/OUTCOME.md`
- **验证**: `cargo test -p aster-acp --test unattended_e2e`
- **限制**: ≠ Meta Done

## T2026-11-17-appview-280-slash-tip

- **完成日期**: 2026-11-17
- **结果**: `/yolo` — aster-pager `app_view` **280/280**（slash-gate `/init` + word-select tip 分歧断言）。≠ Meta Done。
- **产物**: `.kstudio/evidence/T2026-11-17-appview-280-slash-tip/OUTCOME.md`
- **验证**: app_view 280 passed
- **限制**: ≠ headed；≠ H2

## T2026-11-17-p7-experimental-call-site

- **完成日期**: 2026-11-17
- **结果**: `/yolo` — P7 `feature_switch_call_site_allowed`；Experimental/Removed 动态注册硬拒；hermetic×3。≠ Meta Done。
- **产物**: `.kstudio/evidence/T2026-11-17-p7-experimental-call-site/OUTCOME.md`
- **验证**: core feature_stage 2/2 · refuse 2/2 · hermetic p7×3 PASS
- **限制**: ≠全调用点接线；≠ Experimental opt-in；≠ Meta Done

## T2026-11-17-slash-gate-init

- **完成日期**: 2026-11-17
- **结果**: `/yolo` — `ASTER_EFFECTIVE_COMMANDS` 纳入 `init`；aster slash-gate 与可见 `/init` 对齐。≠ Meta Done。
- **产物**: `.kstudio/evidence/T2026-11-17-slash-gate-init/OUTCOME.md`
- **验证**: aster-pager `apply_aster_slash_gate_hides_unsupported_builtins` 1/1 · `slash_gate` 4/4
- **限制**: ≠ headed；≠ H2；≠全 slash/ACP 审计

## T2026-11-17-dsh-plugin-e2e

- **完成日期**: 2026-11-17
- **结果**: `/k-yolo` 命名范围 — 真实 `dsh` 0.2.2-rc.1 插件 **安装 / 使用 / 卸载** E2E（hermetic `$DSH_HOME` + 官方 bundle 形 fixture）。`run.sh` 可复跑 PASS。≠ Meta Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-dsh-plugin-e2e/OUTCOME.md`
- **验证**: `bash .kstudio/evidence/T2026-11-17-dsh-plugin-e2e/run.sh` → PASS；dump 层 / apply marker / 负向 boot
- **限制**: remove 后可能残留 `node_modules` symlink（层与运行时已卸）；未走 DeepSeek API；≠ cordis→Core；≠ Meta Done

## T2026-11-17-appview-arc-readme

- **完成日期**: 2026-11-17
- **结果**: `/go` — Appearance Arc 架构/写读路径 ASCII 图写入 `aster-pager/README.md`（与 README 既有 box 风格一致）。≠Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-appview-arc-readme/OUTCOME.md`
- **验证**: `git diff --check` README
- **限制**: ≠ HG2 Pass；≠ Meta Done

## T2026-11-17-appview-appearance-arc

- **完成日期**: 2026-11-17
- **结果**: HG2 — `AppView.appearance` 共享 `Arc<AppearanceConfig>`；会话路径 `set_appearance_arc` 不再深拷贝。≠高效关。
- **产物**: `.kstudio/evidence/T2026-11-17-appview-appearance-arc/OUTCOME.md`
- **验证**: aster-pager `app_view` 279 passed（跳过无关 slash-gate `/init`）
- **限制**: slash-gate 失败未修；≠ Meta Done；H2 仍 park

## T2026-11-17-headed-daily-use-park

- **完成日期**: 2026-11-17（park）
- **结果**: headed/daily-use Pass **park** — 需 Studio land 或显式脏树 headed 授权 + GUI oracle；hermetic 替代≠Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-headed-daily-use-park/OUTCOME.md`
- **验证**: unattended 33/33 · tui913 11/11（≠ headed）
- **限制**: 缺 Studio commit/push 或 headed 授权；≠ Meta Done

## T2026-11-17-e4-generate-object-stream

- **完成日期**: 2026-11-17
- **结果**: E4 — `generate_object` 流式省略上报 `discarded_bytes`/`stream_partial_omitted`（结果仍带全对象）。≠ E4 全关。
- **产物**: `.kstudio/evidence/T2026-11-17-e4-generate-object-stream/OUTCOME.md`
- **验证**: lib 1/1 · hermetic `hg2_e4_generate_object_stream` 1/1
- **限制**: ≠ Meta Done

## T2026-11-17-tui913-hermetic-reconfirm

- **完成日期**: 2026-11-17
- **结果**: `tui_913_hermetic` **11/11**。≠ headed Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-tui913-hermetic-reconfirm/OUTCOME.md`
- **验证**: `cargo test -p aster-acp --test tui_913_hermetic`
- **限制**: ≠ Meta Done；≠ GUI E2E

## T2026-11-17-efficient-e4-c1-pack

- **完成日期**: 2026-11-17
- **结果**: hermetic 高效/E4/C1 包 **7/7**（latency/discard/json/Arc/update_plan/bm25/confine）。≠Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-efficient-e4-c1-pack/OUTCOME.md`
- **验证**: verify-hermetic-perf-e2e.py ×7
- **限制**: ≠全 pack；≠ Meta Done

## T2026-11-17-e1-doc-drift-12mib

- **完成日期**: 2026-11-17
- **结果**: E1 文档漂移关闭 — audit 不再声称 wiki 仍写 4 MiB；与代码 12 MiB 一致。≠ E1 Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-e1-doc-drift-12mib/OUTCOME.md`
- **验证**: effect `MAX_RECORD_BYTES` · wiki P0-2「12 MiB」
- **限制**: ≠ Meta Done

## T2026-11-17-p7-protocol-feature-switch-stages

- **完成日期**: 2026-11-17
- **结果**: ACP `PROTOCOL.md` 叙述 `featureSwitches`/`featureSwitchStages`（HG1 可组合）。≠ Experimental 闸。
- **产物**: `.kstudio/evidence/T2026-11-17-p7-protocol-feature-switch-stages/OUTCOME.md`
- **验证**: PROTOCOL 章节存在；配合 `T2026-11-17-p7-feature-switch-stages`
- **限制**: ≠ Meta Done

## T2026-11-17-e4-bm25-query-discarded

- **完成日期**: 2026-11-17
- **结果**: E4 — BM25 回显查询预算上报 `query_discarded_chars`/`query_display_budget`。≠ E4 全关。
- **产物**: `.kstudio/evidence/T2026-11-17-e4-bm25-query-discarded/OUTCOME.md`
- **验证**: lib 1/1 · hermetic `hg2_e4_bm25_query_discarded` 1/1
- **限制**: ≠ Meta Done

## T2026-11-17-unattended-e2e-yolo-reconfirm

- **完成日期**: 2026-11-17
- **结果**: unattended_e2e hermetic **33/33** 复跑。≠日常 Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-unattended-e2e-yolo-reconfirm/OUTCOME.md`
- **验证**: verify-hermetic-perf-e2e.py `--suite unattended_e2e`
- **限制**: ≠ headed/live-provider Pass；≠ Meta Done

## T2026-11-17-hermetic-arc-e4-c1

- **完成日期**: 2026-11-17
- **结果**: hermetic pack 注册 Arc/E4/C1 三级 **3/3**。≠Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-hermetic-arc-e4-c1/OUTCOME.md`
- **验证**: verify-hermetic-perf-e2e.py ×3
- **限制**: 未重跑全 pack 默认清单

## T2026-11-17-e4-update-plan-discarded

- **完成日期**: 2026-11-17
- **结果**: E4 — `update_plan` 步骤截断上报 `discarded_chars`/`step_char_budget` 元数据。≠ E4 全关。
- **产物**: `.kstudio/evidence/T2026-11-17-e4-update-plan-discarded/OUTCOME.md`
- **验证**: `update_plan` lib 9/9
- **限制**: ≠ Meta Done；其它工具 E4 仍 partial

## T2026-11-17-p7-feature-switch-stages

- **完成日期**: 2026-11-17
- **结果**: P7 加深 — ACP `featureSwitchStages`；`sandbox.permission_profile`/`compaction.ledger` → Stable；`tools.patch_codes` 仍 Experimental。≠全量 Experimental 闸。
- **产物**: `.kstudio/evidence/T2026-11-17-p7-feature-switch-stages/OUTCOME.md`
- **验证**: feature_stage 2/2 · initialize admission 1/1 · hermetic P7×2（见 OUTCOME）
- **限制**: ≠ Meta Done；≠ call-site Experimental hard refuse

## T2026-11-17-c1-verify-stub-fail-closed

- **完成日期**: 2026-11-17
- **结果**: C1 诚实刀 — `aster-confine` `verify_*` 失败关闭（稳定 stub 文案）+ `is_enforcement_authority=false`。≠ OS 隔离 Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-c1-verify-stub-fail-closed/OUTCOME.md`
- **验证**: `cargo test -p aster-confine --lib` 2/2
- **限制**: stub 仍非执行权威；≠ Meta Done；H2 仍 park

## T2026-11-17-blockcontext-appearance-arc

- **完成日期**: 2026-11-17
- **结果**: HG2 — `BlockContext`/`ScrollbackState` 共享 `Arc<AppearanceConfig>`；热路径不再深拷贝外观树；`Arc::ptr_eq` 单测绿；hg2_pager_latency 1/1。≠高效关。
- **产物**: `.kstudio/evidence/T2026-11-17-blockcontext-appearance-arc/OUTCOME.md`
- **验证**: aster-pager lib：ptr_eq 1 · thinking 10 · preamble 4 · entry 24 · hermetic latency 1 · fmt
- **限制**: ≠ live latency Pass；≠ Meta Done；H2 仍 park

## T2026-11-17-hermetic-e2-e8-p7-p8

- **完成日期**: 2026-11-17
- **结果**: hermetic pack 注册 E2/E8/P7/P8 四级 **4/4**。≠Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-hermetic-e2-e8-p7-p8/OUTCOME.md`
- **验证**: verify-hermetic-perf-e2e.py ×4
- **限制**: 未重跑全 pack 默认清单

## T2026-11-17-efficient-yolo-reconfirm

- **完成日期**: 2026-11-17
- **结果**: HG2 efficient hermetic **4/4**（latency/json×2/discard）。≠高效关。
- **产物**: `.kstudio/evidence/T2026-11-17-efficient-yolo-reconfirm/OUTCOME.md`
- **验证**: verify-hermetic-perf-e2e.py
- **限制**: ≠Pass；≠ live 字段

## T2026-11-17-p7-feature-switch-enabled

- **完成日期**: 2026-11-17
- **结果**: P7 — `feature_switch_enabled`；`tools.parallel_task` **Removed**；ACP `featureSwitches`；动态注册拒绝 Removed 名。≠全量 Experimental 闸门。
- **产物**: `.kstudio/evidence/T2026-11-17-p7-feature-switch-enabled/OUTCOME.md`
- **验证**: feature_stage 2/2 · initialize 1/1 · dynamic refuse 1/1 · hermetic `hg2_p7_*`
- **限制**: ≠ Meta Done

## T2026-11-17-p8-permission-denial-code

- **完成日期**: 2026-11-17
- **结果**: P8 ACP permission denial 带稳定码 `permission.denied`（rawOutput）。≠Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-p8-permission-denial-code/OUTCOME.md`
- **验证**: `permission_denial_raw_output_carries_stable_code` 1/1
- **限制**: 尚未细分多种 denial 码；≠ Meta Done

## T2026-11-17-e2-empty-line-refuse

- **完成日期**: 2026-11-17
- **结果**: E2 effect log 中途空行 **fail-closed**（不再静默跳过）。≠Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-e2-empty-line-refuse/OUTCOME.md`
- **验证**: `empty_mid_file_line_refuses_the_whole_read` 1/1
- **限制**: ≠ Meta Done；不修复已损生产日志

## T2026-11-17-aster-eng-gitignore

- **完成日期**: 2026-11-17
- **结果**: `.gitignore` 允许跟踪 `.aster/` 工程标记，运行时（`config.acl`/sessions/memory）仍忽略。≠本仓 migrate。
- **产物**: `.kstudio/evidence/T2026-11-17-aster-eng-gitignore/OUTCOME.md`
- **验证**: `git check-ignore -q` 对照表
- **限制**: 未迁 `.kstudio/`→`.aster/`；≠Pass

## T2026-11-17-e8-compaction-failed-phase

- **完成日期**: 2026-11-17
- **结果**: E8 compaction ledger **Failed** 相 + ACP `auto_compact_failed`；attach 中途失败不再卡在 Started。≠Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-e8-compaction-failed-phase/OUTCOME.md`
- **验证**: `mid_flight_failure_leaves_failed_not_started` 1/1
- **限制**: soft post-target 仍 Ok；≠ Meta Done

## T2026-11-17-hg6-close

- **完成日期**: 2026-11-17
- **结果**: **HG6 关**（Q13：Core 内化自动触发 + hermetic/L3 证据齐）。≠产品 Pass；≠ Meta Harness Done。
- **产物**: `.kstudio/evidence/T2026-11-17-hg6-close/OUTCOME.md`
- **验证**: `hg2_kburn_*` 11 suites / 18 passed；`verify-ai-eng.py --level L3` PASS
- **限制**: 本仓现网仍 `.kstudio/`（`.aster/` 为 gitignore 运行时）；H2/headed park

## T2026-11-17-shipped-tui-launch-resume-reconfirm

- **完成日期**: 2026-11-17
- **结果**: `shipped_tui_launch_resume_and_visible_commands` **1/1** 复跑通过；先前写 marker 失败判为 flake，非 `/yolo` 技能/模式撞名。
- **产物**: `.kstudio/evidence/T2026-11-17-shipped-tui-launch-resume-reconfirm/OUTCOME.md`
- **验证**: cargo test shipped_tui_e2e filter · 91.57s
- **限制**: ≠headed Pass

## T2026-11-17-shipped-retrieval-hermetic

- **完成日期**: 2026-11-17
- **结果**: shipped retrieval stdio **3/3**。≠Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-shipped-retrieval-hermetic/`
- **验证**: semantic/hybrid/missing-assets
- **限制**: 非 live 检索质量战役

## T2026-11-17-shipped-tui-hermetic

- **完成日期**: 2026-11-17
- **结果**: shipped_tui hermetic 子集 **8/8**。≠headed Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-shipped-tui-hermetic/`
- **验证**: readiness/session_wire/identity/refuse/palette/pre_analysis
- **限制**: 未跑 real_llm / 交互全套

## T2026-11-17-unattended-e2e-reconfirm

- **完成日期**: 2026-11-17
- **结果**: ACP `unattended_e2e` 全套 **33/33**。≠可信硬目标关。
- **产物**: `.kstudio/evidence/T2026-11-17-unattended-e2e-reconfirm/OUTCOME.md`
- **验证**: 33 passed / 0 failed / 43.46s
- **限制**: 非 headed Studio；≠日常 Pass

## T2026-11-17-efficient-latency-reconfirm

- **完成日期**: 2026-11-17
- **结果**: pager latency + JSON hermetic **3/3**。≠高效关。
- **产物**: `.kstudio/evidence/T2026-11-17-efficient-latency-reconfirm/`
- **验证**: hg2_pager_latency / json_serialized_len / json_update_sha256
- **限制**: ≠Pass

## T2026-11-17-hg6-core-slice-review

- **完成日期**: 2026-11-17
- **结果**: HG6 **Core 内化切片** review-ready 清单（arm/`.aster`/裸技能/helpers/E2E/L3）；**≠ HG6 关**。
- **产物**: `.kstudio/evidence/T2026-11-17-hg6-core-slice-review/OUTCOME.md`
- **验证**: 见 OUTCOME 绿表；`kstudio::` 18
- **限制**: 本仓未迁 `.aster/`；H2/headed park

## T2026-11-17-h2-studio-land-park

- **完成日期**: 2026-11-17
- **结果**: H2 **park** — `studio_land_guard` dirty（需 Studio commit/push 授权）
- **产物**: `.kstudio/evidence/T2026-11-17-h2-studio-land-park/OUTCOME.md`
- **验证**: `studio_land_guard.py check` refused dirty
- **限制**: 未 commit/push Studio

## T2026-11-17-l3-bare-skills-gate

- **完成日期**: 2026-11-17
- **结果**: L3 闸门改认裸技能名；`verify-ai-eng.py --level L3` **PASS**。≠产品 Pass。
- **产物**: `.kstudio/workflow/verify-ai-eng.py`；证据 `T2026-11-17-l3-bare-skills-gate`
- **验证**: L3 PASS after; FAIL before (12 k- prefix)
- **限制**: L3≠产品 Pass

## T2026-11-17-efficient-hermetic-reconfirm

- **完成日期**: 2026-11-17
- **结果**: 高效轴 hermetic 复跑 discard/token + helpers **4/4**。≠高效硬目标关。
- **产物**: `.kstudio/evidence/T2026-11-17-efficient-hermetic-reconfirm/`
- **验证**: hg2_core_discard / acp_token / web_search_discard / kburn_workflow_helpers
- **限制**: 非 live 时延战役；≠Pass

## T2026-11-17-kburn-workflow-helpers

- **完成日期**: 2026-11-17
- **结果**: Core factory 内嵌 eng-root 可移植 `sitrep`/`progress-scan`/`sync-k-skills`/`print-paste`；materialize 种子；`/kburn` 报告 helpers。≠ HG6 关。
- **产物**: `factory/.../workflow/*`；`KSTUDIO_FACTORY_SEED_PATHS`；证据 `T2026-11-17-kburn-workflow-helpers`
- **验证**: materialize helpers 1；sitrep smoke `.aster/`；ACP coverage 1
- **限制**: 本仓现网仍用 `.kstudio/workflow/` 副本

## T2026-11-17-conductor-e2e

- **完成日期**: 2026-11-17
- **结果**: YOLO 命名范围「规划测试用例并完成端到端测试」— TESTPLAN C1–C10 + hermetic `hg2_kburn_*` **10/10**。≠产品 Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-conductor-e2e/{TESTPLAN,OUTCOME,hermetic-summary}.md|json`；`project.acl` 入 factory seeds；sitrep 裸技能名
- **验证**: `kstudio::` 17；hermetic 10 suites / 17 passed / 0 failed
- **限制**: 非 headed GUI；非 Meta Harness Done

## T2026-11-17-conductor-acl-bare-skills

- **完成日期**: 2026-11-17
- **结果**: 工程 `project.acl`（替 `.kcl`）；12 技能去 `k-`（`/init`…`/yolo`）；`skills.mdc`。≠产品 Pass。
- **产物**: `KBURN_SKILL_NAMES` 裸名；`.kstudio/skills/{init,…}`；factory/MANIFEST；证据 `T2026-11-17-conductor-acl-bare-skills`
- **验证**: `kstudio::` 17；ACP 4；`sync-k-skills.py --check` OK；`load-config.py` 读 `project.acl`
- **限制**: 历史 `T*-k-*` 证据目录未改名

## T2026-11-17-kburn-aster-root

- **完成日期**: 2026-11-17
- **结果**: Q14 更正 — 工程树规范 **`.aster/`**（非 `.aster/kstudio`）；遗留 `.kstudio/` 兼容；仅 `config.acl` 不 auto-arm；skill root 末位 `.aster/skills`。≠产品 Pass。
- **产物**: `kstudio::{canonical,legacy,aster_engineering_present}`；`agent_skill_roots`；`.kstudio/evidence/T2026-11-17-kburn-aster-root/OUTCOME.md`（supersedes nest）
- **验证**: `kstudio::` 17；skill roots 1；ACP materialize/order/watched；hermetic `hg2_kburn_aster_root` 1/1
- **限制**: 未迁移本仓现网 `.kstudio/` 目录

## T2026-11-17-kburn-auto-arm

- **完成日期**: 2026-11-17
- **结果**: Q13 — Core `arm_kburn_runtime` 会话自动触发（有工程根才 materialize+加载）；TUI/Studio UI 非目标。≠产品 Pass。
- **产物**: `kstudio::arm_kburn_runtime`；`capabilities::build_effective_skill_registry`；GOALS HG6；`.kstudio/evidence/T2026-11-17-kburn-auto-arm/OUTCOME.md`
- **验证**: arm 2 passed；session skill_dirs 2 passed
- **限制**: 无工程根不偷建；HG6 全关仍待证据齐

## T2026-11-17-kburn-p0-factory-bundle

- **完成日期**: 2026-11-17
- **结果**: Core 内嵌 kburn factory 子集 + `materialize_kstudio_factory_seeds`；ACP `/kburn materialize`。≠产品 Pass；≠ HG6。
- **产物**: `crates/code/core/src/kstudio/factory/`；`inspection_commands`；`.kstudio/evidence/T2026-11-17-kburn-p0-factory-bundle/OUTCOME.md`
- **验证**: Core bundled/materialize；ACP format_kburn_report_materialize；hermetic `hg2_kburn_materialize`+`hg2_kburn_factory_bundle` 2/2
- **限制**: 未嵌 12×SKILL 正文；Studio 未接；未跑满 hermetic-44 全量墙钟

## T2026-11-17-kburn-p1-slash

- **完成日期**: 2026-11-17
- **结果**: ACP `/kburn` 组合 Core coverage；命令表公布。≠产品 Pass；≠ HG6。
- **产物**: `inspection_commands.rs` · `commands.rs`；`.kstudio/evidence/T2026-11-17-kburn-p1-slash/OUTCOME.md`
- **验证**: format + hermetic `hg2_kburn_slash_coverage` 1/1
- **限制**: Studio UI 未做

## T2026-11-17-kburn-p0-readme-skip

- **完成日期**: 2026-11-17
- **结果**: 技能根旁路 `README.md` 等不再作候选；`.kstudio/skills` 整树加载无假 Parse 错。≠产品 Pass。
- **产物**: `skills/registry.rs`；`.kstudio/evidence/T2026-11-17-kburn-p0-readme-skip/OUTCOME.md`
- **验证**: `test_load_from_dir`；hermetic `hg2_kburn_readme_skip`
- **限制**: 仅列名 stem 跳过

## T2026-11-17-kburn-p0-layout-contract

- **完成日期**: 2026-11-17
- **结果**: Vendored layout v1 JSON + `kburn_skill_coverage` + ACP compose 测 + hermetic graders（pack 声明 37→41）。≠产品 Pass；≠ HG6。
- **产物**: `crates/code/core/src/kstudio/`；`scripts/verify-hermetic-perf-e2e.py`；`.kstudio/evidence/T2026-11-17-kburn-p0-layout-contract/OUTCOME.md`
- **验证**: Core `kstudio::` 9；hermetic kburn 4 suites
- **限制**: 未跑满 41 全量墙钟；工厂 skeleton 未 vendoring

## T2026-11-17-kburn-p0-skill-names

- **完成日期**: 2026-11-17
- **结果**: Core `KBURN_SKILL_NAMES`（12）+ `load_kburn_skills` + MANIFEST 读。≠产品 Pass；≠ HG6 关闭。
- **产物**: `crates/code/core/src/kstudio/`；`.kstudio/evidence/T2026-11-17-kburn-p0-skill-names/OUTCOME.md`；[Kburn-Aster-Absorption.md](Kburn-Aster-Absorption.md)
- **验证**: `cargo test -p aster-core --lib kstudio::`（后扩至 7+）
- **限制**: 未 vendoring SKILL 正文；宿主组合面未做

## T2026-11-17-kburn-p0-layout-dirs

- **完成日期**: 2026-11-17
- **结果**: Core `KstudioCoreDirs` layout-v1 默认路径 API。≠产品 Pass。
- **产物**: `kstudio.rs`；`.kstudio/evidence/T2026-11-17-kburn-p0-layout-dirs/OUTCOME.md`
- **验证**: layout + skill-root align 2 passed（后并入 kstudio:: 4）
- **限制**: 未嵌工厂资产 / schema 校验器

## T2026-11-17-kburn-p0-kstudio-skill-root

- **完成日期**: 2026-11-17
- **结果**: `.kstudio/skills` 进 `agent_skill_roots`（末位）+ ACP watch/load。kburn P0-1。≠产品 Pass。
- **产物**: `skills/mod.rs`；`acp/agent.rs` + tests；`.kstudio/evidence/T2026-11-17-kburn-p0-kstudio-skill-root/OUTCOME.md`
- **验证**: Core 2 + ACP project_kstudio/workspace/watched 各 1 passed
- **限制**: ≠ HG6 全关闭

## T2026-11-17-h7-cancel-bg-toast

- **完成日期**: 2026-11-17
- **结果**: CancelComplete 时若仍有 Running bg_tasks 则 toast 诚实提示。≠产品 Pass。
- **产物**: `dispatch/task_result.rs`；`.kstudio/evidence/T2026-11-17-h7-cancel-bg-toast/OUTCOME.md`
- **验证**: `cancel_complete_toasts_when_background_tasks_still_run` 1 passed
- **限制**: 未改 soft-Stop 不杀 bg 策略

## T2026-11-17-a4-skill-override-report

- **完成日期**: 2026-11-17
- **结果**: `SkillLoadReport.overrides` 可枚举同名后写覆盖（later-wins 不变）。≠产品 Pass。
- **产物**: `skills/registry.rs`；`.kstudio/evidence/T2026-11-17-a4-skill-override-report/OUTCOME.md`
- **验证**: `test_load_from_dir_duplicate_name_overrides_previous_definition` 1 passed
- **限制**: 未改信任序

## T2026-11-17-hermetic-34-tui-chrome

- **完成日期**: 2026-11-17
- **结果**: hermetic pack +3 chrome graders（`hg2_tui_*` / `hg2_acp_stream_start_meta`）；三套单独跑 3/0。pack 31→34。≠产品 Pass。
- **产物**: `scripts/verify-hermetic-perf-e2e.py`；`.kstudio/evidence/T2026-11-17-hermetic-34-tui-chrome/OUTCOME.md`
- **验证**: 三 suite exit 0
- **限制**: 本 OUTCOME 未跑满 34 套全量墙钟

## T2026-11-17-a5-nested-task-deny

- **完成日期**: 2026-11-17
- **结果**: scoped_tools 名 `task` 硬拒绝（A5）。≠产品 Pass。
- **产物**: `tools/task.rs`；`.kstudio/evidence/T2026-11-17-a5-nested-task-deny/OUTCOME.md`
- **验证**: `scoped_tools_reject_nested_task_name` 1 passed
- **限制**: MCP 其它别名未扫

## T2026-11-17-headers-timeout-meta

- **完成日期**: 2026-11-17
- **结果**: ACP meta 打 `streamHeadersTimeoutMs`（默认仍 120s）。≠产品 Pass。
- **产物**: `llm/http.rs` · `emit.rs`；`.kstudio/evidence/T2026-11-17-headers-timeout-meta/OUTCOME.md`
- **验证**: `notification_meta_stamps_turn_and_stream_start_ms` 含该键
- **限制**: pager UI 未渲染该字段

## T2026-11-17-tui-first-token-chrome

- **完成日期**: 2026-11-17
- **结果**: 简单 prompt 发出后立即 Thinking chrome；ACP 打 `streamStartMs`/`turnStartMs`；回合开始 meta-only thought。≠产品 Pass。
- **产物**: `aster-pager` start_turn/tracker；`aster-acp` emit/protocol；`.kstudio/evidence/T2026-11-17-tui-first-token-chrome/OUTCOME.md`
- **验证**: `first_stream_start_pre_creates_thinking` · `start_turn_pre_creates_thinking_chrome` · `notification_meta_stamps_turn_and_stream_start_ms` 各 1 passed
- **限制**: headed/live 慢模型 E2E 未跑；未改 headers 120s 默认；≠ Meta Harness Done

## T2026-11-17-hermetic-31-h6-grader

- **完成日期**: 2026-11-17
- **结果**: hermetic pack **31/262/0**（+`hg2_h6_toolcallid`）。≠产品 Pass。
- **产物**: `scripts/verify-hermetic-perf-e2e.py`；`.kstudio/evidence/T2026-11-17-hermetic-31-h6-grader/OUTCOME.md`
- **验证**: full pack failed_suites []
- **限制**: named YOLO ≠Done

## T2026-11-17-hermetic-30-reconfirm

- **完成日期**: 2026-11-17
- **结果**: hermetic-perf-e2e **30 套 261/0**（含 `hg2_shell_merge_meta`）。≠产品 Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-hermetic-30-reconfirm/OUTCOME.md`
- **验证**: `python3 scripts/verify-hermetic-perf-e2e.py` → failed_suites []
- **限制**: named YOLO ≠Done

## T2026-11-17-h6-tooluseid-plumb

- **完成日期**: 2026-11-17
- **结果**: H5/H6 — ACP spawn parent `toolCallId` 进 wire；Studio 映射 `toolUseId`；修正 `subagent_type`→`taskType`/`subagentType` 错位，board↔footer 可去重。≠产品 Pass。
- **产物**: `crates/code/acp/src/agent/{rs,turn,emit,attempt}.rs`；`apps/studio/src-tauri/.../stream.rs`；`AgentSessionBackgroundTasks.tsx`；`.kstudio/evidence/T2026-11-17-h6-tooluseid-plumb/OUTCOME.md`
- **验证**: `emit::tests::subagent_finished_wire_copies_parent_tool_call_id` ok；`usage_meta_tests::spawn_parent_tools…` ok；Studio `cargo check --lib` Finished
- **限制**: Studio 全量 lib test 仍缺 fixture；H2 push/gitlink park；headed GUI 未跑；named YOLO ≠Done

## T2026-11-16-porcelain-sha-json-feed

- **完成日期**: 2026-11-16
- **结果**: porcelain stamp/entry digest 流式写入 Sha256，免 `to_vec`。≠产品 Pass。
- **产物**: `porcelain.rs`；`.kstudio/evidence/T2026-11-16-porcelain-sha-json-feed/OUTCOME.md`
- **验证**: porcelain **59/0**
- **限制**: named YOLO ≠Done

## T2026-11-16-batch-ref-borrow-walk

- **完成日期**: 2026-11-16
- **结果**: batch `$ref` 路径借用 walk，仅叶节点 clone。≠产品 Pass。
- **产物**: `batch.rs`；`.kstudio/evidence/T2026-11-16-batch-ref-borrow-walk/OUTCOME.md`
- **验证**: batch **27/0**
- **限制**: named YOLO ≠Done

## T2026-11-16-grep-discarded-items

- **完成日期**: 2026-11-16
- **结果**: grep search meta `discarded_items`（完整=0；截断=null）。≠ E4 Done。
- **产物**: `grep.rs`；`.kstudio/evidence/T2026-11-16-grep-discarded-items/OUTCOME.md`
- **验证**: grep **21/0**
- **限制**: named YOLO ≠Done

## T2026-11-16-registry-schema-fingerprint

- **完成日期**: 2026-11-16
- **结果**: tool schema 校验一次 `to_writer` 同时计长度+指纹，免 `Vec`。≠产品 Pass。
- **产物**: `tools/registry.rs`；`.kstudio/evidence/T2026-11-16-registry-schema-fingerprint/OUTCOME.md`
- **验证**: registry **22/0**
- **限制**: named YOLO ≠Done

## T2026-11-16-effect-log-json-len

- **完成日期**: 2026-11-16
- **结果**: effect `byte_limit_diagnostic` 免 `to_vec` 计字节。≠产品 Pass。
- **产物**: `crates/effect/src/log.rs`；`.kstudio/evidence/T2026-11-16-effect-log-json-len/OUTCOME.md`
- **验证**: aster-effect log **50/0**（1 ignored）
- **限制**: named YOLO ≠Done

## T2026-11-16-acp-progress-move

- **完成日期**: 2026-11-16
- **结果**: `subagent_finished_update` 按值拿走 ChildProgress，command/disposition move 进 wire。≠产品 Pass。
- **产物**: `emit.rs` · `agent.rs`；`.kstudio/evidence/T2026-11-16-acp-progress-move/OUTCOME.md`
- **验证**: bash_terminal_events **1/0**
- **限制**: named YOLO ≠Done

## T2026-11-16-hermetic-28-stream-snapshot

- **完成日期**: 2026-11-16
- **结果**: hermetic +`hg2_stream_toolcall_snapshot`（28 套）。≠ HG2 Pass。
- **产物**: `streaming.rs`；`scripts/verify-hermetic-perf-e2e.py`；`.kstudio/evidence/T2026-11-16-hermetic-28-stream-snapshot/OUTCOME.md`
- **验证**: suite **1/0**
- **限制**: named YOLO ≠Done

## T2026-11-16-hermetic-27-web-search-discard

- **完成日期**: 2026-11-16
- **结果**: hermetic +`hg2_web_search_discard`（27 套）。≠ HG2 Pass。
- **产物**: `scripts/verify-hermetic-perf-e2e.py`；web_search tests；`.kstudio/evidence/T2026-11-16-hermetic-27-web-search-discard/OUTCOME.md`
- **验证**: suite **1/0**；full 见 STATUS
- **限制**: named YOLO ≠Done

## T2026-11-16-json-serialized-len

- **完成日期**: 2026-11-16
- **结果**: `json_serialized_len` 扩到 web_search/ACP/batch/porcelain/gemini/generate_object/task/structured；hermetic **26 套 257/0**。≠产品 Pass。
- **产物**: `byte_budget.rs` + 上述调用点；`.kstudio/evidence/T2026-11-16-json-serialized-len/OUTCOME.md`
- **验证**: hg2 **1/0**；batch **27/0**；gemini **21/0**；structured **123/0**；full pack **26/257/0**
- **限制**: named YOLO ≠Done

## T2026-11-16-hermetic-25-cancel-banner

- **完成日期**: 2026-11-16
- **结果**: hermetic pack +`hg2_cancel_banner_line`（25 套 **256/0**）。≠ HG2 Pass。
- **产物**: `scripts/verify-hermetic-perf-e2e.py`；`.kstudio/evidence/T2026-11-16-hermetic-25-cancel-banner/OUTCOME.md`
- **验证**: suite **1/0**；full pack **25/256/0**
- **限制**: named YOLO ≠Done

## T2026-11-16-stream-toolcall-get-mut

- **完成日期**: 2026-11-16
- **结果**: streaming `apply_tool_call_snapshot` 用 get_mut，免 bound 三元组 clone+reinsert。≠产品 Pass。
- **产物**: `llm/openai/streaming.rs`；`.kstudio/evidence/T2026-11-16-stream-toolcall-get-mut/OUTCOME.md`
- **验证**: empty_name_tests **8/0**
- **限制**: named YOLO ≠Done

## T2026-11-16-web-search-discarded

- **完成日期**: 2026-11-16
- **结果**: web_search JSON `discarded_chars` + meta `discarded_items`。≠ E4 Done。
- **产物**: `web_search.rs`；`.kstudio/evidence/T2026-11-16-web-search-discarded/OUTCOME.md`
- **验证**: json_search_result_bounds **1/0**
- **限制**: named YOLO ≠Done

## T2026-11-16-bm25-discarded-items

- **完成日期**: 2026-11-16
- **结果**: BM25 candidate meta 加 `discarded_items`。≠ E4 Done。
- **产物**: `bm25/mod.rs`；`.kstudio/evidence/T2026-11-16-bm25-discarded-items/OUTCOME.md`
- **验证**: bm25 **17/0**；hermetic **24 套 255/0**
- **限制**: named YOLO ≠Done

## T2026-11-16-hermetic-hg2-read-batch-fit-len

- **完成日期**: 2026-11-16
- **结果**: hermetic pack +`hg2_read_batch_fit_len`（24 套）。≠ HG2 Pass。
- **产物**: `scripts/verify-hermetic-perf-e2e.py`；`.kstudio/evidence/T2026-11-16-hermetic-hg2-lib-suites/OUTCOME.md`
- **验证**: suite **1/0**
- **限制**: named YOLO ≠Done

## T2026-11-16-search-snippet-discarded-chars

- **完成日期**: 2026-11-16
- **结果**: SourceSnippet + hybrid/semantic meta 加 `discarded_chars`。≠ E4 Done。
- **产物**: `search_snippet.rs`；`.kstudio/evidence/T2026-11-16-search-snippet-discarded-chars/OUTCOME.md`
- **验证**: search_snippet 5；hybrid/semantic 见 OUTCOME
- **限制**: named YOLO ≠Done

## T2026-11-16-tui-cancel-banner-line

- **完成日期**: 2026-11-16
- **结果**: `CancelledBy::banner_line` 静态臂；estimate/message 免拼 period String。≠产品 Pass。
- **产物**: `cancel_cause.rs`；`.kstudio/evidence/T2026-11-16-tui-cancel-banner-line/OUTCOME.md`
- **验证**: aster-pager cancel+hg2 **6/0**；hermetic **23 套 254/0**
- **限制**: BlockContext Arc 仍 park；named YOLO ≠Done

## T2026-11-16-hermetic-hg2-lib-suites

- **完成日期**: 2026-11-16
- **结果**: hermetic pack 纳入 3 个 HG2 lib grader（core discard · acp token · pager latency）。套件 **20→23**。≠ HG2 Pass。
- **产物**: `scripts/verify-hermetic-perf-e2e.py`；`.kstudio/evidence/T2026-11-16-hermetic-hg2-lib-suites/OUTCOME.md`
- **验证**: 3 lib suites **3/0**
- **限制**: named YOLO ≠Done；HG2 graders ≠ HG2 Pass

## T2026-11-16-plan-replay-running-fail-closed

- **完成日期**: 2026-11-16
- **结果**: plan replay 测例对齐 resume 对 checkpoint-running 子任务 fail-closed→stopped；transcript replay 走 prepared_raw_input。≠产品 Pass。
- **产物**: `plan_replay_tests.rs` · `extensions.rs`；`.kstudio/evidence/T2026-11-16-plan-replay-running-fail-closed/OUTCOME.md`
- **验证**: extensions::plan_replay **4/0**
- **限制**: named YOLO ≠Done

## T2026-11-16-read-batch-fit-len

- **完成日期**: 2026-11-16
- **结果**: batch 预算探测改 length-only，免每次 binary-search clone segments。≠产品 Pass。
- **产物**: `tools/builtin/read.rs`；`.kstudio/evidence/T2026-11-16-read-batch-fit-len/OUTCOME.md`
- **验证**: batch_response_len_matches 1；batch_tests 8；hermetic subset tui_913+unattended **44/0**
- **限制**: named YOLO ≠Done

## T2026-11-16-deserialize-migration-acp

- **完成日期**: 2026-11-16
- **结果**: migration / document_read / plugin_mcp / session_snapshot / event_protocol / inspection `deserialize(&Value)` 免 clone。≠产品 Pass。
- **产物**: `.kstudio/evidence/T2026-11-16-deserialize-migration-acp/OUTCOME.md`
- **验证**: core 16 · acp 35/0 (2 ignored)；hermetic **20 套 251/0**
- **限制**: named YOLO ≠Done；%≠Pass

## T2026-11-16-read-batch-discarded

- **完成日期**: 2026-11-16
- **结果**: read 单页 + batch meta 加 `discarded_bytes`/`discarded_items`（E4）。≠ E4 Done。
- **产物**: `tools/builtin/read.rs`；`.kstudio/evidence/T2026-11-16-read-batch-discarded/OUTCOME.md`
- **验证**: read batch/line_endings 12；hermetic **251/0**
- **限制**: named YOLO ≠Done

## T2026-11-16-artifact-discarded-bytes

- **完成日期**: 2026-11-16
- **结果**: 共享 tool-output artifact meta 加 `discarded_bytes`。≠ E4 Done / named YOLO Done。
- **产物**: `tools/mod.rs`；`.kstudio/evidence/T2026-11-16-artifact-discarded-bytes/OUTCOME.md`
- **验证**: registry::tests 71；hermetic 17 套 **246/0**
- **限制**: %≠Pass

## T2026-11-16-page-discarded-items

- **完成日期**: 2026-11-16
- **结果**: 共享 `Page::metadata` 加 `discarded_items`（glob/ls/grep 分页）。≠ E4 Done / named YOLO Done。
- **产物**: `pagination.rs`；`.kstudio/evidence/T2026-11-16-page-discarded-items/OUTCOME.md`
- **验证**: pagination 6 · glob 8 · ls 6
- **限制**: %≠Pass

## T2026-11-16-program-discarded-bytes

- **完成日期**: 2026-11-16
- **结果**: program/PTC host-tool 结果与 call receipt 暴露 discarded 字节。≠ E4 Done / named YOLO Done。
- **产物**: `program_tool.rs`；`.kstudio/evidence/T2026-11-16-program-discarded-bytes/OUTCOME.md`
- **验证**: program_tool::tests 39；hermetic tui_913+unattended 44/0（前序 bg/task 后）
- **限制**: %≠Pass

## T2026-11-16-batch-meta-discarded

- **完成日期**: 2026-11-16
- **结果**: batch `compact_child_metadata` 加 `discarded_bytes`。≠ E4 Done / named YOLO Done。
- **产物**: `batch.rs`；`.kstudio/evidence/T2026-11-16-batch-meta-discarded/OUTCOME.md`
- **验证**: compact_child_metadata 2
- **限制**: %≠Pass

## T2026-11-16-bg-task-discarded-bytes

- **完成日期**: 2026-11-16
- **结果**: background capture + task/parallel-task meta 暴露 `discarded_bytes`。≠ E4 Done / named YOLO Done。
- **产物**: `background.rs` · `task/result_projection.rs`；`.kstudio/evidence/T2026-11-16-bg-task-discarded-bytes/OUTCOME.md`
- **验证**: compact/format task 3 · background::tests 29
- **限制**: grep/read 等仍可能缺 discard；%≠Pass

## T2026-11-16-command-summary-discarded

- **完成日期**: 2026-11-16
- **结果**: `CommandOutputSummary::discarded_bytes()`；bash meta 调用。≠ E4 Done。
- **产物**: `workspace/mod.rs`；`.kstudio/evidence/T2026-11-16-command-summary-discarded/OUTCOME.md`
- **验证**: shared_budgets / tool_capture_discard / output_deltas_coalesce
- **限制**: named YOLO ≠Done

## T2026-11-16-web-fetch-discarded-chars

- **完成日期**: 2026-11-16
- **结果**: WebFetch range meta 加 `discarded_chars`。≠ E4 Done / named YOLO Done。
- **产物**: `web_fetch.rs`；`.kstudio/evidence/T2026-11-16-web-fetch-discarded-chars/OUTCOME.md`
- **验证**: content_range_stops ok
- **限制**: 其它工具仍可能缺 discard 字段

## T2026-11-16-git-diff-discarded-bytes

- **完成日期**: 2026-11-16
- **结果**: Git diff 分页 meta 加 `discarded_bytes`（共享 byte_budget）。≠ E4 Done / named YOLO Done。
- **产物**: `git.rs`；`.kstudio/evidence/T2026-11-16-git-diff-discarded-bytes/OUTCOME.md`
- **验证**: test_diff_is_utf8_safe ok
- **限制**: 其它工具仍可能缺 discarded 字段

## T2026-11-16-acp-deserialize-borrow

- **完成日期**: 2026-11-16
- **结果**: ACP permissionRules / plugin / knowledgeCompile / office / wiki / output_check `deserialize` 免 clone。≠产品 Pass。
- **产物**: `.kstudio/evidence/T2026-11-16-acp-deserialize-borrow/OUTCOME.md`
- **验证**: permission 9 · host 15 · plugin 14 · wiki 9 · output_check 10 · office_ 40；hermetic tui_913 11 + conf 15
- **限制**: named YOLO ≠Done

## T2026-11-16-tui-sent-message-widths

- **完成日期**: 2026-11-16
- **结果**: TUI `estimate_line_widths` 穷尽含 SentMessage 借 text。≠产品 Pass。
- **产物**: `.kstudio/evidence/T2026-11-16-tui-sent-message-widths/OUTCOME.md`
- **验证**: estimate_line_widths_borrows_subagent ok
- **限制**: named YOLO ≠Done

## T2026-11-16-deserialize-args-borrow

- **完成日期**: 2026-11-16
- **结果**: task/transcript/observation 热路径 `deserialize(&Value)` 免 clone；A1 并行 schema 测例改不同 prompt；unattended fixture race harden。≠ named YOLO Done。
- **产物**: `task.rs` · `transcript.rs` · `unattended_e2e.rs`；`.kstudio/evidence/T2026-11-16-deserialize-args-borrow/OUTCOME.md`
- **验证**: parallel_isolates_schema 1 · external_observation 15 · transcript 11 · unattended **33/0**
- **限制**: %≠Pass

## T2026-11-16-hg2-discard-freeze

- **完成日期**: 2026-11-16
- **结果**: HG2 discard freeze grader（4096/8→4088 等）。≠ HG2 Pass / named YOLO Done。
- **产物**: `byte_budget.rs`；`.kstudio/evidence/T2026-11-16-hg2-discard-freeze/OUTCOME.md`
- **验证**: hg2_discard_freeze_grader 1；hermetic 20 套 **251/0**
- **限制**: %≠Pass

## T2026-11-16-porcelain-paths-discarded

- **完成日期**: 2026-11-16
- **结果**: porcelain `changed_paths` 截断时暴露 `changed_paths_discarded`。≠ named YOLO Done。
- **产物**: `porcelain.rs`；`.kstudio/evidence/T2026-11-16-porcelain-paths-discarded/OUTCOME.md`
- **验证**: porcelain::receipt_tests 39；hermetic 20 套 **251/0**
- **限制**: %≠Pass

## T2026-11-16-search-discarded-items

- **完成日期**: 2026-11-16
- **结果**: semantic/hybrid `bounded_results` 暴露 `discarded_items`。≠ E4 Done / named YOLO Done。
- **产物**: `search_snippet.rs`；`.kstudio/evidence/T2026-11-16-search-discarded-items/OUTCOME.md`
- **验证**: search_snippet 5；tui+conf 26/0
- **限制**: %≠Pass

## T2026-11-16-tui-session-event-widths

- **完成日期**: 2026-11-16
- **结果**: SessionEvent estimate 多静态/借用臂（含 DiskFull），减 `message()` String。≠ named YOLO Done。
- **产物**: `block.rs`；`.kstudio/evidence/T2026-11-16-tui-session-event-widths/OUTCOME.md`
- **验证**: estimate_line_widths 4；hermetic 19 套 **250/0**
- **限制**: %≠Pass

## T2026-11-16-hermetic-perf-e2e-runner

- **完成日期**: 2026-11-16
- **结果**: 冻结 hermetic 包 runner（`--no-run`→`just build`→run 防 BUILD_ID）；`just hermetic-perf-e2e` **20 套**。≠ named YOLO Done。
- **产物**: `scripts/verify-hermetic-perf-e2e.py`；`justfile`；`.kstudio/evidence/T2026-11-16-hermetic-perf-e2e-runner/`
- **验证**: summary.json **251/0**（+memory_management · consumer_deny · startup_error · plugin · codex · …；boundary/v912 未入包）
- **限制**: headed/live / e_bash 仍 park；%≠Pass

## T2026-11-16-stream-meta-take

- **完成日期**: 2026-11-16
- **结果**: OpenAI stream Done meta `mem::take` provider/model/url，免二次 clone。≠产品 Pass。
- **产物**: `streaming.rs`；`.kstudio/evidence/T2026-11-16-stream-meta-take/OUTCOME.md`
- **验证**: openai::tests 54
- **限制**: named YOLO ≠Done

## T2026-11-16-hg2-token-latency-freeze

- **完成日期**: 2026-11-16
- **结果**: HG2 可复跑 **token**（usage wire）+ **latency**（estimate widths）freeze graders；TUI Subagent/Btw/SessionEvent estimate borrow。≠ HG2 Pass / named YOLO Done。
- **产物**: `turn.rs` · `block.rs`/`entry.rs`；`.kstudio/evidence/T2026-11-16-hg2-token-latency-freeze/OUTCOME.md`
- **验证**: acp hg2_token_freeze 1 · pager estimate_line_widths 4
- **限制**: hermetic grader ≠ 生产 SLO；headed/live 仍 park

## T2026-11-16-fact-deserialize-borrow-2

- **完成日期**: 2026-11-16
- **结果**: fact_reads / history_seed / refusal / receipts 热路径 `deserialize(&Value)` 免 payload clone。≠产品 Pass。
- **产物**: `.kstudio/evidence/T2026-11-16-fact-deserialize-borrow-2/OUTCOME.md`
- **验证**: recorded_tool 2 · refusal_cycle 17
- **限制**: named YOLO ≠Done

## T2026-11-16-hg2-waste-knife-ledger

- **完成日期**: 2026-11-16
- **结果**: HG2 近端「浪费/alloc 关闭刀」台账 + hermetic 包计数；后续已补 token/latency freeze graders（见上条）。
- **产物**: `.kstudio/evidence/T2026-11-16-hg2-waste-knife-ledger/OUTCOME.md`
- **验证**: 见 OUTCOME 表（tui_913 11 / unattended 33 / LH 75·68 / conformance 15）
- **限制**: 台账本身 ≠ Pass

## T2026-11-16-end-text-conditional-clone

- **完成日期**: 2026-11-16
- **结果**: ACP End 仅在需再 emit 时 clone `text`；`message_from_fact` deserialize 免 payload clone。≠产品 Pass。
- **产物**: `turn.rs`；`fact_reads.rs`；`.kstudio/evidence/T2026-11-16-end-text-conditional-clone/OUTCOME.md`
- **验证**: compaction_transcript ok；conformance 15
- **限制**: named YOLO ≠Done

## T2026-11-16-stream-tool-args-take

- **完成日期**: 2026-11-16
- **结果**: **尝试后回退** — Start 时 `take(entry.2)` 会掏空 `[DONE]` finalize 的 ToolUse args，导致 tui_913 multi-turn 超时；已恢复 clone。证据保留教训。≠产品 Pass。
- **产物**: `.kstudio/evidence/T2026-11-16-stream-tool-args-take/OUTCOME.md`
- **验证**: 回退后 `three_turns_fix…` ok
- **限制**: 安全 take 需第二套累加器

## T2026-11-16-stream-finalize-take

- **完成日期**: 2026-11-16
- **结果**: OpenAI `[DONE]`/无 DONE finalize `take` tool_calls/usage/response ids。≠产品 Pass。
- **产物**: `streaming.rs`；`.kstudio/evidence/T2026-11-16-stream-finalize-take/OUTCOME.md`
- **验证**: openai tests 54 绿；tui_913 one_turn smoke ok
- **限制**: named YOLO ≠Done

## T2026-11-16-tool-end-output-take

- **完成日期**: 2026-11-16
- **结果**: tool completion `mem::take` 工具输出；ToolEnd 仅在有 event channel 时 clone。≠产品 Pass。
- **产物**: `tool_completion_runtime.rs`；`.kstudio/evidence/T2026-11-16-tool-end-output-take/OUTCOME.md`
- **验证**: tool_completion 26 绿；bg settle ok
- **限制**: named YOLO ≠Done

## T2026-11-16-receipt-deserialize-borrow

- **完成日期**: 2026-11-16
- **结果**: checkpoint/refusal/history_seed 收据解析 `deserialize(&Value)` 免 `Value` clone。≠产品 Pass。
- **产物**: `checkpoints.rs`；`refusal.rs`；`history_seed.rs`；`.kstudio/evidence/T2026-11-16-receipt-deserialize-borrow/OUTCOME.md`
- **验证**: `both_adapters_ordinary_checkpoint` ok
- **限制**: named YOLO ≠Done

## T2026-11-16-sse-hold-blank-cr

- **完成日期**: 2026-11-16
- **结果**: SSE 截断空白 trailing `\r` 直至下一字节/EOF；修 `streaming_split_cr_does_not_emit_partial_event`（HEAD 既有红）。≠产品 Pass。
- **产物**: `sse.rs`；`sse_tests.rs`；`.kstudio/evidence/T2026-11-16-sse-hold-blank-cr/OUTCOME.md`
- **验证**: sse 相关绿；`streaming_split_cr` ok；`streaming_crlf_data_frame` ok
- **限制**: named YOLO / Meta Harness ≠Done

## T2026-11-16-tui-tool-body-widths

- **完成日期**: 2026-11-16
- **结果**: Read/ListDir/Other/Skill/WebFetch/BgTask estimate 借 body `&str`。≠产品 Pass。
- **产物**: `aster-pager` `block.rs`；`.kstudio/evidence/T2026-11-16-tui-tool-body-widths/OUTCOME.md`
- **验证**: `estimate_line_widths_borrows` 2 绿
- **限制**: BlockContext Arc 仍 park

## T2026-11-16-e4-yielded-compaction-freeze

- **完成日期**: 2026-11-16
- **结果**: `turn.yielded` 与 compaction append 走 `read_freeze`；yielded 补 `log_cut`/`log_byte_len`。≠产品 Pass。
- **产物**: `turn_facts.rs`；`fact_reads.rs`；`.kstudio/evidence/T2026-11-16-e4-yielded-compaction-freeze/OUTCOME.md`
- **验证**: bg_subagent 5 · compact source_guard 4 · conformance 15
- **限制**: 全 E4 catalog / headed 未宣称

## T2026-11-16-acp-id-arcstr

- **完成日期**: 2026-11-16
- **结果**: Permission/replay/commands 路径 `ToolCallId`/`SessionId` 直接 `&str`→`Arc<str>`。≠产品 Pass。
- **产物**: `permission_ask.rs`；`extensions.rs`；`commands.rs`；`.kstudio/evidence/T2026-11-16-acp-id-arcstr/OUTCOME.md`
- **验证**: permission_ask HITL ok；conformance 15
- **限制**: 非 wire 变更

## T2026-11-16-tui-single-field-widths

- **完成日期**: 2026-11-16
- **结果**: Stub/UserPrompt/System/ContextInfo `estimate_line_widths` 借字段 `&str`，免 searchable join clone。≠产品 Pass。
- **产物**: `aster-pager` `block.rs`/`entry.rs`；`.kstudio/evidence/T2026-11-16-tui-single-field-widths/OUTCOME.md`
- **验证**: focused pager 3 绿
- **限制**: BlockContext Arc 仍 park

## T2026-11-16-perf-e2e-pack

- **完成日期**: 2026-11-16
- **结果**: Core/ACP/TUI 性能刀一批（emit-move · equal-meta · bash-slim · read_freeze · merge_stream owned · TUI line-widths 等）+ hermetic E2E：`tui_913` 11/11、long_horizon 75/68、unattended 33、acp_conformance 15。≠产品 Pass / named YOLO Done。
- **产物**: `.kstudio/evidence/T2026-11-16-perf-e2e-pack/OUTCOME.md`；同族 `T2026-11-16-{acp-emit-move,shell-equal-meta-merge,bash-delta-slim,e4-filelog-read-freeze,merge-stream-owned,p6-bg-settlement-twin,e4-yielded-compaction-freeze,acp-id-arcstr,tui-single-field-widths,…}`
- **验证**: 见 OUTCOME 表；paired `just build` + `ASTER_*_BIN`；本周期复绿同上
- **限制**: H2 land / headed-live / `boundary_e2e::e_bash` seatbelt / BlockContext Arc park

## T2026-11-16-first-run-session-open

- **完成日期**: 2026-11-16
- **结果**: 首跑 placeholder ACL 下 `session/new` 可开（拒绝型 LLM）；generation 仍 fail closed。≠产品 Pass。
- **产物**: `unconfigured_model.rs`；`session_open.rs`；`docs/evidence/first-run-session-open-2026-11-16/OUTCOME.md`
- **验证**: `startup_error` 3 绿；见 OUTCOME
- **限制**: HG3 未授权；非 first-run 缺 key 未扩面

## T2026-11-16-acp-permission-elicitation

- **完成日期**: 2026-11-16
- **结果**: Permission elicitation ledger 跨 ACP `request_tool_permission` HITL；hook 不再提前结账。≠产品 Pass。
- **产物**: `elicitation.rs`；`permission_ask.rs`；`hook_runtime.rs`；`docs/evidence/acp-permission-elicitation-2026-11-16/OUTCOME.md`
- **验证**: elicitation 4 绿 + HITL hermetic 1 绿
- **限制**: HG3 未授权；question 通道未改标 Permission

## T2026-11-16-sandbox-violation-acp-wire

- **完成日期**: 2026-11-16
- **结果**: Core `sandbox_violation.code` 进入 ACP bash `rawOutput`。≠产品 Pass。
- **产物**: `tool_render.rs`；`emit.rs`；`docs/evidence/sandbox-violation-acp-wire-2026-11-16/OUTCOME.md`
- **验证**: `tool_cards_use_pager_kind_and_raw_input` 绿
- **限制**: HG3 未授权；effect 日志未扩；Studio UI 未展示

## T2026-11-16-daily-use-wiring

- **完成日期**: 2026-11-16
- **结果**: 将 P2-9/P1-6/P2-10 接到生产路径：HookEngine managed-only、admit 强制层 digest、ask_user/form elicitation 通道。≠产品 Pass。
- **产物**: `hooks/engine.rs`；`config/workspace_trust.rs`；`ask_user.rs`；`ask_user_form.rs`；`docs/evidence/daily-use-production-wiring-2026-11-16/OUTCOME.md`
- **验证**: 相关 hermetic 10 绿；见 OUTCOME
- **限制**: HG3 未授权；ACP 9 项失败未修；Permission 通道未接 ACP wire

## T2026-11-16-p2-10-elicitation

- **完成日期**: 2026-11-16
- **结果**: B 落地 P2-10：`elicitation` 统一 Permission/AskUser/Form 通道类型 + 并发不串 + cancel；未统一 UI。≠产品 Pass。
- **产物**: `crates/code/core/src/elicitation.rs`；`docs/evidence/elicitation-state-2026-11-16/OUTCOME.md`
- **验证**: `elicitation::` 3 绿；见 OUTCOME
- **限制**: 未跑 ACP cancel conformance；未替换既有 ask_user 运行时；未 commit/发布

## T2026-11-16-p2-9-hooks-policy

- **完成日期**: 2026-11-16
- **结果**: B 落地 P2-9：`MANDATORY_HOOK_GATES` + `HookAdmissionPolicy::managed_only`（用户钩子被忽略）；未扩大事件枚举。≠产品 Pass。
- **产物**: `crates/code/core/src/hooks/policy.rs`；`docs/evidence/hooks-managed-only-2026-11-16/OUTCOME.md`
- **验证**: `hooks::policy` 2 绿；见 OUTCOME
- **限制**: 未接线全 HookEngine 发现失败路径；未做 P2-10；未 commit/发布

## T2026-11-16-p2-12-byte-budget

- **完成日期**: 2026-11-16
- **结果**: B 落地 P2-12：`byte_budget` 共享命名天花板（tool output + effect record）+ `discarded_bytes` 可计量。≠产品 Pass。
- **产物**: `crates/code/core/src/byte_budget.rs`；`docs/evidence/shared-byte-budget-2026-11-16/OUTCOME.md`
- **验证**: `byte_budget` 单测绿；见 OUTCOME
- **限制**: 未改遥测/模型 API；未做 P2-9/10；未 commit/发布

## T2026-11-16-p2-11-skills-partial

- **完成日期**: 2026-11-16
- **结果**: B 落地 P2-11：`load_from_dir_report` 可枚举 Parse/Validation 失败；坏 skill 不阻断同目录好 skill。≠产品 Pass。
- **产物**: `crates/code/core/src/skills/registry.rs`；`docs/evidence/skills-partial-load-2026-11-16/OUTCOME.md`
- **验证**: `bad_skill_does_not_block_good_sibling_and_errors_are_enumerable` 绿；见 OUTCOME
- **限制**: 未做 P2-9/10/12；未 commit/发布；未宣称日常稳定使用

## T2026-11-16-p1-6-forced-layer

- **完成日期**: 2026-11-16
- **结果**: B 落地 P1-6：`forced_layer` 文档化强制层覆盖 trust strip；非法强制 sandbox 值加载失败；`ForcedLayerProvenance` digest 可查询；无 JSON sidecar。≠产品 Pass。
- **产物**: `crates/code/core/src/config/forced_layer.rs`；`docs/evidence/forced-layer-bridge-2026-11-16/OUTCOME.md`
- **验证**: `config::forced_layer` 2 绿；见 OUTCOME
- **限制**: 未做 MDM；未 commit/发布；未宣称日常稳定使用；P2 未开

## T2026-11-16-p1-8-feature-stage

- **完成日期**: 2026-11-16
- **结果**: B 落地 P1-8：`FeatureStage` + 静态 `FEATURE_SWITCHES`（Aster 已吸收机制 id）+ legacy 别名解析 + `feature_switch_registry_digest` 稳定可测。≠产品 Pass。
- **产物**: `crates/code/core/src/capability/feature_stage.rs`；`docs/evidence/feature-stage-capability-2026-11-16/OUTCOME.md`
- **验证**: `capability::feature_stage` 2 绿；见 OUTCOME
- **限制**: 未改 CapabilityDescriptor/ACP 投影布局；无远程放量；未做 P1-6/P2；未 commit/发布；未宣称日常稳定使用

## T2026-11-16-p1-7-verified-patch

- **完成日期**: 2026-11-16
- **结果**: B 落地 P1-7：`patch` 稳定 `metadata.patch.code`（parse/context_mismatch/line_ending/batch_* 等）；`edit` 稳定 `metadata.edit.code`（not_found/ambiguous/line_ending）；hermetic 覆盖坏 hunk、混合 CRLF、批上限与歧义替换。≠产品 Pass。
- **产物**: `crates/code/core/src/tools/builtin/{patch,edit}.rs`；`docs/evidence/verified-patch-codes-2026-11-16/OUTCOME.md`
- **验证**: patch 套件 26 绿；`test_edit_not_unique`/`test_edit_not_found` 绿；见 OUTCOME
- **限制**: 未换 Codex patch 语法；码未进 ACP/effect wire；未 commit/发布；未做 P1-6/P1-8；未宣称日常稳定使用

## T2026-11-16-p1-5-compaction-ledger

- **完成日期**: 2026-11-16
- **结果**: B 落地 P1-5：`CompactionLedger` 命名生命周期（Open/Started/Completed）+ 可断言 pre/post 预算字段；`SessionCompact` 经 ledger 发 `AutoCompact` 并记录 `carried_standing_lines`；hermetic 证明超预算触发与 standing carry 保留。≠产品 Pass。
- **产物**: `crates/code/core/src/compaction/ledger.rs`；`compaction.rs`（`trigger_threshold`）；`fact_control/compaction.rs`；`docs/evidence/compaction-ledger-2026-11-16/OUTCOME.md`
- **验证**: `cargo test --locked -p aster-core --lib compaction::ledger` 3 绿；`fixed_context_does_not_force_*` 绿；clippy lib 对本刀无新诊断；见 OUTCOME
- **限制**: 未改 provider 精确 token 账本；无 soak；无 ACP wire 新字段；未 commit/发布；未做 P1-6+；未宣称日常稳定使用

## T2026-11-16-p0-4-acp-protocol

- **完成日期**: 2026-11-16
- **结果**: B 落地 P0-4：`crates/code/acp/PROTOCOL.md` 钉死 Session/Prompt/Turn/Run/Model turn/Subagent task 与队列语义（会话 turn 队列 vs Core `SessionLane` 非线上）；golden `acp_wire_surface_v1.json` + host method 单测 + `acp_conformance_stdio` 新增 `queue-running-identity`/`turn-queue-order`；两次负向篡改均使门失败。未换 Codex Op、未加总线。≠产品 Pass。
- **产物**: `crates/code/acp/{PROTOCOL.md,tests/fixtures/acp_wire_surface_v1.json}`；`tests/acp_conformance_stdio.rs`；`src/agent/host_methods_tests.rs`；`src/lib.rs`（文档指针）；`docs/evidence/acp-protocol-entities-2026-11-16/OUTCOME.md`
- **验证**: conformance 15/15 exit 0；lib host_method/execution_observe 16 绿；clippy `-p aster-acp --all-targets --no-deps` exit 0；见 OUTCOME
- **限制**: 全量 `aster-acp` 套件 9 项失败（环境/陈旧产物/未诊断，非本刀改动）；golden 仅覆盖 host method 名、queue/changed 键集与队列行为，非完整 JSON Schema；`__aster/execution/observe` 双下划线缝仅文档化未修；未宣称日常稳定使用

## T2026-11-16-p0-3-sandbox-profile

- **完成日期**: 2026-11-16
- **结果**: B 落地 P0-3：`PermissionProfile` 交集 API（fail-closed，`ProfileIntersectError` 封闭集）+ 稳定 `sandbox.violation.*` 码（`bash` 预启动拒绝写入 `metadata.sandbox_violation.code`）；`aster-confine` 文档声明非执行权威，ksandbox 仍是唯一后端。≠产品 Pass。
- **产物**: `crates/code/core/src/sandbox/permission_profile.rs`（+`permission_profile/tests.rs`）；`sandbox.rs`；`tools/builtin/bash.rs`；`aster-confine/src/lib.rs`；`docs/evidence/sandbox-permission-profile-2026-11-16/OUTCOME.md`
- **验证**: permission_profile 10 绿；bash typed_/violation_code 3 绿，bash::tests 77 绿；clippy core/confine exit 0；见 OUTCOME
- **限制**: ksandbox 原生适配器尚未返回 typed filesystem/network 违规；交集 API 未接入 grant 应用；码未扩散到 effect/ACP wire；未宣称日常稳定使用

## T2026-11-16-p0-2-effect-rollout

- **完成日期**: 2026-11-16
- **结果**: B 落地 P0-2：`FileLog` 单条记录 `MAX_RECORD_BYTES`（4 MiB）读写有界，超限整体拒绝、不跳行；损坏/截断 JSONL 沿用整体拒绝并写入 README 契约；新增 `FileLog::freeze` 暴露已提交 `byte_len`（`LogCut` 形状不变）；writer fence 沿用。`aster-effect` 全量测试 exit 0（lib 99 passed）。≠产品 Pass。
- **产物**: `crates/effect/src/{log.rs,lib.rs,log/security_tests.rs}`；`crates/effect/README{,.zh-CN}.md`；`docs/evidence/effect-rollout-hardening-2026-11-16/OUTCOME.md`
- **验证**: 见该 OUTCOME 命令与退出码；clippy `-p aster-effect --all-targets --no-deps` exit 0
- **限制**: 无 reverse-scan / 计数器；未跑 core 测试；仅 macOS 原生；未做 P0-3+；未宣称日常稳定使用；未拷 Codex；`exact_byte_limit_*` 夹具改为多条记录填满 16 MiB

## T2026-11-16-p0-1-permissions-self-test

- **完成日期**: 2026-11-16
- **结果**: B 落地 P0-1：`PermissionRule` 嵌入 `match`/`not_match`，坏例加载失败；hermetic 5 绿；example 好例 exit 0 / 坏例 exit 2。≠产品 Pass。
- **产物**: `crates/code/core/src/permissions/{rule,policy,self_test_examples_tests,fixtures/*}`；`examples/permission_policy_self_test.rs`；`docs/evidence/permissions-self-test-2026-11-16/OUTCOME.md`
- **验证**: 见该 OUTCOME 命令与退出码；clippy `-p aster-core --lib --examples --no-deps` exit 0
- **限制**: 未做 P0-2+；未宣称日常稳定使用；未拷 Codex

## T2026-11-16-codex-absorb

- **完成日期**: 2026-11-16
- **结果**: D 产出 Codex→Aster 机制吸收清单（排序 P0–P2 · Aster 路径映射 · 可验证完成定义 · 非目标）；衔接 B scan；≠产品 Pass。
- **产物**: [Codex-Aster-Absorption.md](Codex-Aster-Absorption.md)；证据 `.kstudio/evidence/T2026-11-16-codex-absorb/OUTCOME.md`
- **验证**: 清单字段齐全；引用 B `CANDIDATES.md` 与本仓 `crates/effect` / `crates/code/core` / `crates/code/acp` / `crates/acl` 路径存在性抽检
- **限制**: 未改 `apps/`/`crates/`；未宣称机制已落地或日常可用；口头「像 Codex」不计 Pass

## T2026-11-16-codex-scan

- **完成日期**: 2026-11-16
- **结果**: B 只读扫描 `/tmp/openai-codex`（`openai/codex` HEAD `5cb38e7…`）；提炼 Top12 + 5 荣誉提名机制候选；≠Pass。
- **产物**: `.kstudio/evidence/T2026-11-16-codex-scan/{OUTCOME.md,CANDIDATES.md}`
- **验证**: 源钉扎与路径存在；未把 Codex 源码拷进本仓
- **限制**: 非功能对等清单；未改业务源码；未开 branch/worktree

## T2026-11-16-init

- **完成日期**: 2026-11-16
- **结果**: 在 `/Users/roylin/code/aster` 以 create-missing 方式完成 KStudio 工程根初始化；`AGENTS.md` 保留；冲突 0；创建 84 个路径。
- **产物**: `.kstudio/`（含 skills / workflow / wiki / evidence）、`.cursor/skills/`、`.cursor/commands/`、`.cursor/rules/{git-branch-discipline,k-skills}.mdc`
- **验证**: `sync-k-skills.py --check` exit 0；`verify-ai-eng.py --level L3` exit 0 → `PASS (L3) aster HEAD=bootstrap`
- **限制**: 产品目标仍为 unknown；未跑应用测试；未 commit；未观察到原生技能选择器刷新。证据：`.kstudio/evidence/T2026-11-16-init/OUTCOME.md`

## T2026-11-17-tb40-task1-batched-eval-parity
- **范围**: YOLO 命名「TB4.0 第1题评测+问题+优化计划」
- **结果**: `batched-eval-parity` + `kimi-01/k3.1-pro` → reward **0.0**；Aster **840s deadline** 误杀；verifier 4/5（压力测 Worker timeout）。≠ Pass。
- **产物**: `.kstudio/evidence/T2026-11-17-tb40-task1-batched-eval-parity/`（OUTCOME + OPTIMIZATION_PLAN）；P0 已改 adapter/run 默认 8h 预算。

## T2026-11-17-optimize-aster-analysis
- **范围**: `/go`「分析如何优化 aster」· S+I+D
- **结果**: 杠杆队列 P0(H2 land / 发布闭环 / TB预算) → P1(A1/A2/长地平线) → P2(A6/A9/E5/E6/headed) → P3(组合/观测)。≠Pass；≠已实施。
- **产物**: `.kstudio/wiki/Optimize-Aster.md` · `.kstudio/evidence/T2026-11-17-optimize-aster-analysis/OUTCOME.md`

## T2026-11-17-tb40-task1-rerun-optimized
- **范围**: YOLO「根因优化 + TB4.0 第1题重评」
- **结果**: reward **1.0** · verifier **5/5** · `maxExecutionTimeMs=28800000`；pregate 工具停后最多 2 次 nudge。≠ Meta Pass。
- **产物**: runner/adapter 预算对齐 + `HARBOR_HOST_PREGATE_TOOL_STOPS`；证据 `T2026-11-17-tb40-task1-rerun-optimized`

## T2026-11-18-tb40-task2-biped
- **范围**: YOLO「TB4.0 第2题评测+问题+优化计划」
- **结果**: `biped-contact-dynamics` · 无 reward（`RewardFileNotFoundError`）；缺三份 npz；verifier `/logs/verifier` Untrusted；pregate 过早 Finish。≠Pass。
- **产物**: `.kstudio/evidence/T2026-11-18-tb40-task2-biped/`（OUTCOME + OPTIMIZATION_PLAN）

## T2026-11-19-native-cordis
- **范围**: YOLO「清理桥接 + Aster 原生 Cordis 内核 + rust-anything 验证」
- **结果**: `aster_core::capability::cordis` 原生服务/事件/Fiber 生命周期落地；Studio DSH 桥接及运行依赖移除；原版与原生 replay 均 **6/6**。≠ Meta Done。
- **产物**: `.kstudio/evidence/T2026-11-19-native-cordis/` · `docs/evidence/code/2026-11-19-native-cordis/OUTCOME.md`
- **验证**: Core 5/5 · Clippy 完成 · 双侧 rust-anything 6/6 · Studio deps:check PASS
- **限制**: 非完整 JS API/生态；未跑全量 Core/Studio、headed、跨平台；既有门禁失败逐项留在 OUTCOME。

## T2026-11-19-remove-cordis-dsh
- **范围**: 用户取消兼容 campaign，完全移除新增 Cordis 内核与 DSH 兼容实现。
- **结果**: Core 原生内核、DSH Host/Profile、Node 执行器、测试/fixture/example 与新增依赖全部删除；保留桥接清理和历史证据。
- **产物**: `.kstudio/evidence/T2026-11-19-remove-cordis-dsh/OUTCOME.md` · `docs/evidence/code/2026-11-19-remove-cordis-dsh/OUTCOME.md`
- **验证**: `cargo check -p aster-core --lib` PASS；受影响 Core 原文件零差异；targeted diff check PASS。
- **限制**: 历史记录中的旧实现描述不代表当前仍存在；≠ Meta Done。

## T2026-11-19-studio-dsh-removal
- **范围**: 移除 Studio 既有 DSH Agent 运行选项与 DeepSeek Harness Code CLI 支持。
- **结果**: DSH 类型、能力、控制器、配置、资源、缓存、预设、启动页和专用测试全部删除；其他 runtime/CLI 保留。
- **产物**: `.kstudio/evidence/T2026-11-19-studio-dsh-removal/` · `docs/evidence/code/2026-11-19-studio-dsh-removal/OUTCOME.md`
- **验证**: 定向测试 82/82 · 启动页其余 12/12 · i18n 25,266 PASS · Rust host PASS · 格式/diff PASS。
- **限制**: 另有 8 个启动页失败在原版同样复现；全量 TypeScript/build/headed/跨平台未验证；review collector 脏子模块指纹失败。


## T2026-11-19-main-pr-issue-triage
- **范围**: YOLO「处理 aster 主仓库全部开放 PR 和 issues，并完成端到端测试」；共 5 PR + 9 issues。
- **结果**: #300/#301/#302/#304/#309/#310/#311/#312/#313/#314/#315/#298 已落地源码与回归；#297 仅移植当前仍存在的菜单 resize 修复；冲突草稿 #233 及 #297 其余旧改动未合并、未宣称交付。
- **产物**: `docs/evidence/code/2026-11-19-main-pr-issue-triage/OUTCOME.md` · `.kstudio/evidence/T2026-11-19-main-pr-issue-triage/OUTCOME.md`
- **验证**: 配对 19+3+18；结构化 6；headless 40+84；marketplace 151；Linux Cursor 9；updater 21；Studio 11+25；stdio+unattended 36；UI 14+TS；受影响包 Clippy 完成。
- **限制**: 未 commit/push/merge/远端关闭；Windows 安装包/GUI 未验证；2 个 ACP 持续失败、6 个 MCP 失败、1 个 Capture 既有失败及全仓既有格式漂移保留；≠ Meta Done。


### T2026-11-19-main-pr-issue-triage 最终关闭
- ACP 548/548（10 ignored）、workspace 232/232、Capture 392/392（1 ignored）。
- 修正非法 MCP Header、pre-analysis 测试桩与 wiki 并发夹具冲突；保留取消和恢复传输断言。
- 已对 5 PR + 9 issues 逐项回复，评论 ID 见主 OUTCOME；全部保持开放，未 commit/push/merge/close。
- 未验证 Windows 安装包/GUI；#233 和 #297 冲突余量仍需 rebase 后拆分。


### T2026-11-19-main-pr-issue-triage 拆分提交与 #311 阻塞
- 主仓 7 个提交完成；Studio `a970022311` 仅 tenant 两文件，签名与 DCO 通过，DSH 原有暂存保持不变。
- #311 Windows 验证硬阻塞：`win-gates` SSH 握手即断开；未构建/启动安装包，未推送或提升 gitlink。
