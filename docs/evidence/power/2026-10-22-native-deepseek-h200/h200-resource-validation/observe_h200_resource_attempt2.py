"""Bounded read-only observation of the exact owned resource-verification job."""
import importlib.util
import json
from pathlib import Path
import time

BASE = Path('D:/code/aster/target/h200-native')
intent = json.loads((BASE / 'h200-resource-validation-8-attempt2-pending.json').read_text())
spec = importlib.util.spec_from_file_location('remote', BASE / 'remote_readonly.py')
remote = importlib.util.module_from_spec(spec)
spec.loader.exec_module(remote)
code = '''import json,subprocess,shlex,time
from pathlib import Path
intent=INTENT
name=intent['submitted']['rjob']; namespace='ailab-hrprdduanyan'
def cli(args,limit=1048576):
 command='. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(args)
 p=subprocess.run(['bash','-lc',command],capture_output=True,text=True,timeout=40)
 if p.returncode:raise RuntimeError('read command failed '+str(p.returncode)+': '+p.stderr[-2000:])
 if len(p.stdout)>limit:raise RuntimeError('read output bound exceeded')
 return p.stdout
job=json.loads(cli(['brainctl','get','rjob',name,'-n',namespace,'-o','json']))
if job['metadata']['uid']!=intent['submitted']['uid']:raise RuntimeError('owned job UID changed')
replicas=json.loads(cli(['brainctl','get','replicas','-n',namespace,'-l','rjob.brainpp.cn/rjob-name='+name,'-o','json']))
result=dict(observedAtEpoch=int(time.time()),name=name,uid=job['metadata']['uid'],status=job.get('status'),replicas=[])
for replica in replicas.get('items',[]):
 result['replicas'].append(dict(name=replica['metadata']['name'],uid=replica['metadata']['uid'],status=replica.get('status')))
root=Path(intent['remote'])
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('owned artifact stage changed')
result['artifacts']={}
for filename in ['resource-result.json','worker.log']:
 path=root/filename
 if not path.exists():continue
 stat=path.stat()
 entry=dict(uid=stat.st_uid,mode=oct(stat.st_mode&0o777),bytes=stat.st_size)
 if not path.is_file() or path.is_symlink() or stat.st_uid!=10250:raise RuntimeError('runtime artifact ownership changed')
 if stat.st_size>262144:raise RuntimeError('runtime artifact size bound exceeded')
 entry['content']=json.loads(path.read_text()) if filename.endswith('.json') else path.read_text()[-32768:]
 result['artifacts'][filename]=entry
print(json.dumps(result))
'''.replace('INTENT', repr(intent))
result = remote.inspect_jump(code, timeout=100)
path = BASE / ('h200-resource-attempt2-observation-' + str(result['observedAtEpoch']) + '.json')
path.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(dict(path=str(path), **result), indent=2))
