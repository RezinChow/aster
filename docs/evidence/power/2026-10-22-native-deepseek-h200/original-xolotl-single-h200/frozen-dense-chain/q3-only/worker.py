import os,json,hashlib,subprocess,time
from pathlib import Path
root=Path(__file__).resolve().parent;plan=json.loads((root/'plan.json').read_text());out=dict(phase='running',unix=time.time(),passed=False,controls={},model_speed_claimed=False)
def save():
 p=root/'result.tmp';p.write_text(json.dumps(out,indent=2)+'\n');p.replace(root/'result.json')
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
