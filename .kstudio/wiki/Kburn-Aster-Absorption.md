# kburn → Aster Core 机制吸收清单

Updated: 2026-11-17 · by: B via /yolo · status: **HG6 closed**（Q13）· ≠产品 Pass · ≠ Meta Harness Done

依据：GOALS HG6（Q10–Q12）+ `kense-labs/kburn` 私仓树 + Core `skills` 现状。  
硬约束：机制落地 + 可复跑证据；**挂文档/安装脚本 alone ≠ Pass**；不另发 kburn 产品；不扩第二套 Harness 面。

权威总体目标：`.kstudio/workflow/GOALS.md`（Meta Harness）。kburn = **手段**。

---

## 排序原则

1. 与既有 Core/ACP skill 加载与信任序对齐，不另起第二套 skill 总线。  
2. 先发现/加载（一等 root），再工厂/工作流工具接线，再宿主组合面。  
3. 完成定义须 hermetic；门禁绿 alone ≠ HG6 关闭。

---

## 吸收清单（排序）

### P0-1 · `.kstudio/skills` 为一等 skill root（本刀）

| | |
| --- | --- |
| **机制** | Core `agent_skill_roots` 含 `.kstudio/skills` + 末位 `.aster/skills`（later-wins）；ACP watch/load 同根 |
| **kburn** | 项目态技能落在工程根 `skills/`（12 conductor skills） |
| **Aster 落点** | `crates/code/core/src/skills/mod.rs`；ACP `watched_skill_dirs` / `interactive_skill_dirs` |
| **现状** | **已落地**：root 列表 + hermetic；证据 skill-root + `T2026-11-17-kburn-aster-root`；≠ HG6 全关闭 |
| **可验证完成定义** | (1) roots 含 `.aster/skills` 且末位；(2) 从工程根加载 conductor skills SKILL.md；(3) ACP 测试枚举同根；(4) OUTCOME |
| **非目标** | 嵌入 12 份 SKILL 正文进二进制；改信任序为 home 赢项目 |

### P0-2 · kburn 工厂（`.kstudio` skeleton）可被 Core 叙述/投影

| | |
| --- | --- |
| **机制** | `init` factory（layout contract + skeleton）作为内核可引用资产或生成路径 |
| **kburn** | `skills/init/assets/factory/` |
| **Aster 落点** | `crates/code/core/src/kstudio.rs`（路径 API）；后续：契约 JSON / 工厂资产 |
| **现状** | **落地**：`KstudioCoreDirs`/`resolve` + layout/extension 契约 JSON + factory 子集 vendoring（skeleton/contracts/rules）+ `materialize_kstudio_factory_seeds`；证据 layout-* / factory-bundle。schema 运行时校验未做 |
| **可验证完成定义** | hermetic：工厂契约/路径可从 Core API 断言；≠产品 Pass |
| **非目标** | 另发独立 kburn install 产品 |

### P0-3 · 12 conductor skills 工作流机制进内核契约（可组合）

| | |
| --- | --- |
| **机制** | 技能名/描述/资源目录经 ACP 能力投影；宿主可组合同一内核 |
| **kburn** | 12 skills + workflow Python helpers |
| **Aster 落点** | skill catalog / capability projection / 可选 program tools |
| **现状** | **窄刀**：`KBURN_SKILL_NAMES`（12）+ 名录限定 `load_kburn_skills`（忽略 README）+ coverage + MANIFEST/`resolve`；本仓 12/12 hermetic 可载；ACP compose 测；hermetic graders×3。SKILL 正文未嵌二进制；workflow 执行 / CLI·Studio 产品组合未做 |
| **可验证完成定义** | 可复跑：会话目录含 12 名可枚举；至少 1 条工作流辅助可测路径 |
| **非目标** | 七席常驻多 Agent 运行时；把 Cursor slash 当成唯一入口 |

### P1 · CLI / Studio 组合面消费

| | |
| --- | --- |
| **机制** | 宿主只组合内核已暴露的 kburn 能力 |
| **现状** | 规范根 **`.aster/`**（Q14 更正：非 `.aster/kstudio`）；遗留 `.kstudio/` 兼容；仅有 `config.acl` 不 auto-arm；ACP `/kburn` 可选。**TUI/Studio UI = 非目标**（Q13） |
| **非目标** | TUI / Studio kburn 专用接面；Studio 私自再装平行 skill 树 |

---

## HG6 关闭

证据：`.kstudio/evidence/T2026-11-17-hg6-close/OUTCOME.md`（hermetic 11 suites / L3 PASS / prior E2E + arm）。  
本仓现网仍 `.kstudio/`（产品 `.aster/` gitignore 运行时）——双根兼容，非 Q13 阻塞。

## 下一刀（总体 Meta Harness）

- H2 Studio land（需 commit/push 授权）
- headed / 日常可信证明
- 残余缺陷刀（例 E8 compaction Failed phase）
- 可选：本仓 eng 迁 `.aster/`（须先解开 gitignore 工程标记）

## Explicitly not claimed

- Meta Harness Done / 产品 Pass  
- 12 conductor skills SKILL 正文嵌进 Core 二进制  
- 无工程标记的普通仓会自动长出工程树（设计为跳过；仅 `config.acl` 亦不触发）  
- TUI / Studio kburn UI（明确非目标）  
- headed / push / commit 授权
