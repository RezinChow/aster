"""Separate one serving H200 from one optimization H200, explicitly requested by user."""
import ast,json
from xolotl_trial_common import BASE,lease,observe
out=BASE/'submit_xolotl_single_serving_lease.frozen.py'
if out.exists():raise RuntimeError('serving submitter already frozen; inspect existing intent')
r=lease();o=observe()
if o['job_uid']!=r['submitted']['uid'] or o['phase']!='Running' or len(o['replicas'])!=1 or o['replicas'][0]['phase']!='Running' or o.get('resource-result.json',{}).get('phase')!='passed':raise RuntimeError('optimization allocation identity/state differs')
guard='''import subprocess,shlex,json
def get(args):
 p=subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(['brainctl','get']+args+['-n','ailab-hrprdduanyan','-o','json'])],capture_output=True,text=True,timeout=20,check=True)
 if len(p.stdout)>32*1024**2:raise RuntimeError('serving role inventory bound exceeded')
 return json.loads(p.stdout)
j=get(['rjob',@JOB@]);r=get(['replica',@REP@])
if j['metadata']['uid']!=@UID@ or r['metadata']['uid']!=@RID@ or j['status']['phase']!='Running' or r['status']['phase']!='Running':raise RuntimeError('expected separate optimization allocation differs')
alljobs=get(['rjobs'])
for x in alljobs.get('items',[]):
 if x['metadata'].get('annotations',{}).get('kubebrain.brainpp.cn/showname','').startswith('aster-xolotl-serving-') and x['status']['phase'] not in ['Stopped','Succeeded','Failed']:raise RuntimeError('another owned stable serving request already exists')
print(json.dumps(dict(user_authorized_parallel_roles=True,maximum_total_h200=2,optimization_job_uid=j['metadata']['uid'],optimization_replica_uid=r['metadata']['uid'],serving_gpus=1)))
'''
for k,v in dict(JOB=o['job'],UID=o['job_uid'],REP=o['replicas'][0]['name'],RID=o['replicas'][0]['uid']).items():guard=guard.replace('@'+k+'@',repr(v))
compile(guard,'serving-role-allocation-guard','exec')
s=(BASE/'submit_xolotl_single500_cont4_lease.frozen.py').read_text();a=s.index('guard_code=');b=s.index('\nguard_result=',a);s=s[:a]+'guard_code='+repr(guard)+s[b:]
changes=[('xolotl-single500-cont4-lease-pending.json','xolotl-single-serving-lease-pending.json'),("name='aster-xolotl-500c4-'","name='aster-xolotl-serving-'"),('lease=3600','lease=21600'),('timeout=3620','timeout=21620'),(' 3660 ',' 21660 '),('bounded one-hour fourth continuation: same-backend asynchronous dense execution and allocator/cache lifetime stress toward500 tok/s, with300 first','Stable single-H200 authenticated API service, six-hour bounded initial access window; explicitly separate from the other single-H200 optimization allocation')]
for a,b in changes:
 if s.count(a)!=1:raise RuntimeError('serving submit derivation anchor differs: '+a)
 s=s.replace(a,b)
s=s.replace('exact prior allocation must be terminal before trial: ','explicit separate serving/optimization role guard failed: ')
ast.parse(s);out.write_text(s)
s=(BASE/'xolotl_trial_common.py').read_text();a=s.index('def lease():');b=s.index('\ndef observe():',a)
s=s[:a]+'''def lease():
    current=json.loads((BASE/'xolotl-single-serving-lease-pending.json').read_text())
    if current.get('phase') not in ('submitted','submission_needs_inspection') or not current.get('submitted') or current.get('expected_gpus')!=1:
        raise RuntimeError('one explicit serving allocation is not submitted')
    return current
\n'''+s[b:]
s=s.replace('xolotl-trial-resource-latest.json','xolotl-serving-resource-latest.json')
ast.parse(s);(BASE/'xolotl_serving_common.py').write_text(s)
record=dict(user_instruction='先在一张 H200 部署稳定的服务，然后另一张 H200 继续完成优化',roles=dict(serving=1,optimization=1),maximum_total_h200=2,initial_serving_window_seconds=21600,optimization_job_uid=o['job_uid'],optimization_gpu_uuid=o['resource-result.json']['gpus'][0]['uuid'],selected_baseline=str(BASE/'qualified-xolotl-single-h200-baseline.json'),experimental_candidate_for_serving=False)
(BASE/'xolotl-two-role-deployment-plan.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(prepared=True,serving_gpus=1,optimization_gpus=1,initial_serving_window_seconds=21600)))
