"""Launch once, then observe real CUDA bitwise controls against scalar kernels."""
import argparse,base64,hashlib,json
from xolotl_trial_common import BASE,owned,jump
p=argparse.ArgumentParser();p.add_argument('--observe',action='store_true');a=p.parse_args()
r=json.loads((BASE/'xolotl-h200-split-build-intent.json').read_text());root=r['root']
if a.observe:
 code='''from pathlib import Path
import json
root=Path(@ROOT@);out={}
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('split controls owner differs')
for name in ['controls-result.json','controls.stdout.log','controls.stderr.log','controls-worker.log']:
 p=root/name
 if not p.exists():continue
 if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>262144:raise RuntimeError('control output bound exceeded')
 out[name]=json.loads(p.read_text()) if name.endswith('.json') else p.read_text()
print(json.dumps(out))
'''.replace('@ROOT@',repr(root))
 v=jump(code);(BASE/'xolotl-split-build-hardware-controls.json').write_text(json.dumps(v,indent=2)+'\n');print(json.dumps(v,indent=2));raise SystemExit()
build=json.loads((BASE/'xolotl-split-build-latest.json').read_text())['build-result.json']
if build['phase']!='built':raise RuntimeError('split build is incomplete')
worker='''from pathlib import Path
import hashlib,json,os,subprocess,time
root=Path(__file__).resolve().parent
out=dict(phase='running',started=time.time(),cuda_visible_devices='0',passed=False)
try:
 build=json.loads((root/'build-result.json').read_text());meta=build['binaries']['aster_xq_split_parity'];p=Path(meta['path'])
 if p.stat().st_size!=meta['bytes'] or hashlib.sha256(p.read_bytes()).hexdigest()!=meta['sha256']:raise RuntimeError('split control binary identity differs')
 env={k:v for k,v in os.environ.items() if not k.startswith(('STRATA_','ASTER_XQ_'))};env.update(CUDA_VISIBLE_DEVICES='0',ASTER_XQ_SPLIT_MMVQ='both')
 p=subprocess.run([str(p),'--aster-xq'],env=env,capture_output=True,text=True,timeout=180)
 if len(p.stdout)>262144 or len(p.stderr)>262144:raise RuntimeError('control output bounds exceeded')
 (root/'controls.stdout.log').write_text(p.stdout);(root/'controls.stderr.log').write_text(p.stderr)
 passed=p.returncode==0 and 'Aster split GPU: NVIDIA H200, SM90' in p.stdout.splitlines() and 'aster_xq_split_parity: 0 failures' in p.stdout.splitlines() and p.stdout.count('bitwise equal to the old kernels')==12
 out.update(phase='complete' if passed else 'failed',passed=passed,exit=p.returncode)
except Exception as e:out.update(phase='failed',error=str(e))
out['unix']=time.time();(root/'controls-result.json').write_text(json.dumps(out,indent=2)+'\\n')
'''
compile(worker,'split-control-worker.py','exec');(BASE/'xolotl_split_control_worker.frozen.py').write_text(worker)
code='''from pathlib import Path
import os,json,subprocess,time,base64
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('split controls root owner differs')
if (root/'controls-process.json').exists():raise RuntimeError('controls already launched; observe')
active=subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8,check=True)
if active.stdout.strip():raise RuntimeError('existing GPU workload must finish')
proof=json.loads((root.parent/'resource-result.json').read_text())
if time.time()+240>proof['leaseEndsUnix']:raise RuntimeError('insufficient immutable lease for controls')
(root/'controls-worker.py').write_bytes(base64.b64decode(@WORKER@))
with (root/'controls-worker.log').open('xb') as log:
 p=subprocess.Popen(['timeout','--signal=TERM','--kill-after=15','210','python3','-u',str(root/'controls-worker.py')],stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
out=dict(pid=p.pid,start_ticks=Path('/proc/'+str(p.pid)+'/stat').read_text().split()[21],uid=os.getuid(),unix=time.time())
(root/'controls-process.json').write_text(json.dumps(out,indent=2)+'\\n');print(json.dumps(out))
'''.replace('@ROOT@',repr(root)).replace('@WORKER@',repr(base64.b64encode(worker.encode()).decode()))
compile(code,'split-control-launch.py','exec')
v=owned(code);(BASE/'xolotl-split-controls-launch.json').write_text(json.dumps(v,indent=2)+'\n');print(json.dumps(v,indent=2))
