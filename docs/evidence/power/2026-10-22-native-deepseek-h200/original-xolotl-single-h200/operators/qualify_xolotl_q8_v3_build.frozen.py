"""Paired real-CUDA Q8 dispatch controls; finite tolerance is not bitwise parity."""
import argparse,base64,json
from xolotl_trial_common import BASE,owned,jump
p=argparse.ArgumentParser();p.add_argument('--observe',action='store_true');a=p.parse_args()
r=json.loads((BASE/'xolotl-h200-q8-v3-build-intent.json').read_text());root=r['root']
if a.observe:
 code='''from pathlib import Path
import json
root=Path(@ROOT@);out={}
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('Q8 controls owner differs')
for name in ['q8-controls-result.json','q8-controls-worker.log','q8-0.stdout.log','q8-0.stderr.log','q8-1.stdout.log','q8-1.stderr.log']:
 p=root/name
 if not p.exists():continue
 if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>262144:raise RuntimeError('Q8 output bound exceeded')
 out[name]=json.loads(p.read_text()) if name.endswith('.json') else p.read_text()
print(json.dumps(out))
'''.replace('@ROOT@',repr(root))
 v=jump(code);(BASE/'xolotl-q8-v3-hardware-controls.json').write_text(json.dumps(v,indent=2)+'\n');print(json.dumps(v,indent=2));raise SystemExit()
build=json.loads((BASE/'xolotl-q8-v3-build-latest.json').read_text())['build-result.json']
if build['phase']!='built':raise RuntimeError('Q8 build incomplete')
worker='''from pathlib import Path
import hashlib,json,os,subprocess,time,math,array
root=Path(__file__).resolve().parent
out=dict(phase='running',started=time.time(),passed=False,claim='finite paired numerical tolerance, not bitwise equivalence',relative_l2_limit=2e-4,normalized_max_abs_limit=2e-4,tests=[])
try:
 b=json.loads((root/'build-result.json').read_text());meta=b['binaries']['aster_h200_q8_mmq'];p=Path(meta['path'])
 if p.stat().st_size!=meta['bytes'] or hashlib.sha256(p.read_bytes()).hexdigest()!=meta['sha256']:raise RuntimeError('Q8 control binary differs')
 rows=[]
 for mode in ['0','1']:
  d=root/('q8-output-'+mode);d.mkdir(mode=0o700,exist_ok=False)
  env={k:v for k,v in os.environ.items() if not k.startswith(('STRATA_','ASTER_'))};env.update(CUDA_VISIBLE_DEVICES='0',ASTER_H200_Q8_MMQ=mode)
  t=subprocess.run([str(p),mode,str(d)],env=env,capture_output=True,text=True,timeout=180)
  if len(t.stdout)>262144 or len(t.stderr)>262144:raise RuntimeError('Q8 log bounds differ')
  (root/('q8-'+mode+'.stdout.log')).write_text(t.stdout);(root/('q8-'+mode+'.stderr.log')).write_text(t.stderr)
  if t.returncode:raise RuntimeError('Q8 mode '+mode+' failed: '+str(t.returncode))
  rows.append([json.loads(line) for line in t.stdout.splitlines()])
 if len(rows[0])!=22 or len(rows[1])!=22:raise RuntimeError('Q8 case inventory differs')
 for a,b in zip(*rows):
  if any(a[k]!=b[k] for k in ['file','K','N','M']):raise RuntimeError('Q8 shape order differs')
  raw=[]
  for mode in ['0','1']:
   p=root/('q8-output-'+mode)/a['file']
   if p.name!=a['file'] or p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size!=a['N']*a['M']*4 or p.stat().st_size>32*1024**2:raise RuntimeError('Q8 array bounds differ')
   raw.append(p.read_bytes())
  x=array.array('f');x.frombytes(raw[0]);y=array.array('f');y.frombytes(raw[1])
  if not all(math.isfinite(v) for v in x) or not all(math.isfinite(v) for v in y):raise RuntimeError('nonfinite Q8 output')
  rel=math.sqrt(sum((u-v)**2 for u,v in zip(x,y))/max(1e-30,sum(u*u for u in x)))
  maximum=max(abs(u-v) for u,v in zip(x,y))/max(1.,max(abs(u) for u in x))
  exact=raw[0]==raw[1]
  passed=rel<=2e-4 and maximum<=2e-4 and (a['M']!=1 or exact) and a['mmvq'] is True and b['mmvq']==(not (a['M']>=2 and a['M']<=8 and ((a['K']==1280 and a['N']==32768) or (a['K']==5120 and a['N']==129280))))
  out['tests'].append(dict(K=a['K'],N=a['N'],M=a['M'],control_mean_us=a['mean_us'],mmq_mean_us=b['mean_us'],relative_l2=rel,normalized_max_abs=maximum,bitwise_equal=exact,passed=passed,output_sha256=[hashlib.sha256(v).hexdigest() for v in raw]))
 out.update(phase='complete',passed=all(t['passed'] for t in out['tests']))
except Exception as e:out.update(phase='failed',error=str(e))
out['unix']=time.time();(root/'q8-controls-result.json').write_text(json.dumps(out,indent=2)+'\\n')
'''
compile(worker,'q8-controls-worker.py','exec');(BASE/'xolotl_q8_v3_control_worker.frozen.py').write_text(worker)
code='''from pathlib import Path
import os,json,subprocess,time,base64
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('Q8 root ownership differs')
if (root/'q8-controls-process.json').exists():raise RuntimeError('Q8 controls already launched; observe')
proof=json.loads((root.parent/'resource-result.json').read_text())
if time.time()+450>proof['leaseEndsUnix']:raise RuntimeError('insufficient immutable Q8 lease')
active=subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8,check=True)
if active.stdout.strip():raise RuntimeError('other GPU campaign must finish')
(root/'q8-controls-worker.py').write_bytes(base64.b64decode(@WORKER@))
with (root/'q8-controls-worker.log').open('xb') as log:
 p=subprocess.Popen(['timeout','--signal=TERM','--kill-after=15','420','python3','-u',str(root/'q8-controls-worker.py')],stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
out=dict(pid=p.pid,start_ticks=Path('/proc/'+str(p.pid)+'/stat').read_text().split()[21],uid=os.getuid(),unix=time.time());(root/'q8-controls-process.json').write_text(json.dumps(out,indent=2)+'\\n');print(json.dumps(out))
'''.replace('@ROOT@',repr(root)).replace('@WORKER@',repr(base64.b64encode(worker.encode()).decode()))
compile(code,'q8-control-launch.py','exec');v=owned(code);(BASE/'xolotl-q8-v3-controls-launch.json').write_text(json.dumps(v,indent=2)+'\n');print(json.dumps(v,indent=2))
