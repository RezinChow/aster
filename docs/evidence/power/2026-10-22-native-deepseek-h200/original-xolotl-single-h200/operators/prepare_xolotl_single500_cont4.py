"""Freeze one successor after the exact cont3 job AND replica are terminal."""
import ast,json,shutil
from xolotl_trial_common import BASE,WORK,lease,observe
r=lease();o=observe()
if r['submitted']['uid']!='662c0a01-26eb-4e72-9d39-2e07ef2619c0' or o['job_uid']!=r['submitted']['uid'] or o['phase']!='Succeeded' or len(o['replicas'])!=1 or o['replicas'][0]['uid']!='3d6468ab-be54-48a2-8d17-5cfa8ba4e15e' or o['replicas'][0]['phase']!='Succeeded':raise RuntimeError('exact terminal cont3 proof differs; do not create a new request')
proof=BASE/'xolotl-single500-cont3-terminal-proof.json'
if proof.exists():
 old=json.loads(proof.read_text())
 if (old['job_uid'],old['phase'],old['replicas'][0]['uid'],old['replicas'][0]['phase'])!=(o['job_uid'],o['phase'],o['replicas'][0]['uid'],o['replicas'][0]['phase']):raise RuntimeError('archived cont3 terminal proof differs')
else:shutil.copy2(BASE/'xolotl-trial-resource-latest.json',proof)
out=BASE/'submit_xolotl_single500_cont4_lease.frozen.py'
if out.exists():raise RuntimeError('cont4 submitter exists; inspect instead of regenerating')
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
for k,v in dict(JOB=o['job'],REPLICA=o['replicas'][0]['name'],UID=o['job_uid'],RID=o['replicas'][0]['uid']).items():guard=guard.replace('@'+k+'@',repr(v))
compile(guard,'cont4-predecessor-guard','exec')
s=(BASE/'submit_xolotl_single500_cont3_lease.frozen.py').read_text();a=s.index('guard_code=');b=s.index('\nguard_result=',a);s=s[:a]+'guard_code='+repr(guard)+s[b:]
for a,b in [('xolotl-single500-cont3-lease-pending.json','xolotl-single500-cont4-lease-pending.json'),("name='aster-xolotl-500c3-'","name='aster-xolotl-500c4-'"),('bounded one-hour third continuation: exact activation-sum reuse for small PTQ expert groups toward500 tok/s, with300 first','bounded one-hour fourth continuation: same-backend asynchronous dense execution and allocator/cache lifetime stress toward500 tok/s, with300 first')]:
 if s.count(a)!=1:raise RuntimeError('cont4 derivation anchor differs')
 s=s.replace(a,b)
ast.parse(s);out.write_text(s);print(json.dumps(dict(prepared_only=True,predecessor_uid=o['job_uid'],gpus=1,lease_seconds=3600,path=str(out))))
