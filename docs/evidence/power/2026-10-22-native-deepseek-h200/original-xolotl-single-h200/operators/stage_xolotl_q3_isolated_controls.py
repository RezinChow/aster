"""Freeze one Q3-only row-layout screen, retaining PTQ R4 and exact outputs."""
import base64,hashlib,json,time
from xolotl_trial_common import BASE,lease,jump,owned
path=BASE/'xolotl-q3-isolated-controls-intent.json'
if path.exists():raise RuntimeError('Q3 screen intent exists; observe it instead of repeating')
b=json.loads((BASE/'xolotl-ptq-qsum-v2-latest.json').read_text())['result.json']
if b['phase']!='qualified' or not b['passed'] or b['strict_cases']!=39:raise RuntimeError('current exact CUDA controls must pass')
root=lease()['remote']+'/xolotl-q3-isolated-controls';binary=b['binaries']['aster_xq_split_parity']
worker='''import os,json,hashlib,subprocess,time
from pathlib import Path
root=Path(__file__).resolve().parent;plan=json.loads((root/'plan.json').read_text());out=dict(phase='running',unix=time.time(),passed=False,controls={},model_speed_claimed=False)
def save():
 p=root/'result.tmp';p.write_text(json.dumps(out,indent=2)+'\\n');p.replace(root/'result.json')
save()
try:
 if os.getuid()!=10250 or root.stat().st_uid!=10250:raise RuntimeError('control owner differs')
 proof=json.loads((root.parent/'resource-result.json').read_text())
 if proof['phase']!='passed' or proof['expectedGpus']!=1 or time.time()+210>proof['leaseEndsUnix']:raise RuntimeError('immutable control lease insufficient')
 p=Path(plan['binary']['path'])
 if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size!=plan['binary']['bytes'] or hashlib.sha256(p.read_bytes()).hexdigest()!=plan['binary']['sha256']:raise RuntimeError('current fixture identity differs')
 active=subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,check=True,timeout=8)
 if active.stdout.strip():raise RuntimeError('owned GPU has another workload')
 env={k:v for k,v in os.environ.items() if not k.startswith(('STRATA_','ASTER_XQ_'))};env.update(CUDA_VISIBLE_DEVICES='0',STRATA_EXP_MODE_T143='4',STRATA_EXP_MODE_T11='0',ASTER_XQ_SPLIT_MMVQ='11',ASTER_XQ_PTQ_QSUM='0')
 for mode in ['0','2','4']:
  env['ASTER_XQ_SPLIT_ROWS']=mode;out['step']='rows'+mode;save()
  q=subprocess.run([str(p)],env=env,capture_output=True,text=True,timeout=55)
  if len(q.stdout)>262144 or len(q.stderr)>262144:raise RuntimeError('fixture text bound exceeded')
  (root/('rows'+mode+'.stdout.log')).write_text(q.stdout);(root/('rows'+mode+'.stderr.log')).write_text(q.stderr)
  rows=[json.loads(x) for x in q.stdout.splitlines()]
  if q.returncode or len(rows)!=15 or rows[0].get('devices')!=1 or not rows[-1].get('complete') or rows[-1].get('failures')!=0 or not all(x.get('strict_passed') for x in rows[1:-1]):raise RuntimeError('Q3-only GU/Down/q8/finite/sentinel equivalence failed: '+mode)
  out['controls'][mode]=rows;save()
 out.update(phase='qualified',passed=True,strict_cases=39,adopted=False)
except Exception as e:out.update(phase='failed',error=str(e))
out['finished_unix']=time.time();save();print(json.dumps(dict(phase=out['phase'],passed=out['passed'],error=out.get('error'))))
'''
compile(worker,'q3-isolated-control-worker','exec');plan=dict(binary=binary,rows=[0,2,4],ptq_mode=4,q3_mode=0,split_mmvq='11',ptq_qsum='0',model_speed_claimed=False)
payload={'worker.py':worker.encode(),'plan.json':(json.dumps(plan,indent=2)+'\n').encode()};r=dict(unix=time.time(),phase='prepared',root=root,files=[dict(file=n,bytes=len(v),sha256=hashlib.sha256(v).hexdigest()) for n,v in payload.items()]);path.write_text(json.dumps(r,indent=2)+'\n')
code='''from pathlib import Path
import os,json,base64,hashlib
r=@R@;root=Path(r['root'])
if root.parent.resolve()!=root.parent or root.parent.stat().st_uid!=10250 or os.getuid()!=10250:raise RuntimeError('Q3 stage owner differs')
root.mkdir(mode=0o700,exist_ok=False);payload=@PAYLOAD@
for m in r['files']:
 raw=base64.b64decode(payload[m['file']])
 if len(raw)!=m['bytes'] or hashlib.sha256(raw).hexdigest()!=m['sha256']:raise RuntimeError('Q3 stage identity differs')
 (root/m['file']).write_bytes(raw)
print(json.dumps(dict(staged=True)))
'''.replace('@R@',repr(r)).replace('@PAYLOAD@',repr({k:base64.b64encode(v).decode() for k,v in payload.items()}))
r['stage']=jump(code);r['phase']='staged';path.write_text(json.dumps(r,indent=2)+'\n')
code='''from pathlib import Path
import os,subprocess,time,json
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=os.getuid() or (root/'process.json').exists():raise RuntimeError('Q3 control process differs')
with (root/'worker.log').open('xb') as log:p=subprocess.Popen(['timeout','--signal=TERM','--kill-after=15','200','python3','-u',str(root/'worker.py')],cwd=root,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
out=dict(pid=p.pid,start_ticks=int(Path('/proc/'+str(p.pid)+'/stat').read_text().split(') ',1)[1].split()[19]),uid=os.getuid(),unix=time.time(),deadline_seconds=200)
(root/'process.json').write_text(json.dumps(out,indent=2)+'\\n');print(json.dumps(out))
'''.replace('@ROOT@',repr(root));compile(code,'q3-control-launch','exec')
r['phase']='launch_requested';path.write_text(json.dumps(r,indent=2)+'\n');r['process']=owned(code);r['phase']='launched';path.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r['process']))
