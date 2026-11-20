## D-2026-11-17-hg6-close

- **决定**: GOALS **HG6**（kburn→Core Q13）**关闭** — Core 内化自动触发 + hermetic/`L3` 证据齐；本仓现网仍 `.kstudio/`（产品 `.aster/` 为 gitignore 运行时）不阻塞。
- **依据**: Q13；证据 `T2026-11-17-hg6-close`
- **非决定**: Meta Harness 总体 Done；产品 Pass；H2 Studio land；本仓 eng 全量迁 `.aster/`

## D-2026-11-17-conductor-acl-bare-skills

- **决定**: 工程配置 `.kcl` → **`.acl`**（`project.acl` / `project.acl.example` / `project.local.acl`，避开产品 `.aster/config.acl`）；12 个 conductor 技能去掉 `k-` 前缀（`/init`…`/yolo`）；规则 `skills.mdc`。
- **依据**: user 2026-11-17「.kcl 改成使用 .acl，所有 k-* 技能都去掉 k-」
- **非决定**: 历史证据目录改名；HG6 关闭（后由 D-2026-11-17-hg6-close 关闭）

## D-2026-11-17-kburn-aster-root-flat

- **决定**: AI 工程树规范根为 **`workspace/.aster/`**（与 `config.acl` 同根），**不是** `.aster/kstudio`；遗留 `.kstudio/` 兼容；仅有 `.aster/config.acl` 不 auto-arm。
- **依据**: `/goal` Q14 用户更正「直接内化到 .aster/」
- **非决定**: 本仓现网 `.kstudio/` 迁移；HG6 关闭

## D-2026-11-17-kburn-core-absorb

- **决定**: kburn→Core/ACP 为 GOALS HG6 **手段**（不换 Meta Harness 总体）；P0 以 skill root / layout API / 12 名录 / MANIFEST / coverage / 契约 JSON / README 非候选 接线；挂文档 alone ≠ Pass。
- **依据**: `/goal` Q10–Q12；清单 [Kburn-Aster-Absorption.md](Kburn-Aster-Absorption.md)
- **非决定**: HG6 关闭；CLI/Studio 产品组合面完成；另发 kburn 产品

## D-2026-11-16-p2-10-wave-lock

- **决定**: 授权本波开做 **P2-10 Elicitation 统一状态机**（三通道类型 · 并发不串 · cancel；不统一 UI 皮肤）。
- **依据**: 吸收清单末项；YOLO 续推。
- **非决定**: 产品 Pass；审批记忆产品化；全量 ACP conformance 重跑宣称。

## D-2026-11-16-p2-9-wave-lock

- **决定**: 授权本波开做 **P2-9 Hooks 收敛权威门点 + managed-only**（文档化强制门点集 · managed-only 忽略用户钩子；不扩大事件枚举）。
- **依据**: 吸收清单；YOLO 续推。
- **非决定**: 产品 Pass；钩子市场。

## D-2026-11-16-p2-12-wave-lock

- **决定**: 授权本波开做 **P2-12 输出/持久化字节预算共享策略**（共享命名天花板 · 可计量丢弃 · 不第二套截断引擎）。
- **依据**: 吸收清单；tool `MAX_OUTPUT_SIZE` + effect `MAX_RECORD_BYTES` 已并存。
- **非决定**: 产品 Pass；遥测产品；改模型 API。

## D-2026-11-16-p2-11-wave-lock

- **决定**: 授权本波开做 **P2-11 Skills 部分成功加载**（坏 skill 不拖垮目录 · 错误可枚举 · 与 standing digest 契约一致）。
- **依据**: 吸收清单；P1 已收口；`/yolo` 续推总体目标。
- **非决定**: 产品 Pass；合并 .kstudio 技能进 Core。

## D-2026-11-16-p1-6-wave-lock

- **决定**: 授权本波续刀 **P1-6 分层 requirements / Constrained 配置桥**（文档化强制层覆盖 · 非法强制值失败 · 可查询 provenance digest；不引入 JSON sidecar）。
- **依据**: 吸收清单末项 P1；既有 trust strip / HOST_AUTHORITATIVE_BLOCKS。
- **非决定**: 产品 Pass；MDM；requirements.toml 文件名。

## D-2026-11-16-p1-8-wave-lock

- **决定**: 授权本波续刀 **P1-8 Feature Stage 映射到 capability**（静态注册表 · Stage · legacy 别名 · 稳定 digest）；P1-6 / P2 仍未开。
- **依据**: 吸收清单；`/yolo` 续推；GOALS 非复刻、非镜像 Codex 功能名单。
- **非决定**: 产品 Pass；远程放量；改 CapabilityDescriptor 构造面。

## D-2026-11-16-p1-7-wave-lock

- **决定**: 授权本波续刀 **P1-7 Verified edit/patch 管道加深**（稳定错误码 + hermetic CRLF/唯一性/批上限）；P1-6/P1-8/P2 仍未开。
- **依据**: 吸收清单随后候选；`/yolo` 在 HG3 park 后续推；GOALS 非复刻。
- **非决定**: 产品 Pass；commit/推送/发布；换 Codex patch 语法。

# 决策

## D-2026-11-16-p1-5-wave-lock

- **决定**: 在 P0-1…P0-4 已落地（未 commit）且 HG3 发布水位待用户授权时，授权本波下一刀为 **P1-5 Compaction 预算闭环（ledger）**；P1-6…P1-8 / P2 仍未开。
- **依据**: 吸收清单「随后候选：P1-5 / P1-7」；`/yolo` 在 HG3 硬阻时改走下一可验收总体目标刀；GOALS 非复刻、非功能对等。
- **非决定**: 产品 Pass；commit/推送/发布；P1-7 同步开做。

## D-2026-11-16-absorption-wave-lock

- **决定**: `.kstudio/wiki/Codex-Aster-Absorption.md` 由 draft 升为 **wave-locked**；本波首批实现顺序锁定为 **P0-1 → P0-2 → P0-3 → P0-4**。P1/P2 保留在清单，未授权本波开做。
- **依据**: D 吸收清单 + B Codex 扫描；GOALS（机制吸收、非复刻、非功能对等）；bootstrap work-plan。
- **非决定**: 产品 Pass；P0 之外的实现授权；扩大产品面。
- **后续**: 见 `D-2026-11-16-p1-5-wave-lock`（P1-5 单刀授权）。

## D-2026-11-16-absorption-authority

- **决定**: Codex 借鉴以**机制**为单位吸收，落点优先既有权威路径（`crates/effect`、`crates/code/core`、`crates/code/acp`、`crates/acl`）；sandbox 执行权威保持 ksandbox，不复活 confine。
- **依据**: `GOALS.md`（非复刻、非功能对等）；B scan Top 候选；Aster 现况地图。
- **非决定**: 产品 Pass；具体实现刀排序（已由 `D-2026-11-16-absorption-wave-lock` 锁定首批 P0）。
