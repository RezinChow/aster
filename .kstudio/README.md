# 项目 AI 工程

.kstudio 记录本项目的目标、编排与验证证据。初始化仅建立结构，不代表产品验收。

从 `/k-goal` 澄清总体目标，以 `/k-task` 处理当前任务，以 `/k-plan` 规划全项目；
`/k-go` 规划后同会话做完，`/k-yolo` 按总体目标无人值守。
`/k-review` 检查改动与证据；`/k-clean` 先出清单。角色与资源须显式晚绑定。

十二技能（P15）：`k-init` · `k-status` · `k-progress` · `k-plan` · `k-go` · `k-yolo` · `k-task` · `k-loop` · `k-goal` · `k-wiki` · `k-clean` · `k-review`

```bash
python3 .kstudio/workflow/sync-k-skills.py
python3 .kstudio/workflow/sync-k-skills.py --check
python3 .kstudio/workflow/verify-ai-eng.py --level L3
```

产品规范权威：[KStudio 产品设计](https://github.com/kense-labs/kstudio/blob/main/docs/product-design-plan.md)。
