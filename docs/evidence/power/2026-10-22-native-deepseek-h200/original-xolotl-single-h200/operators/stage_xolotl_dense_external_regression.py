"""Run bounded actual CUDA cross-stream regression, independently of model speed."""
import base64,hashlib,json,time
from xolotl_trial_common import BASE,lease,owned
ip=BASE/'xolotl-dense-external-regression-intent.json'
if ip.exists():raise RuntimeError('regression intent exists; observe, never restart ambiguously')
payload={n:(BASE/n).read_bytes() for n in ['aster_dense_external_readback_test.cu','aster_dense_async_fence.hpp']}
r=dict(root=lease()['remote']+'/xolotl-dense-external-regression',unix=time.time(),phase='prepared',files=[dict(file=n,bytes=len(b),sha256=hashlib.sha256(b).hexdigest()) for n,b in payload.items()]);ip.write_text(json.dumps(r,indent=2)+'\n')
code='''import os,json,base64,hashlib,time,subprocess
from pathlib import Path
r=@R@;root=Path(r['root'])
if root.parent.resolve()!=root.parent or root.parent.stat().st_uid!=os.getuid() or root.exists():raise RuntimeError('regression identity/exclusivity differs')
proof=json.loads((root.parent/'resource-result.json').read_text())
if proof['phase']!='passed' or time.time()+60>proof['leaseEndsUnix']:raise RuntimeError('regression deadline insufficient')
active=subprocess.run(['nvidia-smi','--query-compute-apps=pid','--format=csv,noheader,nounits'],capture_output=True,text=True,check=True,timeout=8)
if active.stdout.strip():raise RuntimeError('regression requires idle owned GPU')
root.mkdir(mode=0o700);data=@DATA@
for m in r['files']:
 raw=base64.b64decode(data[m['file']])
 if len(raw)!=m['bytes'] or hashlib.sha256(raw).hexdigest()!=m['sha256']:raise RuntimeError('regression frozen payload differs')
 (root/m['file']).write_bytes(raw)
env=dict(os.environ,CUDA_VISIBLE_DEVICES='0');out=dict(unix=time.time(),passed=False,performance_claimed=False)
try:
 with (root/'compile.stdout.log').open('xb') as a,(root/'compile.stderr.log').open('xb') as b:
  q=subprocess.run(['/usr/local/cuda/bin/nvcc','-O2','-std=c++17','-arch=sm_90',str(root/'aster_dense_external_readback_test.cu'),'-o',str(root/'test')],stdout=a,stderr=b,timeout=30,env=env)
 if q.returncode:raise RuntimeError('regression compile exit '+str(q.returncode))
 q=subprocess.run([str(root/'test')],capture_output=True,text=True,timeout=10,env=env)
 out.update(returncode=q.returncode,stdout=q.stdout,stderr=q.stderr)
 if q.returncode or 'unfenced stale readbacks=6; guarded exact readbacks=6' not in q.stdout:raise RuntimeError('CUDA external readback control failed')
 out['passed']=True
except Exception as e:out['error']=str(e)
out['finished_unix']=time.time();(root/'result.json').write_text(json.dumps(out,indent=2)+'\\n');print(json.dumps(out))
'''.replace('@R@',repr(r)).replace('@DATA@',repr({n:base64.b64encode(b).decode() for n,b in payload.items()}))
compile(code,'external-readback-regression','exec');r['phase']='execution_requested';ip.write_text(json.dumps(r,indent=2)+'\n')
v=owned(code);(BASE/'xolotl-dense-external-regression-result.json').write_text(json.dumps(v,indent=2)+'\n');r['phase']='complete' if v['passed'] else 'failed';ip.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(v))
