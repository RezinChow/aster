"""After exact cont4 completion, freeze a longer independent optimization lease."""
import ast,json,shutil
from xolotl_trial_common import BASE,WORK,lease,observe
from xolotl_serving_common import observe as observe_serving
r=lease();o=observe();s=observe_serving()
if o['job_uid']!='b226d64c-28cc-4f38-94d0-a02688df6133' or o['phase']!='Succeeded' or len(o['replicas'])!=1 or o['replicas'][0]['uid']!='d2dc214d-756b-45c7-846f-35a0a7c93c26' or o['replicas'][0]['phase']!='Succeeded':raise RuntimeError('exact completed cont4 job and replica proof is required')
if s['job_uid']!='ea86cb78-5efd-472c-a4f7-d97c38a95637' or s['phase']!='Running' or len(s['replicas'])!=1 or s['replicas'][0]['phase']!='Running':raise RuntimeError('independent stable serving identity differs')
p=BASE/'submit_xolotl_single500_cont5_lease.frozen.py'
if p.exists():raise RuntimeError('cont5 submitter already frozen; inspect intent')
shutil.copy2(BASE/'xolotl-trial-resource-latest.json',BASE/'xolotl-single500-cont4-terminal-proof.json')
guard=(WORK/'scripts/h200_native/handover.py').read_text()+'''
import subprocess,shlex,json
def get(kind,name):
 p=subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(['brainctl','get',kind,name,'-n','ailab-hrprdduanyan','-o','json'])],capture_output=True,text=True,timeout=20,check=True)
 if len(p.stdout)>1048576:raise RuntimeError('role proof metadata bound exceeded')
 return json.loads(p.stdout)
j=get('rjob',@JOB@);r=get('replica',@REP@);require_terminal_allocation(j,r,@UID@,@RID@)
s=get('rjob',@SJOB@);sr=get('replica',@SREP@)
if s['metadata']['uid']!=@SUID@ or sr['metadata']['uid']!=@SRID@ or s['status']['phase']!='Running' or sr['status']['phase']!='Running':raise RuntimeError('separate serving allocation identity/state differs')
print(json.dumps(dict(job_uid=j['metadata']['uid'],job_phase=j['status']['phase'],replica_uid=r['metadata']['uid'],replica_phase=r['status']['phase'],separate_serving_uid=s['metadata']['uid'],maximum_authorized_h200=2)))
'''
for k,v in dict(JOB=o['job'],REP=o['replicas'][0]['name'],UID=o['job_uid'],RID=o['replicas'][0]['uid'],SJOB=s['job'],SREP=s['replicas'][0]['name'],SUID=s['job_uid'],SRID=s['replicas'][0]['uid']).items():guard=guard.replace('@'+k+'@',repr(v))
compile(guard,'cont5-two-role-guard','exec');text=(BASE/'submit_xolotl_single500_cont4_lease.frozen.py').read_text();a=text.index('guard_code=');b=text.index('\nguard_result=',a);text=text[:a]+'guard_code='+repr(guard)+text[b:]
for a,b in [('xolotl-single500-cont4-lease-pending.json','xolotl-single500-cont5-lease-pending.json'),("name='aster-xolotl-500c4-'","name='aster-xolotl-500c5-'"),('lease=3600','lease=21600'),('timeout=3620','timeout=21620'),(' 3660 ',' 21660 '),('bounded one-hour fourth continuation: same-backend asynchronous dense execution and allocator/cache lifetime stress toward500 tok/s, with300 first','bounded six-hour fifth optimization continuation: qualified dense-chain V3 control and dense Q8/broader GPU execution toward300 then500 tok/s; stable serving remains on its separate owned H200')]:
 if text.count(a)!=1:raise RuntimeError('cont5 derivation anchor differs: '+a)
 text=text.replace(a,b)
ast.parse(text);p.write_text(text)
q=BASE/'xolotl_trial_common.py';text=q.read_text();a="for name in ['xolotl-single500-cont4-lease-pending.json',"
if text.count(a)!=1:raise RuntimeError('optimization lease priority anchor differs')
text=text.replace(a,"for name in ['xolotl-single500-cont5-lease-pending.json','xolotl-single500-cont4-lease-pending.json',");ast.parse(text);q.write_text(text)
print(json.dumps(dict(prepared=True,terminal_optimization_uid=o['job_uid'],separate_serving_uid=s['job_uid'],optimization_gpus=1,lease_seconds=21600)))
