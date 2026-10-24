"""Read-only quota and predict-only checks for the one accepted eight-card job."""
import importlib.util
import json
from pathlib import Path

BASE=Path('D:/code/aster/target/h200-native')
intent=json.loads((BASE/'h200-resource-validation-8-attempt2-pending.json').read_text())
spec=importlib.util.spec_from_file_location('remote',BASE/'remote_readonly.py')
remote=importlib.util.module_from_spec(spec);spec.loader.exec_module(remote)
code='''import json,subprocess,shlex,time
intent=INTENT
def run(args,timeout=45):
 p=subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(args)],capture_output=True,text=True,timeout=timeout)
 if len(p.stdout)>1048576 or len(p.stderr)>65536:raise RuntimeError('read output bound exceeded')
 return p
queue=run(['brainctl','get','queue','ailab-hrprdduanyan-hrprda3s-gpu-pool','-o','json'])
if queue.returncode:raise RuntimeError('quota read failed: '+queue.stderr[-2000:])
q=json.loads(queue.stdout)
arguments=intent['command'].copy();arguments.insert(2,'--predict-only=true')
prediction=run(arguments,timeout=60)
lines=prediction.stdout.splitlines()
rows=[line for line in lines if line.startswith('|')]
node=run(['brainctl','get','node','gpu-l-lg-cmc-h-h200-0061.host.h.pjlab.org.cn','-o','json'])
n=json.loads(node.stdout) if node.returncode==0 else None
result=dict(observedAtEpoch=int(time.time()),queue=dict(capability=q.get('spec',{}).get('capability'),status=q.get('status')),prediction=dict(exit=prediction.returncode,statusLines=[line for line in lines if any(value in line for value in ['任务调度核心状态','可调度数量','不可调度数量'])],firstRows=rows[:12],stderr=prediction.stderr[-4000:]),maintenanceCandidate=None)
if n:result['maintenanceCandidate']=dict(name=n['metadata']['name'],unschedulable=n.get('spec',{}).get('unschedulable'),taints=n.get('spec',{}).get('taints'),conditions=n.get('status',{}).get('conditions'))
print(json.dumps(result))
'''.replace('INTENT',repr(intent))
result=remote.inspect_jump(code,timeout=150)
path=BASE/('h200-resource-current-capacity-'+str(result['observedAtEpoch'])+'.json')
path.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(dict(path=str(path),**result),indent=2))
