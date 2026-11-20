# 出厂指挥 Skill → 复制到下游 `.kstudio/skills/`

```bash
cp -R share/kstudio-skillsconductor skills <repo>/.kstudio/skills/
cp share/kstudio-skills/GOALS.template.md <repo>/.kstudio/workflow/GOALS.md
cp share/kstudio-workflow-tools/* <repo>/.kstudio/workflow/
python3 <repo>/.kstudio/workflow/sync-k-skills.py
```

| Skill | Slash | 席位味 |
| --- | --- | --- |
| init | `/init` | 从项目事实或空目录补建工程根；保留已有文件 |
| status | `/status` | 波次/席位态势 |
| progress | `/progress` | 整仓完成度 %（GOALS×源码） |
| plan | `/plan` | 全项目/下一轮角色规划 |
| go | `/go` | 先 `/plan`，再同会话按序做完所有 `发给` 任务 |
| yolo | `/yolo` | 按 GOALS 自主规划、优先快赢、组合其它 conductor skills，无人值守直到完成 |
| task | `/task` | 仅当前任务相关角色的定向派工 |
| loop | `/loop` | 当前任务的有限、可恢复执行与验证循环 |
| goal | `/goal` | **S** 总体目标 / 海龟汤（一题一原生表单 · 不扩产品边界） |
| wiki | `/wiki` | DeepWiki 文档站 + `file://` |
| clean | `/clean` | **M** 组织有证据的代码/垃圾清理；默认 dry-run |
| review | `/review` | 源码语义审查、版本绑定证据与可执行纠错 |

规范：`docs/conductor-skills.md`（P15）。`progress` ≠ `status`（完成度% ≠ 波次态势）。  
派工/短报/态势/进度：军事简报（短、实、突出重点）；短报首行 `**席位**·机器·**结果**·约 $… USD tokens`；无值整行省略；重点加粗；规划前读短报（P19）；`tty-fmt.py task|report|bar`。
