# T2026-11-18 · TB4.0 task2 `biped-contact-dynamics`

Named YOLO：完成第2题评测，发现问题并给出优化计划。  
Job：`jobs/2026-11-18__03-27-56` · trial `biped-contact-dynamics__S88iAKA`  
Model：`kimi-01/k3.1-pro` · runner 已含 8h 预算 + `PREGATE_TOOL_STOPS=2`

## Score

| Metric | Result |
| --- | --- |
| Harbor | **Exceptions=1** · `RewardFileNotFoundError`（无 Mean/Reward） |
| Aster | `outcome=succeeded` · `agent_end` · ~14m · `maxExecutionTimeMs=28800000` |
| Artifacts | 仅有 `submission/solve.py`；**缺** `results/walk.npz` / `jump.npz` / `run.npz` |
| Verifier | **未写出 reward**；rewardkit 在 `Worker` 内崩 |

## Findings（因果）

1. **解不完整（主产品缺口）**  
   Agent 在动力学重构中途两次 `completed` → pregate nudge 2 次后 **Finish**。未导出三份 npz；`solve.py` 亦非可验收生成器。

2. **Pregate Finish 过早（Aster harness · task1 优化的副作用）**  
   `HARBOR_HOST_PREGATE_TOOL_STOPS=2` 对「已有工具即交 Harbor」有利于 task1；对本题（长地平线机器人学）会在**工件未齐**时退出。缺「必选 artifact 门闩」。

3. **Verifier 基建失败（环境 / Harbor）**  
   `PermissionError: Untrusted parent directory of /logs/verifier` → `WorkerSetupError` → 无 `reward.txt`。即使用户解完整，本机 Docker/Harbor 挂载下也可能评不出分。与 Aster 解质量正交，但阻塞有效打分。

4. **非主因**  
   预算 8h 足够；非 840s 误杀；模型已进入 Drake IK/逆动力学路径。

## Explicitly not claimed

- task2 Pass / reward 1.0  
- 已修复 pregate artifact 门闩并重跑绿  
- 全量 TB4.0  

## Artifacts

- `OPTIMIZATION_PLAN.md`  
- job 树：`jobs/2026-11-18__03-27-56/biped-contact-dynamics__S88iAKA/`
