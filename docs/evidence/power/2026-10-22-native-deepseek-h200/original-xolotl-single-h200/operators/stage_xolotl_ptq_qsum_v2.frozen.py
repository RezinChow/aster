"""Freeze and stage one owned qsum experiment, with an immutable bounded worker."""
import base64,hashlib,json,time
from xolotl_trial_common import BASE,lease,jump,owned
path=BASE/'xolotl-ptq-qsum-v2-intent.json'
if path.exists():raise RuntimeError('qsum intent exists; observe instead of restarting')
parent=json.loads((BASE/'xolotl-h200-split-rows-build-intent.json').read_text())['root'];root=lease()['remote']+'/xolotl-ptq-qsum-v2'
fixture=(BASE/'aster_ptq_qsum_parity.cu').read_text().replace('@PARENT_SOURCE@',parent+'/source')
payload={'aster_ptq_qsum.cuh':(BASE/'aster_ptq_qsum_v2.cuh').read_bytes(),'iq_kernels.cu':(BASE/'aster_ptq_qsum_v2_iq_kernels.cu').read_bytes(),'qsum_parity.cu':fixture.encode(),'worker.py':(BASE/'xolotl_ptq_qsum_build_worker.py').read_bytes()}
sources=[dict(file=n,bytes=len(v),sha256=hashlib.sha256(v).hexdigest()) for n,v in payload.items()]
plan=dict(parent=parent,parent_iq_sha256='230d47355c244f5d9b0a4a75b08c902579601f6da8391112761275d4b3d9a46a',commands=json.loads((BASE/'xolotl-mma-parent-build-commands.json').read_text()),sources=sources,default='ASTER_XQ_PTQ_QSUM=0',candidate_modes=['gu','both'],no_extra_weights=True,model_speed_claimed=False)
payload['plan.json']=(json.dumps(plan,indent=2)+'\n').encode();r=dict(unix=time.time(),phase='prepared',root=root,files=[dict(file=n,bytes=len(v),sha256=hashlib.sha256(v).hexdigest()) for n,v in payload.items()]);path.write_text(json.dumps(r,indent=2)+'\n')
code='''from pathlib import Path
import os,json,base64,hashlib,time
r=@R@;root=Path(r['root'])
if root.parent.resolve()!=root.parent or root.parent.stat().st_uid!=os.getuid() or os.getuid()!=10250:raise RuntimeError('stage owner differs')
proof=json.loads((root.parent/'resource-result.json').read_text())
if proof['phase']!='passed' or time.time()+1050>proof['leaseEndsUnix']:raise RuntimeError('qsum immutable deadline insufficient')
root.mkdir(mode=0o700,exist_ok=False);payload=@PAYLOAD@
for m in r['files']:
 raw=base64.b64decode(payload[m['file']])
 if len(raw)!=m['bytes'] or hashlib.sha256(raw).hexdigest()!=m['sha256']:raise RuntimeError('stage identity differs')
 (root/m['file']).write_bytes(raw)
print(json.dumps(dict(staged=True)))
'''.replace('@R@',repr(r)).replace('@PAYLOAD@',repr({k:base64.b64encode(v).decode() for k,v in payload.items()}))
r['stage']=jump(code);r['phase']='staged';path.write_text(json.dumps(r,indent=2)+'\n')
code='''from pathlib import Path
import subprocess,json,time,os
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=os.getuid() or (root/'process.json').exists():raise RuntimeError('process identity differs')
with (root/'worker.log').open('xb') as log:p=subprocess.Popen(['timeout','--signal=TERM','--kill-after=20','980','python3','-u',str(root/'worker.py')],cwd=root,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
out=dict(pid=p.pid,start_ticks=int(Path('/proc/'+str(p.pid)+'/stat').read_text().split(') ',1)[1].split()[19]),uid=os.getuid(),unix=time.time(),deadline_seconds=980)
(root/'process.json').write_text(json.dumps(out,indent=2)+'\\n');print(json.dumps(out))
'''.replace('@ROOT@',repr(root))
r['phase']='launch_requested';path.write_text(json.dumps(r,indent=2)+'\n');r['process']=owned(code);r['phase']='launched';path.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r['process']))
