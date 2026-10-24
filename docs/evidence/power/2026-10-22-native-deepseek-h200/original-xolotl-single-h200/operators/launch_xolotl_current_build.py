"""Launch a staged, owned, GPU-free compilation once."""
import json
from xolotl_trial_common import BASE,owned
p=BASE/'xolotl-h200-current-build-intent.json';r=json.loads(p.read_text())
if r['phase']!='staged':raise RuntimeError('observe existing build; never restart its frozen intent')
code='''import json,hashlib,os,subprocess,time
from pathlib import Path
r=@RECORD@;root=Path(r['root'])
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('build root owner changed')
for f in r['files']:
 p=root/f['file']
 if p.stat().st_size!=f['bytes'] or hashlib.sha256(p.read_bytes()).hexdigest()!=f['sha256']:raise RuntimeError('frozen build input changed')
if (root/'process.json').exists():raise RuntimeError('build process exists; inspect it')
proof=json.loads((root.parent/'resource-result.json').read_text())
if proof['phase']!='passed' or time.time()+2400>proof['leaseEndsUnix']:raise RuntimeError('insufficient immutable build lease')
p=subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8,check=True)
if p.stdout.strip():raise RuntimeError('GPU campaign must terminate before build')
env=dict(os.environ,CUDA_VISIBLE_DEVICES='')
with (root/'worker.log').open('xb',buffering=0) as log:
 child=subprocess.Popen(['timeout','--signal=TERM','--kill-after=30','2400','python3','-u',str(root/'worker.py')],cwd=root,env=env,stdout=log,stderr=log,start_new_session=True)
 ticks=int(Path('/proc/'+str(child.pid)+'/stat').read_text().split(') ',1)[1].split()[19])
out=dict(pid=child.pid,start_ticks=ticks,uid=os.getuid(),unix=time.time(),deadline_seconds=2400,gpu_requested=0)
(root/'process.json').write_text(json.dumps(out,indent=2)+'\\n')
print(json.dumps(out))
'''.replace('@RECORD@',repr(r))
r['phase']='launch_requested';p.write_text(json.dumps(r,indent=2)+'\n')
r['process']=owned(code);r['phase']='building';p.write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps(dict(phase=r['phase'],root=r['root'],process=r['process']),indent=2))
