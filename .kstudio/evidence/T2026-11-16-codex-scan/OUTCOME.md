# T2026-11-16-codex-scan

## Task

B · implement（只读扫描）：从 `openai/codex` 提炼**可借鉴机制**候选（路径 + 为何优 + 与功能对等无关），写入本目录。≠产品 Pass。

## Source pin

| Field | Value |
| --- | --- |
| Remote | `https://github.com/openai/codex.git`（GOALS 上游 `org-14957082@github.com:openai/codex.git` 的公开镜像） |
| Clone | `/tmp/openai-codex`（临时；**未**拷进 Aster 仓） |
| HEAD | `5cb38e79842a0e0a6dca5bb97874163e8ee50129` |
| Subject | `Fix config reads with relative working directories (#61663)` |
| Commit time (UTC) | 2026-11-15 15:25:56 |
| Scan time (UTC) | 2026-11-15T19:07:49Z |
| Aster HEAD (reference only) | `291c2afafdced86087dc7c0e8d7e1bed5b24ac04` on `main` |

## Method

```bash
git clone --depth 1 https://github.com/openai/codex.git /tmp/openai-codex
# full tree checkout after sparse disable
# read-only: docs/, codex-rs/{rollout,execpolicy,sandboxing,linux-sandbox,apply-patch,features,hooks,config,protocol,app-server-protocol,skills,core}/…
# no Aster apps/ crates/ edits; no Codex copy into repo
```

Exit: clone + tree materialization succeeded (observed locally). No Aster product tests run.

## Artifacts in this evidence path

| File | Role |
| --- | --- |
| `OUTCOME.md` | 本回执 |
| `CANDIDATES.md` | Top 12 + 5 荣誉提名（机制名 / Codex 路径 / 为何优 / 复杂度） |

## Top 候选（短报摘要）

1. **Append-only rollout + reverse JSONL resume** — `codex-rs/rollout/`
2. **Execpolicy 自测规则（match/not_match @ load）** — `codex-rs/execpolicy/`
3. **SQ/EQ Session·Task·Turn 协议实体模型** — `codex-rs/docs/protocol_v1.md` + `protocol/`
4. **PermissionProfile → 平台后端 + violation 事件** — `sandboxing/` + `linux-sandbox/` + `process-hardening/`
5. **Managed requirements / Constrained 分层配置** — `codex-rs/config/`
6. **Compaction 作为预算生命周期** — `core/src/compact*.rs` + `context_manager/`
7. **Verified apply-patch 管道** — `codex-rs/apply-patch/`
8. **外置 app-server-protocol + schema fixtures** — `app-server-protocol/`
9. **Feature Stage 注册表** — `codex-rs/features/`
10. **Typed lifecycle hooks + managed-only** — `codex-rs/hooks/`
11. **Elicitation pause 协调** — `core/src/elicitation.rs` + protocol approvals
12. **Skills 部分成功加载 + snapshot cache** — `codex-rs/skills/`

详表见 `CANDIDATES.md`。

## Explicitly not claimed

- 产品 Pass / 日常稳定使用
- 与 Codex 功能对等清单或复刻
- 已把 Codex 代码并入 Aster
- Aster `apps/` / `crates/` 行为变更
- `cargo test` / CI 绿
- D 终稿吸收清单（由 D 另写 wiki + 其 evidence）
