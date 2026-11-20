# Overall goals (goal · S)

Updated: 2026-11-17 · by: S via /goal · status: **locked** · HG6 bar sharpened（Core 内化自动触发）

## Overall goal

把 **Aster**（CLI · Core/ACP · Studio）做成 **Meta Harness**：以 **Core/ACP** 为可组合内核，CLI 与 Studio 为同一内核上的一等宿主/组合面，交付**可组合、高效、可信**的 Harness——真实用户能日常安装与稳定使用；可复跑证据为 Pass 口径；完成度% / 门禁绿 / L3 ≠ Pass。不做 Codex 复刻/换皮，不以与 Codex 功能对等为目标，不另起第二套 Harness 产品。

## Stretch (within product)

同一内核上持续抬高组合面质量与可观测性：跨宿主同一套证据口径；缺陷机制（重复扇出、假退出、HITL/hooks 空洞等）有关闭路径；工程工作流机制（kburn 吸收后）可被宿主组合且可审计；口头「像某某」永不算 Pass。

## Near-term hard goals

1. **可组合（内核契约）**：Core/ACP 作为 Meta Harness 内核的嵌入/宿主契约可叙述、可复跑（协议/能力投影/证据）；CLI·Studio 只组合该内核。≠产品 Pass。
2. **高效（可度量）**：近端须有可复跑度量与关闭刀——至少覆盖时延或 token，以及重复扇出/无内容去重类浪费（缺陷审计 A1 等）；口头「更快」≠ Pass。
3. **可信（日常 + 证据）**：在已发布通道水位之上，高危缺陷机制有关闭或显式 hold；日常稳定使用须可复跑证明；%≠Pass。当前参考：`aster-cli-stable`→0.3.9 / ACP 9.2.7。
4. **Codex→Aster 机制吸收（手段，非总体）**：P0–P2 已落地进仓并接线；后续吸收服从 Meta Harness 三性。证据齐；≠产品 Pass。
5. **Studio 与内核同步**：桌面 gitlink / Release 跟上内核契约与 9.2.7+ 线能力；≠产品 Pass。
6. **kburn→Core 机制吸收（手段，非总体）**：将 `kense-labs/kburn` **全套**（AI 工程树 + 12 conductor skills）**内化进 Core**；规范落点 **`workspace/.aster/`**（`workflow`/`skills`/`wiki`/… 与产品目录同根；兼容遗留 `.kstudio/`）；会话装配时对已有工程根 **自动触发**（补齐缺失 factory seeds + 加载规范 conductor skills；仅有 `config.acl` 不触发）；可叙述 + 可复跑证据关闭本硬目标切片。挂文档/安装脚本 alone ≠ Pass；**本硬目标不要求 TUI / Studio 专用 UI**；%≠产品 Pass。 · **Status 2026-11-17: closed**（证据 `T2026-11-17-hg6-close`；≠ Meta Harness Done）。

## Non-goals

- 另做独立 Codex 复刻产品或换皮发行
- 以「与 Codex 功能对等」为 Pass
- 另起第二套 Harness /「任意仓库编排平台」产品面
- 另发独立 kburn 产品，或以 kburn 替换 Meta Harness 总体目标
- 以仓内挂技能文档 / 安装脚本 alone 记「内核完成」Pass
- **kburn 专用 TUI / Studio 接面**（用户 2026-11-17：Core 内化自动触发即可）
- 仅凭观感、完成度%、门禁绿或口头「像某某」记 Pass

## Real constraints (not self-doubt)

- 产品线、版本与发布契约：`AGENTS.md`、`docs/release-governance.md`
- 产品边界：CLI · Core/ACP · Studio；内核 = Core/ACP
- Pass 须可复跑证据；%/L3/初始化 ≠ 产品 Pass
- 上游参考（手段）：`org-14957082@github.com:openai/codex.git`（机制借鉴，非总体目标）
- 上游参考（手段）：`kense-labs/kburn`（私仓；可移植工程工作流机制，非总体目标、非第二产品面）

## Open turtle-soup

- Q1–Q4（旧锁 · Codex 吸收为总体）：历史保留；已被 Q5–Q8 替换总体表述。
- Q5: Meta Harness（可组合/高效/可信）替换总体目标；Codex 吸收退居硬目标/手段；仍留三线内？ → A: **yes**
- Q6: 「可信」= 真实用户日常可装可用 + 可复跑证据，且 %/门禁绿≠Pass？ → A: **yes**
- Q7: 「可组合」= Core/ACP 为内核，CLI·Studio 为同一内核一等宿主/组合面？ → A: **yes**
- Q8: 「高效」进入近端硬目标（须可复跑度量），非仅 stretch？ → A: **yes**
- Q9: 确认锁定上述总体目标？ → A: **yes**（按 Q5–Q8 齐套锁定）
- Q10: kburn→aster core = 手段（进 Core/ACP 服务 Meta Harness）；不换总体、不另起第二套 Harness/编排产品？ → A: **yes**
- Q11: 「内核」= Core/ACP 一等能力（CLI/Studio 可组合 + 可复跑证据），非仅挂文档/安装脚本？ → A: **yes**
- Q12: 近端范围 = kburn 全套（`.kstudio` 工厂 + 12 conductor skills），非只挑子集？ → A: **yes**
- Q13: 成功条 = Core 内化自动触发；不要求接 TUI / Studio？ → A: **yes**（user 2026-11-17）
- Q14: `.kstudio` AI 工程树内化到 `.aster/` 根下（非 `.aster/kstudio`；遗留 `.kstudio/` 兼容）？ → A: **yes**（user 2026-11-17 更正）

## Sources

- user `/goal`: Aster 定位 Meta Harness；目标 = 可组合、高效、可信的 Harness
- user: Q5–Q8 均为 **是**
- user `/goal` 2026-11-17: 把 https://github.com/kense-labs/kburn 能力内核到 aster core；Q10–Q12 = **是**
- user 2026-11-17: 「aster core 能内化自动触发就行，不需要接 TUI 和 Studio」→ Q13
- user 2026-11-17: 「.kstudio AI工程文件夹也要内化到 .aster 目录」→ Q14
- prior GOALS: Codex 吸收 + 日常稳定使用 → 手段 / 可信条组成部分（未改总体）
- sitrep: bootstrap；缺陷机制审计已归档；CLI 0.3.9 通道已发；≠Pass
- upstream（手段）: `kense-labs/kburn`
