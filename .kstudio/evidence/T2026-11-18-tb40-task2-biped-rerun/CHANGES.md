# TB4.0 task2 re-eval · harness optimizations applied

Trial: `jobs/2026-11-18__04-38-21/biped-contact-dynamics__86BLfYQ`  
Model: `kimi-01/k3.1-pro` via `/tmp/aster-tb-kimi.acl`

## Root causes addressed

| ID | Cause | Fix |
| --- | --- | --- |
| P1 | Pregate Finish after 2 tool-stops while npz missing | `--require-path` + task.toml artifacts; `NudgeMissingArtifacts` up to 24 |
| P0 | rewardkit `Untrusted parent directory of /logs/verifier` when `/logs` is mode 777 | Harbor local patch: `chmod 755 /logs` after ensure/empty and before separate verify; adapter mkdir also restores 755 |
| Workdir | Runner used `/root` while biped WORKDIR is `/app` | Adapter probes `pwd` when `task_env_config.workdir` absent |

## Observed at launch

```
--workspace /app
--require-path /app/submission
--require-path /app/results/walk.npz
--require-path /app/results/jump.npz
--require-path /app/results/run.npz
aster: artifact gate armed for 4 required path(s)
```

## Explicitly not claimed yet

- Reward / Mean for this trial (run in progress)
- Product Pass / overall GOALS Done
