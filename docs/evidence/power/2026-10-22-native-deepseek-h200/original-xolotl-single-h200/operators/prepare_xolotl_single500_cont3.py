"""Freeze one successor only after a fresh exact terminal cont2 observation."""
import ast,json
from xolotl_trial_common import BASE,WORK,lease,observe
old=lease();o=observe()
if old['submitted']['uid']!='13500b32-b68b-4d0f-8c70-08cc1e4e5e7d' or o['job_uid']!=old['submitted']['uid'] or o['phase']!='Succeeded' or len(o['replicas'])!=1 or o['replicas'][0]['uid']!='a1ffdeaf-0296-4788-85ca-48a93be6186d' or o['replicas'][0]['phase']!='Succeeded':raise RuntimeError('exact terminal cont2 differs')
out=BASE/'submit_xolotl_single500_cont3_lease.frozen.py'
if out.exists():raise RuntimeError('cont3 submitter exists; inspect instead of regenerate')
guard=(WORK/'scripts/h200_native/handover.py').read_text()+'''
import subprocess,shlex,json
def get(kind,name):
 p=subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(['brainctl','get',kind,name,'-n','ailab-hrprdduanyan','-o','json'])],capture_output=True,text=True,timeout=20,check=True)
 if len(p.stdout)>1048576:raise RuntimeError('metadata bound exceeded')
 return json.loads(p.stdout)
j=get('rjob',@JOB@);r=get('replica',@REPLICA@)
require_terminal_allocation(j,r,@UID@,@RID@)
print(json.dumps(dict(job_uid=j['metadata']['uid'],job_phase=j['status']['phase'],replica_uid=r['metadata']['uid'],replica_phase=r['status']['phase'])))
'''
for key,val in dict(JOB=o['job'],REPLICA=o['replicas'][0]['name'],UID=o['job_uid'],RID=o['replicas'][0]['uid']).items():guard=guard.replace('@'+key+'@',repr(val))
compile(guard,'cont3-exact-predecessor','exec')
s=(BASE/'submit_xolotl_single500_cont2_lease.frozen.py').read_text();a=s.index('guard_code=');b=s.index('\nguard_result=',a);s=s[:a]+'guard_code='+repr(guard)+s[b:]
for a,b in [('xolotl-single500-cont2-lease-pending.json','xolotl-single500-cont3-lease-pending.json'),("name='aster-xolotl-500c2-'","name='aster-xolotl-500c3-'"),('bounded one-hour second continuation: single-H200 merged dispatch, speculative verification and original MTP controls toward500 tok/s, with300 first','bounded one-hour third continuation: exact activation-sum reuse for small PTQ expert groups toward500 tok/s, with300 first')]:
 if s.count(a)!=1:raise RuntimeError('cont3 derivation anchor differs')
 s=s.replace(a,b)
ast.parse(s);out.write_text(s)
print(json.dumps(dict(prepared_only=True,path=str(out),lease_seconds=3600,gpus=1,previous_uid=o['job_uid'])))
