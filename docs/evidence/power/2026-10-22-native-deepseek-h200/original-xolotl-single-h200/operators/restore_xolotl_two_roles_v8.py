"""Restore two exact single-H200 roles only after the old public engine is reaped."""
import json
import time

from xolotl_serving_cont5_frozen_v8 import BASE, observe, owned

path = BASE / 'xolotl-two-role-v8-restoration.json'
if path.exists():
    raise RuntimeError('observe existing V8 role restoration instead')
old = json.loads((BASE / 'xolotl-stable-service-v4-intent.json').read_text())
current = json.loads((BASE / 'xolotl-stable-service-v8-intent.json').read_text())
observation = observe()
if observation['job_uid'] != old['allocation_uid'] or observation['phase'] != 'Running':
    raise RuntimeError('old exact serving allocation differs')
code = '''import json,subprocess,time
from pathlib import Path
r=@R@
state=json.loads((Path(r['root'])/'service-longctx-v1-result.json').read_text())
apps=subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8,check=True).stdout.strip()
if state['phase']!='stopped' or not state.get('api_reaped') or apps:raise RuntimeError('old public engine must be stopped/reaped and GPU idle')
p=Path('/proc/'+str(r['process']['pid'])+'/stat')
if p.exists() and int(p.read_text().split(') ',1)[1].split()[19])==r['process']['start_ticks']:raise RuntimeError('old public supervisor is not gone')
print(json.dumps(dict(unix=time.time(),old_state=state,gpu_apps=apps,old_supervisor_gone=True)))
'''.replace('@R@', repr(old))
proof = owned(code)
lease = json.loads((BASE / 'xolotl-single500-cont5-lease-pending.json').read_text())
guard = json.loads((BASE / 'xolotl-active-serving-reservation.json').read_text())
if lease['submitted']['uid'] != old['allocation_uid'] or guard['allocation_uid'] != current['allocation_uid']:
    raise RuntimeError('new serving guard or released optimization lease differs')
(BASE / 'xolotl-current-optimization-lease.json').write_text(json.dumps(lease, indent=2) + '\n')
import xolotl_trial_common as trial
trial_observation = trial.observe()
if trial_observation['job_uid'] != old['allocation_uid']:
    raise RuntimeError('new optimization alias resolves to the wrong allocation')
record = dict(unix=time.time(), phase='passed', maximum_physical_h200=2,
              serving=dict(allocation_uid=current['allocation_uid'], gpu_uuid=current['gpu_uuid'], intent='xolotl-stable-service-v8-intent.json',
                           context_tokens=1048576, lease_ends_unix=current['plan']['lease_ends_unix']),
              optimization=dict(allocation_uid=old['allocation_uid'], gpu_uuid=old['gpu_uuid'], no_active_model_worker=True,
                                lease_ends_unix=old['plan']['lease_ends_unix']), drained_previous_service=proof)
path.write_text(json.dumps(record, indent=2) + '\n')
a = json.loads((BASE / 'active-worktree.json').read_text())
a.update(current_service_context_tokens=1048576, current_service_base_url='http://10.102.93.68/v1',
         current_service_intent=str(BASE / 'xolotl-stable-service-v8-intent.json'),
         current_serving_allocation_uid=current['allocation_uid'], current_serving_gpu_uuid=current['gpu_uuid'],
         current_optimization_allocation_uid=old['allocation_uid'], current_optimization_gpu_uuid=old['gpu_uuid'],
         current_service_available=True, current_service_basic_chat_verified=True, current_service_fully_verified=False,
         actual_prompt_tokens_qualified=131073, full_1m_length_qualified=False,
         current_optimization_no_active_model_worker=True, current_original_engine_trial=None,
         current_original_engine_trial_phase='no_active_worker', tool_call_defect_open=True,
         current_goal_objective='深度优化单卡 1M 上下文 部署的正确性和速度')
(BASE / 'active-worktree.json').write_text(json.dumps(a, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(dict(phase='passed', serving_gpu=current['gpu_uuid'], optimization_gpu=old['gpu_uuid'], optimization_idle=True)))
