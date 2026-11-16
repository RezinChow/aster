# T2026-11-16-codex-absorb

## Task

D · docs_goals：产出 **Codex→Aster 机制吸收清单**（排序 · 路径映射 · 可验证完成定义），写入 wiki + evidence；引用 openai/codex 与本仓事实，衔接 B scan。≠产品 Pass。

## Inputs

| Source | Ref |
| --- | --- |
| Goals | `.kstudio/workflow/GOALS.md`（locked） |
| Wave plan | `.kstudio/workflow/waves/bootstrap/work-plan.md` |
| B scan | `.kstudio/evidence/T2026-11-16-codex-scan/`（Codex `/tmp/openai-codex` @ `5cb38e79842a0e0a6dca5bb97874163e8ee50129`） |
| Aster HEAD | `291c2afafdced86087dc7c0e8d7e1bed5b24ac04` · branch `main` |
| Aster map | `crates/effect`, `crates/code/core/{permissions,sandbox,compaction,hooks,skills,config,capability,tools/builtin}`, `crates/code/acp`, `crates/acl` |

## Outputs

| Artifact | Path |
| --- | --- |
| Absorption list (wiki) | `.kstudio/wiki/Codex-Aster-Absorption.md` |
| This receipt | `.kstudio/evidence/T2026-11-16-codex-absorb/OUTCOME.md` |
| Tasks registry | `.kstudio/wiki/Tasks.md`（本任务条目） |

## Checklist coverage

清单含每项：机制名、Codex 源路径、Aster 落点、可验证完成定义、非目标。  
排序：P0-1…P0-4 → P1-5…P1-8 → P2-9…P2-12；首批建议 P0-1→P0-4。

## Commands / verification (docs-only)

```bash
test -f .kstudio/wiki/Codex-Aster-Absorption.md
test -f .kstudio/evidence/T2026-11-16-codex-scan/CANDIDATES.md
test -d crates/effect/src
test -d crates/code/core/src/permissions
# no apps/ crates/ mutations; no Codex copy into repo
```

Observed: wiki + evidence files written; Aster counterpart dirs present. No product tests executed for absorption (docs_goals only).

## Explicitly not claimed

- 产品 Pass / 日常稳定使用
- 机制已实现或 CI 绿
- 「像 Codex」观感
- 功能对等清单
- 改动 `apps/` / `crates/`
