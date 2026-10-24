"""Stage once, then build without GPU work inside the exact owned immutable lease."""
import json,base64,hashlib,time
from xolotl_trial_common import BASE,lease,jump,owned
p=BASE/'xolotl-dense-chain-v2-build-intent.json'
if p.exists():raise RuntimeError('dense build intent exists; observe instead of repeating')
meta=json.loads((BASE/'xolotl-dense-chain-parent.json').read_text());root=lease()['remote']+'/xolotl-dense-async-chain-v2'
payload={'ds41_dense.cpp':(BASE/'aster_dense_async_chain_v2.cpp').read_bytes(),'aster_dense_async_fence.hpp':(BASE/'aster_dense_async_fence.hpp').read_bytes(),'fence_test.cpp':(BASE/'aster_dense_async_fence_test.cpp').read_bytes(),'worker.py':(BASE/'xolotl_dense_chain_build_worker.py').read_bytes()}
plan=dict(meta,link_command=json.loads((BASE/'xolotl-mma-parent-build-commands.json').read_text())['ds41_generate']['link_command'],sources=[dict(file=n,bytes=len(v),sha256=hashlib.sha256(v).hexdigest()) for n,v in payload.items()]);payload['plan.json']=(json.dumps(plan,indent=2)+'\n').encode();r=dict(unix=time.time(),phase='prepared',root=root,files=[dict(file=n,bytes=len(v),sha256=hashlib.sha256(v).hexdigest()) for n,v in payload.items()]);p.write_text(json.dumps(r,indent=2)+'\n')
code='''from pathlib import Path
import os,json,base64,hashlib,time
r=@R@;root=Path(r['root'])
if root.parent.resolve()!=root.parent or root.parent.stat().st_uid!=os.getuid() or os.getuid()!=10250:raise RuntimeError('dense stage owner differs')
proof=json.loads((root.parent/'resource-result.json').read_text())
if time.time()+115>proof['leaseEndsUnix']:raise RuntimeError('dense stage deadline insufficient')
root.mkdir(mode=0o700,exist_ok=False);payload=@PAYLOAD@
for m in r['files']:
 raw=base64.b64decode(payload[m['file']])
 if len(raw)!=m['bytes'] or hashlib.sha256(raw).hexdigest()!=m['sha256']:raise RuntimeError('dense payload differs')
 (root/m['file']).write_bytes(raw)
print(json.dumps(dict(staged=True)))
'''.replace('@R@',repr(r)).replace('@PAYLOAD@',repr({k:base64.b64encode(v).decode() for k,v in payload.items()}));compile(code,'dense-stage','exec')
r['stage']=jump(code);r['phase']='staged';p.write_text(json.dumps(r,indent=2)+'\n')
code='''from pathlib import Path
import os,json,time,subprocess
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=os.getuid() or (root/'process.json').exists():raise RuntimeError('dense process identity differs')
with (root/'worker.log').open('xb') as log:q=subprocess.Popen(['timeout','--signal=TERM','--kill-after=10','105','python3','-u',str(root/'worker.py')],cwd=root,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
out=dict(pid=q.pid,start_ticks=int(Path('/proc/'+str(q.pid)+'/stat').read_text().split(') ',1)[1].split()[19]),uid=os.getuid(),unix=time.time(),deadline_seconds=105)
(root/'process.json').write_text(json.dumps(out,indent=2)+'\\n');print(json.dumps(out))
'''.replace('@ROOT@',repr(root));compile(code,'dense-build-launch','exec')
r['phase']='launch_requested';p.write_text(json.dumps(r,indent=2)+'\n');r['process']=owned(code);r['phase']='launched';p.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r['process']))
