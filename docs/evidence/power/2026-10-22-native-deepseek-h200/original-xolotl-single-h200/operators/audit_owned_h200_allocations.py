"""Audit only allocation names/UIDs recorded by this task; never touch other jobs."""
import json
from xolotl_trial_common import BASE,jump
records=[]
for name in ['h200-resource-validation-8-pending.json','h200-resource-validation-8-attempt2-pending.json','native-h200-deployment-lease-pending.json','native-h200-optimization-lease-pending.json','xolotl-trial-lease-pending.json','xolotl-pair-lease-pending.json']:
 p=BASE/name
 if p.exists():
  v=json.loads(p.read_text())
  if 'submitted' in v:records.append(dict(file=name,name=v['submitted']['rjob'],uid=v['submitted']['uid']))
code='''import json,subprocess,shlex,time
records=@RECORDS@
def cli(args):
 p=subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(args)],capture_output=True,text=True,timeout=20,check=True)
 if len(p.stdout)>1048576:raise RuntimeError('allocation audit bound exceeded')
 return json.loads(p.stdout)
out=[]
for record in records:
 j=cli(['brainctl','get','rjob',record['name'],'-n','ailab-hrprdduanyan','-o','json'])
 if j['metadata']['uid']!=record['uid']:raise RuntimeError('owned allocation UID changed')
 rs=cli(['brainctl','get','replicas','-n','ailab-hrprdduanyan','-l','rjob.brainpp.cn/rjob-name='+record['name'],'-o','json'])
 out.append(dict(**record,phase=j['status']['phase'],finish=j['status'].get('finishTime'),replicas=[dict(name=r['metadata']['name'],phase=r['status']['phase'],node=r['status'].get('nodeName'),ip=r['status'].get('podIP')) for r in rs.get('items',[])]))
print(json.dumps(dict(unix=time.time(),jobs=out)))
'''.replace('@RECORDS@',repr(records))
v=jump(code,100)
(BASE/'h200-owned-allocation-release-audit.json').write_text(json.dumps(v,indent=2)+'\n')
print(json.dumps(v,indent=2))
