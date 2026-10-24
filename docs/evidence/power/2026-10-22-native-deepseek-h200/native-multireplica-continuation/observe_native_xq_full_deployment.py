"""Observe exact qualifier process and retain bounded original runtime logs."""
import base64
import json
from pathlib import Path
import shlex
import subprocess
import time

BASE=Path('D:/code/aster/target/h200-native')
WORK=Path('D:/code/aster/.wt-h200-native-deploy')
record=json.loads((BASE/'native-xq-full-model-deployment.json').read_text())
inside='''from pathlib import Path
import json,os
process=PROCESS
path=Path('/proc/'+str(process['pid']))
result=dict(exists=path.exists(),expected_pid=process['pid'],expected_start_ticks=process['start_ticks'])
if path.exists():
 text=(path/'stat').read_text().split(') ',1)[1].split()
 result.update(state=text[0],actual_start_ticks=int(text[19]),uid=path.stat().st_uid)
 if result['actual_start_ticks']!=process['start_ticks'] or result['uid']!=10250:raise RuntimeError('qualifier process identity changed')
print(json.dumps(result))
'''.replace('PROCESS',repr(record['process']))
code='''from pathlib import Path
import json,time,subprocess,shlex
record=RECORD
inside=INSIDE
root=Path(record['remote'])
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('owned qualifier stage changed')
result=dict(unix=time.time(),files={})
total=0
for path in sorted(root.iterdir()):
 if path.name.endswith('.log') or path.name in ['probe-result.json','process.json','barrier-result.json']:
  if path.is_symlink() or not path.is_file() or path.stat().st_uid!=10250 or path.stat().st_size>4*1024**2:raise RuntimeError('qualification artifact type/owner/size changed')
  total+=path.stat().st_size
  if total>16*1024**2:raise RuntimeError('qualification log set exceeds bounded observation size')
  result['files'][path.name]=path.read_text()
args=['brainctl','exec','-n','ailab-hrprdduanyan','replica/'+record['replica'],'--','python3','-c',inside]
p=subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(args)],capture_output=True,text=True,timeout=30)
result['process_observation']=json.loads(p.stdout) if p.returncode==0 else dict(observation_exit=p.returncode,stderr=p.stderr[-2000:])
print(json.dumps(result))
'''.replace('RECORD',repr(record)).replace('INSIDE',repr(inside))
wrapper='python3 -c '+shlex.quote('import base64;exec(base64.b64decode('+repr(base64.b64encode(code.encode()).decode())+'))')
result=subprocess.run(['ssh','-C','-o','BatchMode=yes','-o','ConnectTimeout=15','-o','HostName=10.102.254.2','-o','HostKeyAlias=h.pjlab.org.cn','yangchao-dev.yangchao.ailab-hrprdduanyan.ws@h.pjlab.org.cn',wrapper],capture_output=True,text=True,timeout=65)
if result.returncode:raise RuntimeError('owned qualifier observation failed: '+result.stderr[-5000:])
observation=json.loads(result.stdout)
path=BASE/('native-xq-full-deployment-observation-'+str(int(observation['unix']))+'.json')
path.write_text(json.dumps(observation,indent=2)+'\n')
destination=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/native-xq-full-model-deployment'
destination.mkdir(exist_ok=True)
for name,content in observation['files'].items():
    if Path(name).name!=name:raise RuntimeError('qualification artifact name escaped evidence directory')
    (destination/name).write_text(content)
(destination/'launch.json').write_text(json.dumps(record,indent=2)+'\n')
(destination/'process-observation.json').write_text(json.dumps(observation['process_observation'],indent=2)+'\n')
state=json.loads(observation['files'].get('probe-result.json','{}'))
print(json.dumps(dict(observation=str(path),process=observation['process_observation'],phase=state.get('phase'),current_test=state.get('current_test'),hermetic_tests_passed=state.get('hermetic_tests_passed'),hardware_tests_passed=state.get('hardware_tests_passed'),completed_hardware=[value.get('test') for value in state.get('cases',{}).values() if value.get('passed')],error=state.get('error'),worker_log=observation['files'].get('worker.log','')[-2000:],stderr={name:content[-5000:] for name,content in observation['files'].items() if name.endswith('stderr.log') and content}),indent=2))
