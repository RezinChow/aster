"""Pin serving to the new cache-enabled H200 and optimization to the fully drained previous H200."""
import ast,json,time
from pathlib import Path
from xolotl_serving_original_common_v3 import BASE,owned,observe as old_observe
ip=BASE/'xolotl-two-role-v4-restoration.json'
if ip.exists():raise RuntimeError('V4 role restoration receipt exists; inspect it')
r=json.loads((BASE/'xolotl-stable-service-v3-intent.json').read_text());current=json.loads((BASE/'xolotl-stable-service-v4-intent.json').read_text());old_observe()
code='''import json,subprocess,time
from pathlib import Path
r=@R@
q=json.loads((Path(r['root'])/'service-longctx-v1-result.json').read_text())
apps=subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8,check=True).stdout.strip()
if q['phase']!='stopped' or not q.get('api_reaped') or apps:raise RuntimeError('previous serving engine must be completely reaped and GPU idle')
p=Path('/proc/'+str(r['process']['pid'])+'/stat')
if p.exists() and int(p.read_text().split(') ',1)[1].split()[19])==r['process']['start_ticks']:raise RuntimeError('previous serving supervisor must be gone')
print(json.dumps(dict(unix=time.time(),old_state=q,gpu_apps=apps,old_supervisor_gone=True)))
'''.replace('@R@',repr(r));compile(code,'drained-GPU-optimization-role-preflight','exec');proof=owned(code)
oldlease=json.loads((BASE/'xolotl-single-serving-lease-pending.json').read_text())
if oldlease['submitted']['uid']!=r['allocation_uid'] or json.loads((BASE/'xolotl-active-serving-reservation.json').read_text())['allocation_uid']!=current['allocation_uid']:raise RuntimeError('new serving guard and old optimization identities differ')
(BASE/'xolotl-current-optimization-lease.json').write_text(json.dumps(oldlease,indent=2)+'\n')
p=BASE/'xolotl_trial_common.py';s=p.read_text();anchor='def lease():\n'
if s.count(anchor)!=1 or 'xolotl-current-optimization-lease.json' in s:raise RuntimeError('current optimization lease override anchor differs')
override="""    role=BASE/'xolotl-current-optimization-lease.json'
    if role.exists():
        current=json.loads(role.read_text())
        if current.get('phase') not in ('submitted','submission_needs_inspection') or not current.get('submitted') or current.get('expected_gpus')!=1:
            raise RuntimeError('explicit current optimization role is not a submitted single GPU')
        return current
"""
s=s.replace(anchor,anchor+override);ast.parse(s);p.write_text(s)
import xolotl_trial_common as trial
o=trial.observe()
if o['job_uid']!=r['allocation_uid'] or o['resource-result.json']['gpus'][0]['uuid']!=r['gpu_uuid']:raise RuntimeError('current optimization role resolves to the wrong GPU')
rec=dict(unix=time.time(),phase='passed',serving=dict(allocation_uid=current['allocation_uid'],gpu_uuid=current['gpu_uuid'],intent='xolotl-stable-service-v4-intent.json',lease_ends_unix=current['plan']['lease_ends_unix']),optimization=dict(allocation_uid=r['allocation_uid'],gpu_uuid=r['gpu_uuid'],lease_ends_unix=r['plan']['lease_ends_unix'],current_lease='xolotl-current-optimization-lease.json',no_active_model_worker=True),drained_previous_service=proof,maximum_physical_h200=2)
ip.write_text(json.dumps(rec,indent=2)+'\n')
a=json.loads((BASE/'active-worktree.json').read_text());a.update(current_owned_allocation_intent=str(BASE/'xolotl-current-optimization-lease.json'),current_owned_resource_proof=str(BASE/'xolotl-trial-resource-latest.json'),current_owned_allocation_phase=o['phase'],current_optimization_allocation_uid=r['allocation_uid'],current_optimization_gpu_uuid=r['gpu_uuid'],current_serving_allocation_uid=current['allocation_uid'],current_serving_gpu_uuid=current['gpu_uuid'],current_service_base_url='http://10.102.93.68/v1',current_service_context_tokens=131072,current_service_intent=str(BASE/'xolotl-stable-service-v4-intent.json'),current_service_available=True,current_original_engine_trial=None,current_original_engine_trial_phase='no_active_worker',current_optimization_no_active_model_worker=True,workbuddy_gui_e2e_passed=False,tool_call_defect_open=True)
(BASE/'active-worktree.json').write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(dict(phase='passed',serving_gpu=current['gpu_uuid'],optimization_gpu=r['gpu_uuid'],optimization_gpu_idle=True,maximum_physical_h200=2)))
