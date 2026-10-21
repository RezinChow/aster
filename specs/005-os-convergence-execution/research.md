# specs/005 决策材料与外联草稿

供 owner 拍板 D-A/D-B/D-D 与外发 D-F 时直接取用。证据出处标注于各节；
事实核验日期 2026-10-21。

## D-A 私有 CA 准入策略（卡 T0.4.2 runbook 步骤 1）

背景（`apps/cloud/docs/convergence/t0.4.2-oidc-federation-runbook.md`
L102-113）：生产 OIDC 客户端仅信任 webpki 根；测试联邦的 IdP 证书走私有
CA，客户端拒绝。

| 方案 | 内容 | 安全边界 | 成本 |
| --- | --- | --- | --- |
| a. 产品侧信任链可配置 | OIDC 客户端增加受管 CA 源（如 `x-trust-anchors` 引用 Secret），仅联邦配置显式启用 | 私有根进入生产信任面；必须限定「仅 federation IdP 端点」使用，且 CA 指纹入审计 | 控制面代码改动 + 安全评审；一次投入，后续联邦场景复用 |
| b. 测试联邦换公共 CA | 测试 IdP 用 Let's Encrypt 等公共可信证书（需测试域名可公网解析） | 生产信任面不变；但测试拓扑暴露公网、且不能验证私有 CA 联邦路径 | 运维侧为主；每次环境重建受公共 CA 有效期/速率约束 |

建议：若 D-A 的目的是**验证产品在私有 CA 联邦下的行为**（Phase 0 的
本意），只有方案 a 能覆盖；若仅为打通 runbook，b 更快。ADR 落
kense-labs/cloud `docs/decisions/`，需 owner 明示「私有根的允许范围」。

## D-B 保留运行凭据（卡 FN0 保留 run 与 GA-2 绿 run）

背景（`apps/cloud/docs/fn0-verified-residual.md` L189-198）：FN0.2 GHA
retain run 36190947596 失败于私有 `kense-labs` 子模块默认 GITHUB_TOKEN
不可读；分支 `fn0-verified-gha` 已推待触发。

| 方案 | 内容 | 适用 |
| --- | --- | --- |
| a. GHA 环境 + `A3S_LABS_READ_TOKEN` | org secret，fine-grained PAT，contents:read 限 `kense-labs/*` | 最小改动；secret 轮换入月度运维 |
| b. 自托管 runner | 常驻机器，天然可配 SSH key 读私有仓 + 后续裸金属/KVM 矩阵（FN0 Verified 的另一残留项） | 一次投入大，但同时解 FN0 宿主矩阵与 W2 保留管道 |

建议：若 D-E（SEV/硬件）倾向采购，b 一并解；否则 a 先行、b 挂 GA-3 前
置。

## D-D pinned postgres digest 不可解析（卡 runbook 步骤 4–6）

背景（runbook L80-83）：pin 的 postgres 镜像 digest 在测试环境无法拉取。
方案：① 内网镜像代理重写 digest；② 重新 pin 到可解析 digest 并记
lockfile 依据。倾向 ②——digest 漂移本身就是 runbook 应发现的缺陷，重
pin 即是修复动作的一部分。

## D-F krun 引导链失败 — Box 仓库 issue 草稿（外发文本）

> 标题：A3S-Lab/libkrun fork boot chain: VM exits before the guest exec
> server is ready (macOS/HVF, T0.4.2 stack)
>
> 正文要点：定性——这不是上游 libkrun 报障，是**自家 fork** 的引导链
> （`A3S-Lab/libkrun`，安装版 3.3.0 的运行时可溯源至 fork commit
> `dc5519f`/`2692169b`，见 `a3s-libkrun-sys` SOURCE-PROVENANCE.md）。
> 环境（macOS/Darwin，pin 版本）；症状（"VM process exited before the
> guest exec server became ready"，且失败路径清理了 shim/console 日志，
> 无留存诊断）；**第一诉求：失败路径保留 shim/console 日志**；第二诉
> 求：排查 fork 的 macOS 增量（VirtioFS 目录项快照、合成 FUSE resume
> cookie、guest-init 握手）——正是引导早期 guest 侧就绪路径的地基；
> 最小复现引用 runbook 步骤 1–3；可对照树内 vendored 源
> （`crates/box/deps/libkrun-sys/vendor/libkrun`）诊断；关联：收敛计划
> Phase 0 唯一出口项的外部前置（D-F）。
> 附：同栈已知干扰——旧 `a3s-os-node-agent.service` crash-loop（50,974
> 次重启，203/EXEC）需在每次重跑前禁用（fn02 证据 L166-177）。

## lane payload 三副本对账 — 上游 PR 描述草稿（US-5）

> 标题：fix(queue): persist StoredCommand.payload instead of `{}`
>
> 正文要点：`queue.rs:284` 以 `json!({})` 落盘 payload，重放丢失命令内
> 容；三副本（本仓 `crates/lane`、`apps/api/crates/lane`、
> `apps/cloud/crates/lane`）同线同缺陷；本 PR 为其中之一，其余两处以相
> 同 diff 落地；测试：构造带 payload 命令 → 持久化 → 重放 → payload 字
> 节相等；对账后 `tests/crate_drift_report.py` 漂移集不生长。
>
> 落地顺序：kense-labs/api PR → kense-labs/cloud PR → aster 根副本 +
> 两个子模块指针提升（同一提交，gitlink-only）。

## STUDIO_READ_TOKEN 最小权限配置清单（远端 CI 单点解阻，2026-10-21 实证）

远端 backend/Rust 工作流全部停在 `checkout-studio` 的 fail-closed 守卫
（run 39540474980 等，见 OUTCOME.md 远端判定段）。一个 secret 同时服务
studio 与方案 a 的 api/cloud 检出。最小配置：

| 项 | 值 |
| --- | --- |
| 类型 | GitHub fine-grained PAT（或同 scope 的 org bot token） |
| 仓库访问 | 仅 `kense-labs/studio`、`kense-labs/api`、`kense-labs/cloud`（Contents: **Read-only**；Metadata 随附） |
| 明确不授 | Workflows、Secrets、Admin、写入任何仓库 |
| 存放 | aster-ai-lab/aster → Settings → Secrets and variables → Actions → `STUDIO_READ_TOKEN` |
| 验证 | push 任意提交或 `gh workflow run`，观察 fmt/check 过 checkout 段 |
| 轮换 | 建议 90 天；到期症状即本次（基线 10-20 通过、10-21 拒绝） |

若组织策略不允许 PAT 读私仓：备选是 GitHub App + 安装 token 的 checkout
action 变体，成本更高，需另立 ADR。

## 决策期限（specs/005 US-3）

D-A/D-B：2026-11-07；D-D：2026-11-15。到期未决 → 依赖故事 fail closed
（FR-005）。

## 宪法 XIII 修正草案（供 /speckit.constitution 拍板；analyze 发现 #1）

行为已先行：aster-ai-lab/libkrun fork（用户 2026-10-21 明示授权）。按
修正纪律「行为先行、文本随后」，建议在 XIII 的 apps/studio 授权句后补：

> The user-authorized dependency fork boundary is
> `aster-ai-lab/libkrun` (created from A3S-Lab/libkrun at owner
> direction, 2026-10-21). It is consumed through the vendored
> a3s-libkrun-sys tree; the parent tracks source provenance, never a
> parallel Aster checkout of libkrun source inside this repository's
> crates.

## AppRelease 加固 — 上游 PR 草稿（kense-labs/api；2026-10-21 发现）

> 标题：fix(app-release): gate the release lifecycle and pin version
> uniqueness
>
> 证据：`/v1/api/app-releases` 的 upload/publish/withdraw/delete 不在
> 任何受守卫前缀（admin `a3s_us_` / org `a3s_ms_`，见 main.rs OpenAPI
> 自述与 exclude_global_prefix），控制器层零鉴权（对比 model_hub 的
> `#[header("authorization")]` 模式）；`/current/file` 直供下载站。
> 任一公网部署实例存在发布渠道投毒面（fail-closed 宪法视角）。
>
> 修复内容：
> 1. 管理面守卫：写操作（upload/publish/withdraw/delete）纳入 admin
>    会话（`a3s_us_`，与 `/v1/api/admin` 同门）；读操作（list/current/
>    file）保持公开（下载站需要）。
> 2. 唯一性：`(channel, platform, version)` 唯一约束 + 冲突命名错误；
>    迁移先行去重。
> 3. e2e：上传→发布→current 解析→下载字节 sha256 相等；未鉴权写操作
>    401/403 命名拒绝；撤回后 current 拒绝（denied 与 missing 不可分）。

## T029 计量环生产者 — 设计笔记（2026-10-21）

消费者侧实况（今日核验）：
- Cloud I0.2c 用量账本摄取**已存在**（control-plane `modules/inference/
  application/usage_batch_campaign.rs` + `usage_ledger.rs`，campaign 已测）。
- Kense 原始 runtime 设计是**事件式**：尽力发布 `events.runtime.*`，api
  队列 worker 消费 `usage-ingest`，durable 投影（ui merge-evidence L439）。
  Rust 重写丢了队列腿（runtime `vault_apply` 的「NATS not wired」同证）。

两案：
- **A（HTTP 批）**：runtime POST `a3s.gateway.usage-batch.v1` 到 Cloud I0.2c
  摄取面。小改（runtime 已有 http client + 能力钥），但绕开事件主干。
- **B（事件式，DP-2 对齐）**：runtime 接 NATS 发布 `events.runtime.usage`
  （DP-2 已裁 NATS 主线；api worker 消费模式为原始设计）。大改：runtime
  增队列依赖与 at-least-once 语义。

建议：**B 为目标态、A 不做**（避免建成又拆的临时 HTTP 腿）；实现切片 =
runtime 增 NATS 出站 publisher（尽力、断线不阻塞请求路径，宪法 I 降级语
义）→ api 侧 `usage-ingest` worker（若上游未备则该半环归上游）→ 契约测
试保持「200/发布仅真实 records」。体量：中（一天级切片）。
