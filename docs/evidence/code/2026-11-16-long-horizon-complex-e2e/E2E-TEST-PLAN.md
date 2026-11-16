# Aster 深度多轮 / 复杂长程 E2E — 2026-11-16 复跑计划

状态：执行中。相对 `2026-11-15-long-horizon-complex-e2e` 的**同合同复跑**，针对当前 dirty `main`（吸收+接线未 commit）验证日常长程水位。

权威执行合同（不变）：

`docs/implementation-prompt-aster-long-horizon-complex-agent-desktop-e2e.md`

详表基线：`docs/evidence/code/2026-11-15-long-horizon-complex-e2e/E2E-TEST-PLAN.md`

## 本回合增量焦点

1. **当前 checkout** pair（含 Permission elicitation / sandbox·edit·patch ACP 码 / 首跑 session 等未入库改动）上重跑 L0–L4。
2. 优先修 **产品性失败**；额度记 BLOCKED；不改 grader 换绿。
3. agent-desktop visual 固定序：C4 → H1-hard → H3 → AL → CL。
4. 证据根：`.runtime/tui-full-e2e/long-horizon-complex-agent-desktop-20261116/`（私有；密钥不进仓库）。

## 分层（同基线）

```text
L0  基线 / 成对构建 / agent-desktop 权限
L1  Hermetic 门禁
L2  PTY 真模型 multiturn + long_task
L3  agent-desktop C4→H1→H3→AL→CL
L4  断连 F1+F2（+F3）
L6  OUTCOME
```

L5 可选；未跑须披露。

## Explicitly not claimed（计划层）

- 本计划文件 ≠ 战役 PASS
- Studio CUA 长程
- HG3 commit/推送/发布
