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
- **依据**: 吸收清单；P1 已收口；`/k-yolo` 续推总体目标。
- **非决定**: 产品 Pass；合并 .kstudio 技能进 Core。

## D-2026-11-16-p1-6-wave-lock

- **决定**: 授权本波续刀 **P1-6 分层 requirements / Constrained 配置桥**（文档化强制层覆盖 · 非法强制值失败 · 可查询 provenance digest；不引入 JSON sidecar）。
- **依据**: 吸收清单末项 P1；既有 trust strip / HOST_AUTHORITATIVE_BLOCKS。
- **非决定**: 产品 Pass；MDM；requirements.toml 文件名。

## D-2026-11-16-p1-8-wave-lock

- **决定**: 授权本波续刀 **P1-8 Feature Stage 映射到 capability**（静态注册表 · Stage · legacy 别名 · 稳定 digest）；P1-6 / P2 仍未开。
- **依据**: 吸收清单；`/k-yolo` 续推；GOALS 非复刻、非镜像 Codex 功能名单。
- **非决定**: 产品 Pass；远程放量；改 CapabilityDescriptor 构造面。

## D-2026-11-16-p1-7-wave-lock

- **决定**: 授权本波续刀 **P1-7 Verified edit/patch 管道加深**（稳定错误码 + hermetic CRLF/唯一性/批上限）；P1-6/P1-8/P2 仍未开。
- **依据**: 吸收清单随后候选；`/k-yolo` 在 HG3 park 后续推；GOALS 非复刻。
- **非决定**: 产品 Pass；commit/推送/发布；换 Codex patch 语法。

# 决策

## D-2026-11-16-p1-5-wave-lock

- **决定**: 在 P0-1…P0-4 已落地（未 commit）且 HG3 发布水位待用户授权时，授权本波下一刀为 **P1-5 Compaction 预算闭环（ledger）**；P1-6…P1-8 / P2 仍未开。
- **依据**: 吸收清单「随后候选：P1-5 / P1-7」；`/k-yolo` 在 HG3 硬阻时改走下一可验收总体目标刀；GOALS 非复刻、非功能对等。
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
