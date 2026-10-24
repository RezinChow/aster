"""Freeze a hybrid original-PTQ experiment, borrowing only immutable parent inputs."""
import base64,hashlib,json,time
from xolotl_trial_common import BASE,lease,jump,owned
path=BASE/'xolotl-ptq-mma-integrated-v2-intent.json'
if path.exists():raise RuntimeError('integrated intent exists; observe instead of restarting')
parent=json.loads((BASE/'xolotl-h200-split-rows-build-intent.json').read_text())['root']
prototype=json.loads((BASE/'xolotl-ptq-mma-v15-intent.json').read_text())['root']
header=(BASE/'aster_ptq_mma_integrated_v2.cuh').read_text()
root=lease()['remote']+'/xolotl-ptq-mma-integrated-v2'
plan=dict(parent=parent,prototype_object=prototype+'/prototype.o',commands=json.loads((BASE/'xolotl-mma-parent-build-commands.json').read_text()),default_flag='ASTER_XQ_PTQ_MMA=0',candidate_flag='ASTER_XQ_PTQ_MMA=1',threshold=4,no_auxiliary_weight_bytes=True,model_speed_qualified=False)
payload={'aster_ptq_mma.cuh':header.encode(),'worker.py':(BASE/'xolotl_ptq_mma_integrated_v2_worker.py').read_bytes(),'plan.json':(json.dumps(plan,indent=2)+'\n').encode()}
r=dict(unix=time.time(),phase='prepared',root=root,files=[dict(file=n,bytes=len(v),sha256=hashlib.sha256(v).hexdigest()) for n,v in payload.items()]);path.write_text(json.dumps(r,indent=2)+'\n')
code='''from pathlib import Path
import os,json,base64,hashlib
r=@R@;root=Path(r['root'])
if root.parent.resolve()!=root.parent or root.parent.stat().st_uid!=os.getuid() or os.getuid()!=10250:raise RuntimeError('integrated stage owner differs')
proof=json.loads((root.parent/'resource-result.json').read_text())
import time
if proof['phase']!='passed' or time.time()+690>proof['leaseEndsUnix']:raise RuntimeError('integrated deadline does not fit immutable lease')
root.mkdir(mode=0o700,exist_ok=False);payload=@PAYLOAD@
for m in r['files']:
 raw=base64.b64decode(payload[m['file']])
 if len(raw)!=m['bytes'] or hashlib.sha256(raw).hexdigest()!=m['sha256']:raise RuntimeError('stage input differs')
 (root/m['file']).write_bytes(raw)
print(json.dumps(dict(staged=True)))
'''.replace('@R@',repr(r)).replace('@PAYLOAD@',repr({k:base64.b64encode(v).decode() for k,v in payload.items()}))
r['stage']=jump(code);r['phase']='staged';path.write_text(json.dumps(r,indent=2)+'\n')
code='''from pathlib import Path
import subprocess,json,time,os
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=os.getuid() or (root/'process.json').exists():raise RuntimeError('integrated process identity differs')
with (root/'worker.log').open('xb') as log:p=subprocess.Popen(['timeout','--signal=TERM','--kill-after=20','600','python3','-u',str(root/'worker.py')],cwd=root,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
out=dict(pid=p.pid,start_ticks=int(Path('/proc/'+str(p.pid)+'/stat').read_text().split(') ',1)[1].split()[19]),uid=os.getuid(),unix=time.time(),deadline_seconds=600)
(root/'process.json').write_text(json.dumps(out,indent=2)+'\\n');print(json.dumps(out))
'''.replace('@ROOT@',repr(root))
r['phase']='launch_requested';path.write_text(json.dumps(r,indent=2)+'\n');r['process']=owned(code);r['phase']='launched';path.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r['process'],indent=2))
