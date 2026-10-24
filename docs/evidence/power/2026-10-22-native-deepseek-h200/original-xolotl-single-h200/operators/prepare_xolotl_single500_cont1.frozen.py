"""Freeze one one-hour single-H200 follow-up; require the current lease to end."""
import ast,hashlib,json
from xolotl_trial_common import BASE,WORK,lease

out=BASE/'submit_xolotl_single500_cont1_lease.frozen.py'
if out.exists():raise RuntimeError('single300 submitter exists; inspect it rather than regenerate')
old=lease();observed=json.loads((BASE/'xolotl-trial-resource-latest.json').read_text())
if observed['job_uid']!=old['submitted']['uid'] or len(observed['replicas'])!=1:raise RuntimeError('previous allocation identity differs')
replica=observed['replicas'][0]
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
for key,val in dict(JOB=old['submitted']['rjob'],REPLICA=replica['name'],UID=old['submitted']['uid'],RID=replica['uid']).items():guard=guard.replace('@'+key+'@',repr(val))
compile(guard,'single300-terminal-guard','exec')
s=(BASE/'submit_xolotl_pair_lease.frozen.py').read_text();start=s.index('guard_code=');end=s.index('\nguard_result=',start)
s=s[:start]+'guard_code='+repr(guard)+s[end:]
for a,b in [
 ('choices=[2]','choices=[1]'),('choices=[1,2]','choices=[1]'),
 ('xolotl-pair-lease-pending.json','xolotl-single500-cont1-lease-pending.json'),
 ('if args.gpus!=2 or args.attempt!=1','if args.gpus!=1 or args.attempt!=1'),
 ('native deployment lease requires exactly one new eight-GPU request','single300 lease requires exactly one single-H200 request'),
 ("source=scratch/'xolotl-pair-resource-probe.frozen.py'","source=worktree/'scripts/h200_xq/resource_probe.py'"),
 ("name='aster-xolotl-pair-'","name='aster-xolotl-500c1-'"),
 ('lease=7200','lease=3600'),('timeout=7220','timeout=3620'),
 ('7260 ','3660 '),("str(220*1024*args.gpus)","str(440*1024)"),
 ('bounded two-hour original Xolotl H200 trial explicitly requested by user','bounded one-hour continuation of the single-H200 500 token/s goal, with the current 300 token/s milestone')
]:
 if s.count(a)!=1:raise RuntimeError('submitter derivation anchor changed: '+a)
 s=s.replace(a,b)
start=s.index('if args.attempt==2:');end=s.index("stage='''",start);s=s[:start]+s[end:]
ast.parse(s);out.write_text(s,encoding='utf-8')
print(json.dumps(dict(prepared_only=True,submitter=str(out),gpus=1,cpu=40,memory_gib=440,lease_seconds=3600,previous_job=old['submitted']['rjob'],must_follow_terminal_previous=True,sha256=hashlib.sha256(out.read_bytes()).hexdigest()),indent=2))
