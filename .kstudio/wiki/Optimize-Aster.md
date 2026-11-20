# 如何优化 Aster（Meta Harness 杠杆分析）

Updated: 2026-11-17 · `/go` 命名范围「分析如何优化 aster」· 席位 S+I+D  
权威目标：[GOALS.md](../workflow/GOALS.md) · 缺陷税目：[Defect-Mechanisms.md](Defect-Mechanisms.md)  
**% / hermetic 绿 / L3 ≠ 产品 Pass。**

## 一句话

优化不是「再加功能」，而是按 **可组合 · 高效 · 可信** 三条硬目标，关掉仍在伤日常使用的机制，并把评测/发布预算与真实任务对齐。

## 因果缺口（相对总体）

| 硬目标 | 现状（证据口径） | 主缺口 |
| --- | --- | --- |
| 可组合 | Core/ACP 契约续刀多；HG6 已关（Core 自动 arm） | CLI·Studio **同一内核水位**仍裂：Studio gitlink/H2 park；通道仍停在 cli **0.3.9** / 准备中的 0.4.0 未闭环 |
| 高效 | HG2 废刀账本 + hermetic/token·latency freeze 已有 | 长地平线真实 LLM（TB）被 **840s runner 默认**误杀；浪费仍以 A1 类重复扇出为主 |
| 可信 | E2/E8/P7/P8 等关刀；unattended/TUI hermetic 绿 | **headed 日常**与 Studio land 未证；高危 A6/A9/E5/E6/H2 仍影响「装了能稳定用」 |

## 优化原则（先于刀单）

1. **先关机制，再堆度量**：hermetic 绿只证明刀落地，不证明用户场景。
2. **宿主只组合内核**：优化落在 Core/ACP；CLI/Studio 同步契约，不另起面。
3. **预算与任务同量级**：评测/会话 deadline 必须 ≥ 官方任务/产品超时（TB 教训）。
4. **P13 串行冲突域**：Studio dirty（H2）与 parent gitlink 不能并行乱 bump。

## 优先级队列（建议执行序）

### P0 — 解锁「可信日常」与有效评测

| # | 杠杆 | 做什么 | 验收（可复跑） | 锚点 |
| --- | --- | --- | --- | --- |
| P0-a | **H2 Studio land** | Studio 脏树 commit/push → `studio_land_guard` → parent gitlink | `studio_land_guard` dirty/pointer 绿；写失败≠假退出有证据 | 缺陷 H2；`apps/studio` dirty |
| P0-b | **CLI/ACP 发布闭环** | 在合格 tip 上发 `aster-cli-v0.4.0` + `aster-acp-v9.3.0` + channel + 站点 | `aster-cli-stable`→0.4.0；站点 downloads=0.4.0 | 治理 `release-governance.md`；tip 曾卡 qualify/命名 |
| P0-c | **TB 预算对齐** | adapter/run 默认 8h（已落地）；重跑 task1 拿有效 reward | `aster.result` 无 840s `deadline_exceeded`；压力测有结论 | `T2026-11-17-tb40-task1-*` |

### P1 — 高效：少做重复功

| # | 杠杆 | 做什么 | 验收 | 锚点 |
| --- | --- | --- | --- | --- |
| P1-a | **A1 task 内容指纹** | 同 `(agent,description,prompt)` 去重/合流 | hermetic + 缺陷目录关闭条 | 审计 A1 |
| P1-b | **A2 plan 内容去重** | step 文本指纹；约束多 `in_progress` | 单测 + plan 重放 | 审计 A2 |
| P1-c | **长地平线策略** | TB/长任务：先压力热路径再合成电池；截止前可验交付 | TB shared-prefix 自测绿后再扩 | TB OPTIMIZATION_PLAN P1 |

### P2 — 可信：取消/会话/持久化硬案

| # | 杠杆 | 做什么 | 验收 | 锚点 |
| --- | --- | --- | --- | --- |
| P2-a | **A6 canceller** | 取消句柄与 Running 一致；禁 last-write 丢句柄 | cancel 集成测 | 审计 A6 |
| P2-b | **A9 BG settle** | deferred/workspace_child 结算闭合 | BG 套件 + ACP drain | 审计 A9 |
| P2-c | **E5/E6 session** | load 互斥；checkpoint 不 `lock().ok()` 吞毒 | 会话恢复测 | 审计 E5/E6 |
| P2-d | **headed 日常** | Studio land 后真窗 oracle（非关键字） | OUTCOME + AX/PNG 或等价 | GOALS 可信条 |

### P3 — 可组合与观测

| # | 杠杆 | 做什么 | 验收 | 锚点 |
| --- | --- | --- | --- | --- |
| P3-a | 宿主能力投影一致 | CLI/Studio 对同一 ACP 能力表 | 契约测 | Meta-Harness.md |
| P3-b | 评测可观测 | `aster.result` 带 `maxExecutionTimeMs`；host 可见 agent log | 字段存在 | TB P2 |
| P3-c | 继续 E4 热路径 | discarded_bytes 覆盖未封口调用点 | hermetic 增例 | HG2/E4 族 |

## I · 硬案 Top（每日可靠度）

| 级 | ID | 一句话 | 关闭条件 |
| --- | --- | --- | --- |
| 高 | H2 | Studio 写失败报成进程退出 | land + 对照测 |
| 高 | A1 | 子任务无内容去重 → 重复干活 | 指纹门 |
| 高 | A6 | 取消句柄与 Running 脱节 | cancel 真源一致 |
| 高 | A9 | BG 子结算空洞 | settle 闭合 |
| 高 | E5/E6 | 会话加载/checkpoint 竞态 | 互斥 + 失败可见 |
| 高(误读) | C1 | confine stub 被当成隔离 | 文档/调用点 fail-closed（已部分） |
| 评测 | TB-840 | 默认 14min 杀 8h 题 | 预算对齐（P0-c 已改默认） |

反模式：**把 hermetic 通过当成日常 Pass**；**在 Studio dirty 上宣称桌面交付**；**长任务不设 max-execution**；**为过 TB 改 verifier**。

## 明确不做（本分析边界）

- 另起第二套 Harness / kburn 产品面 / Codex 对等清单当目标  
- 无授权私开 branch/worktree（P17）  
- 在 H2 未 land 前并行乱 bump parent gitlink  

## 建议下一刀（执行，非本 `/go` 队列）

1. 授权后 **H2 Studio land**（P0-a）— 最大解锁可信与 headed。  
2. 等 TB 校预算重跑结果 → 若压力仍红，专攻 packed 热路径（P1-c）。  
3. **A1 内容指纹**（P1-a）— 最高效杠杆。  

证据：`T2026-11-17-optimize-aster-analysis/` · 缺陷审计 `T2026-11-16-defect-mechanisms-audit` · TB `T2026-11-17-tb40-task1-batched-eval-parity`
