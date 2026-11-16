# 出厂指挥 Skill → 复制到下游 `.kstudio/skills/`

```bash
cp -R share/kstudio-skills/k-* <repo>/.kstudio/skills/
cp share/kstudio-skills/GOALS.template.md <repo>/.kstudio/workflow/GOALS.md
cp share/kstudio-workflow-tools/* <repo>/.kstudio/workflow/
python3 <repo>/.kstudio/workflow/sync-k-skills.py
```

| Skill | Slash | 席位味 |
| --- | --- | --- |
| k-init | `/k-init` | 从项目事实或空目录补建工程根；保留已有文件 |
| k-status | `/k-status` | 波次/席位态势 |
| k-progress | `/k-progress` | 整仓完成度 %（GOALS×源码） |
| k-plan | `/k-plan` | 全项目/下一轮角色规划 |
| k-go | `/k-go` | 先 `/k-plan`，再同会话按序做完所有 `发给` 任务 |
| k-yolo | `/k-yolo` | 按 GOALS 自主规划、优先快赢、组合其它 `/k-*`，无人值守直到完成 |
| k-task | `/k-task` | 仅当前任务相关角色的定向派工 |
| k-loop | `/k-loop` | 当前任务的有限、可恢复执行与验证循环 |
| k-goal | `/k-goal` | **S** 总体目标 / 海龟汤（一题一原生表单 · 不扩产品边界） |
| k-wiki | `/k-wiki` | DeepWiki 文档站 + `file://` |
| k-clean | `/k-clean` | **M** 组织有证据的代码/垃圾清理；默认 dry-run |
| k-review | `/k-review` | 源码语义审查、版本绑定证据与可执行纠错 |

规范：`docs/conductor-skills.md`（P15）。`k-progress` ≠ `k-status`（完成度% ≠ 波次态势）。  
派工/短报/态势/进度：军事简报（短、实、突出重点）；短报首行 `**席位**·机器·**结果**·约 $… USD tokens`；无值整行省略；重点加粗；规划前读短报（P19）；`tty-fmt.py task|report|bar`。
