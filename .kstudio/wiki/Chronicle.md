## 2026-11-16 · 长程复杂多轮 agent-desktop E2E 复跑

- L0–L4 PASS on kimi-01/k3.1-pro @ dirty HEAD `291c2afaf`；H3 首败后修 `drive_lh_retrieval` welcome(kimi)+fail dump 再绿
- 证据：`docs/evidence/code/2026-11-16-long-horizon-complex-e2e/OUTCOME.md`
- HG3 仍 park；总体 ≠Pass

## 2026-11-16 · YOLO 日常可观测/首跑

- ACP Permission elicitation 跨 `session/request_permission` HITL；sandbox.violation 上 ACP bash rawOutput；首跑 placeholder 可开 session（generation 仍拒）
- 证据：`docs/evidence/acp-permission-elicitation-2026-11-16/` · `docs/evidence/sandbox-violation-acp-wire-2026-11-16/` · `docs/evidence/first-run-session-open-2026-11-16/`
- HG3 仍 park；≠产品 Pass

## 2026-11-16 · 日常可用生产接线（YOLO 续推）

- B：HookEngine managed-only · forced_layer digest 进 admit · elicitation↔ask_user/form
- 证据：`docs/evidence/daily-use-production-wiring-2026-11-16/`
- HG3 仍 park；≠产品 Pass

## 2026-11-16 · P2-10 elicitation + 吸收清单收口（YOLO）

- S：`D-2026-11-16-p2-10-wave-lock`；清单 P0–P2 均已落地
- B：`elicitation` 三通道 + 并发/cancel hermetic；证据 `docs/evidence/elicitation-state-2026-11-16/`
- **战役 park**：HG3 需用户授权 commit/推送/发布；≠产品 Pass

## 2026-11-16 · P2-9 hooks managed-only（YOLO）

- S：`D-2026-11-16-p2-9-wave-lock`
- B：`hooks/policy` + hermetic；证据 `docs/evidence/hooks-managed-only-2026-11-16/`
- 清单余 P2-10；HG3 仍 park；≠产品 Pass

## 2026-11-16 · P2-12 共享字节预算（YOLO）

- S：`D-2026-11-16-p2-12-wave-lock`
- B：`byte_budget` + discard oracle；证据 `docs/evidence/shared-byte-budget-2026-11-16/`
- HG3 仍 park；P2-9/10 待开；≠产品 Pass

## 2026-11-16 · P2-11 skills 部分成功加载（YOLO）

- S：`D-2026-11-16-p2-11-wave-lock`
- B：`SkillLoadReport` + hermetic；证据 `docs/evidence/skills-partial-load-2026-11-16/`
- HG3 仍 park；P2-9/10/12 待开；≠产品 Pass

## 2026-11-16 · P1-6 forced layer 桥（YOLO · P1 收口）

- S：`D-2026-11-16-p1-6-wave-lock`；P1-5…P1-8 均已落地
- B：`config/forced_layer.rs` + provenance digest；证据 `docs/evidence/forced-layer-bridge-2026-11-16/`
- HG3 仍 park；P2 未开；≠产品 Pass

## 2026-11-16 · P1-8 Feature Stage 注册表（YOLO 续推）

- S：`D-2026-11-16-p1-8-wave-lock`
- B：`capability/feature_stage.rs` + digest/alias hermetic；证据 `docs/evidence/feature-stage-capability-2026-11-16/`
- HG3 仍 park；下一候选 P1-6；≠产品 Pass

## 2026-11-16 · P1-7 verified patch/edit codes（YOLO 续推）

- S：`D-2026-11-16-p1-7-wave-lock`
- B：稳定 `metadata.patch.code` / `metadata.edit.code`；patch 26 + edit 2 绿；证据 `docs/evidence/verified-patch-codes-2026-11-16/`
- HG3 仍 park；≠产品 Pass

# 演进记录

## 2026-11-16 · P1-5 Compaction ledger（YOLO 续推）

- HG3 commit/发布仍 park；S 另决授权 P1-5（`D-2026-11-16-p1-5-wave-lock`）
- B：`CompactionLedger` + SessionCompact 接线 + hermetic 3 绿；证据 `docs/evidence/compaction-ledger-2026-11-16/`
- ≠产品 Pass；下一候选 P1-7（需另派）或用户授权入库

## 2026-11-16 · P0-4 ACP 实体/golden + 首批 P0 收口

- B：`PROTOCOL.md` + `acp_wire_surface_v1.json` + conformance 15/15；证据 `docs/evidence/acp-protocol-entities-2026-11-16/`。≠产品 Pass
- 首批 P0-1…P0-4 均复验绿、**未 commit**；硬目标③待发布授权

## 2026-11-16 · P0-3 PermissionProfile + YOLO 续推 P0-4

- B：`PermissionProfile` 交集 fail-closed + `sandbox.violation.*` 稳定码（tool metadata）+ confine stub 非权威文档；证据 `docs/evidence/sandbox-permission-profile-2026-11-16/`。≠产品 Pass
- 残余：native ksandbox 尚未 typed 违规；intersect 未挂 session/ACP

## 2026-11-16 · P0-2 effect rollout 硬化 + YOLO 续推 P0-3

- B：`aster-effect` 单行 `MAX_RECORD_BYTES`（12 MiB）+ 拒绝契约文档 + `LogFreeze`；证据 `docs/evidence/effect-rollout-hardening-2026-11-16/`；审查抬高 4→12 MiB。≠产品 Pass
- 编排：P0-1/P0-2 复验绿（未 commit）；下一刀曾为 P0-3

## 2026-11-16 · 吸收清单 wave-lock + P0-1 开做

- S：审定 [Codex-Aster-Absorption.md](Codex-Aster-Absorption.md) → **wave-locked**；首批 P0-1…P0-4；[Decisions](Decisions.md) `D-2026-11-16-absorption-wave-lock`
- B：按清单落地 P0-1（permissions `match`/`not_match`）；≠产品 Pass

## 2026-11-16 · bootstrap 机制扫描与吸收清单

- B：只读扫描 `openai/codex`（临时 clone `/tmp/openai-codex` @ `5cb38e7`）→ `.kstudio/evidence/T2026-11-16-codex-scan/`
- D：合成排序吸收清单 → [Codex-Aster-Absorption.md](Codex-Aster-Absorption.md) + `.kstudio/evidence/T2026-11-16-codex-absorb/`
- 未记产品 Pass
- 2026-11-16 · published aster-cli 0.3.9 / aster-acp 9.2.7 @ 22856ef33; aster-cli-stable→0.3.9 (named YOLO wrap+release).
