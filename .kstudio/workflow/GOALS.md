# Overall goals (k-goal · S)

Updated: 2026-11-16 · by: S via /k-goal · status: **locked**

## Overall goal

在 **Aster** 既有产品边界（CLI · Core/ACP · Studio）内，深度借鉴 `org-14957082@github.com:openai/codex.git` 的优秀工程与机制设计并集成落地，使真实用户能**日常稳定使用**这些能力；不做 Codex 复刻/换皮产品，不以与 Codex 功能对等为目标。

## Stretch (within product)

同一产品内持续抬高机制质量与可观测性：相关产品线同一套可复跑门禁与证据口径；口头「像 Codex」永不算 Pass。

## Near-term hard goals

1. Codex→Aster 机制吸收清单（排序 · 路径映射 · 可验证完成定义）— **wave-locked**（S）；证据齐；≠产品 Pass。
2. **P0–P2 吸收 + 生产接线已落地并进仓**：可复跑证据齐；hooks/forced_layer/elicitation 等接线在 tip；≠产品 Pass。
3. **发布水位已推到通道（本命名 YOLO）**：`aster-cli-v0.3.9` + `aster-acp-v9.2.7` 已发布；`aster-cli-stable` → `0.3.9`；证据 `docs/evidence/code/2026-11-16-cli-0.3.9-acp-9.2.7-release/OUTCOME.md`。用户侧 `aster update`/重装后的日常稳定使用仍须可复跑证明；≠产品 Pass。
4. Studio 桌面版 gitlink / 桌面 Release 未随本 tip 同步（本切片范围外）。

## Non-goals

- 另做独立 Codex 复刻产品或换皮发行
- 以「与 Codex 功能对等」为 Pass
- 仅凭观感/口头「像 Codex」记 Pass
- 借机扩大为未点名的相邻产品或「任意仓库编排平台」

## Real constraints (not self-doubt)

- 产品线、版本与发布契约：`AGENTS.md`、`docs/release-governance.md`（既有）
- 上游参考源：`org-14957082@github.com:openai/codex.git`（用户指定）
- Pass 须可复跑证据；77≠Pass；初始化/L3≠产品 Pass

## Open turtle-soup

- Q1: 留在 Aster 三线内吸收，非 Codex 复刻？ → A: **yes**
- Q2: 机制成功条 = 落地 + 可复跑证据，非功能对等？ → A: **yes**
- Q3: 硬目标仅门禁、日常可用放 stretch？ → A: **no**（用户要「真实用户日常稳定使用」）
- Q3b: 水位 = 日常稳定使用；Pass 仍须可复跑证据（77≠Pass）？ → A: **yes**
- Q4: 确认锁定上述总体目标？ → A: **yes** — **locked**

## Sources

- user `/k-goal`: 深度借鉴 openai/codex，集成优秀工程与机制到 aster
- user: Q1 是 · Q2 是 · Q3「真实用户日常稳定使用」· Q3b 是 · Q4 是
- sitrep: HEAD=bootstrap；≠Pass
