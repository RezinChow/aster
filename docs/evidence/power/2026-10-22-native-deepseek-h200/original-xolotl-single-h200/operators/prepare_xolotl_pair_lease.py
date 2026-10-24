"""Supersede the exact unschedulable trial with a schedulable two-H200 trial."""
import ast,hashlib,json,time
from xolotl_trial_common import BASE,WORK,lease,jump
old=lease()
out=BASE/'submit_xolotl_pair_lease.frozen.py'
if out.exists():raise RuntimeError('pair submitter exists; never repeat preparation')
code='''import json,subprocess,shlex,time
old=@OLD@
def cli(args):return subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(args)],capture_output=True,text=True,timeout=20,check=True)
job=json.loads(cli(['brainctl','get','rjob',old['submitted']['rjob'],'-n','ailab-hrprdduanyan','-o','json']).stdout)
if job['metadata']['uid']!=old['submitted']['uid'] or job['status']['phase']!='Inqueue':raise RuntimeError('queued predecessor changed; no stop')
replicas=json.loads(cli(['brainctl','get','replicas','-n','ailab-hrprdduanyan','-l','rjob.brainpp.cn/rjob-name='+old['submitted']['rjob'],'-o','json']).stdout)['items']
if len(replicas)!=1 or replicas[0]['status']['phase']!='Starting' or replicas[0]['status'].get('nodeName') or replicas[0]['status'].get('podIP'):raise RuntimeError('trial predecessor may have started; no stop')
stopped=cli(['rjob','stop','--namespace','ailab-hrprdduanyan',old['submitted']['rjob']])
job=json.loads(cli(['brainctl','get','rjob',old['submitted']['rjob'],'-n','ailab-hrprdduanyan','-o','json']).stdout)
print(json.dumps(dict(unix=time.time(),job=job['metadata']['name'],uid=job['metadata']['uid'],phase=job['status']['phase'],replica=replicas[0]['metadata']['name'],replica_uid=replicas[0]['metadata']['uid'],stdout=stopped.stdout)))
'''.replace('@OLD@',repr(old))
stopped=jump(code)
(BASE/'xolotl-eight-pending-superseded.json').write_text(json.dumps(stopped,indent=2)+'\n')
if stopped['phase']!='Stopped':raise RuntimeError('observe stopped predecessor before preparing replacement')
worker=(WORK/'scripts/h200_xq/resource_probe.py').read_text()
if worker.count('choices=[1, 8]')!=1:raise RuntimeError('resource worker expected-GPU contract changed')
worker=worker.replace('choices=[1, 8]','choices=[2]')
workerpath=BASE/'xolotl-pair-resource-probe.frozen.py'
workerpath.write_text(worker,encoding='utf-8',newline='\n')
source=(BASE/'submit_xolotl_trial_lease.frozen.py').read_text()
# Guard the exact queued predecessor rather than an older stopped allocation.
for a,b in [("previous['allocation_job']",'' )]:pass
start=source.index('guard_code=')
end=source.index('\nguard_result=',start)
guard=(WORK/'scripts/h200_native/handover.py').read_text()+'''
import subprocess,shlex,json
def get(kind,name):return json.loads(subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(['brainctl','get',kind,name,'-n','ailab-hrprdduanyan','-o','json'])],capture_output=True,text=True,timeout=20,check=True).stdout)
j=get('rjob',@JOB@);r=get('replica',@REPLICA@)
require_terminal_allocation(j,r,@UID@,@RID@)
print(json.dumps(dict(job_uid=j['metadata']['uid'],job_phase=j['status']['phase'],replica_uid=r['metadata']['uid'],replica_phase=r['status']['phase'])))
'''
for k,v in {'JOB':stopped['job'],'UID':stopped['uid'],'REPLICA':stopped['replica'],'RID':stopped['replica_uid']}.items():guard=guard.replace('@'+k+'@',repr(v))
source=source[:start]+'guard_code='+repr(guard)+source[end:]
for a,b in [
 ('choices=[1,8]','choices=[2]'),('if args.gpus!=8','if args.gpus!=2'),
 ('xolotl-trial-lease-pending.json','xolotl-pair-lease-pending.json'),
 ("source=worktree/'scripts/h200_xq/resource_probe.py'","source=scratch/'xolotl-pair-resource-probe.frozen.py'"),
 ("name='aster-xolotl-trial-'","name='aster-xolotl-pair-'"),
 ("'--cpu='+str(20*args.gpus)","'--cpu=40'"),
]:
 if a not in source:raise RuntimeError('pair derivation anchor changed: '+a)
 source=source.replace(a,b)
ast.parse(source)
out.write_text(source,encoding='utf-8')
print(json.dumps(dict(prepared_only=True,previous=stopped,gpus=2,cpu=40,memoryGiB=440,lease_seconds=7200,sha256=hashlib.sha256(out.read_bytes()).hexdigest()),indent=2))
