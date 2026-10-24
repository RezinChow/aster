"""Read exact GPFS artifacts without relaunching an ambiguous build."""
import json,time
from xolotl_trial_common import BASE,jump
r=json.loads((BASE/'xolotl-ptq-qsum-v2-intent.json').read_text())
code='''from pathlib import Path
import json
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('integrated observation owner differs')
out={}
for name in ['result.json','process.json','worker.log','compile.stderr.log','compile.stdout.log','controls-0.stderr.log','controls-1.stderr.log']:
 p=root/name
 if p.exists():
  if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>2*1024**2:raise RuntimeError('integrated artifact bound differs')
  out[name]=json.loads(p.read_text()) if name.endswith('.json') else p.read_text()[-16384:]
print(json.dumps(out))
'''.replace('@ROOT@',repr(r['root']))
v=jump(code);v['unix']=time.time();(BASE/'xolotl-ptq-qsum-v2-latest.json').write_text(json.dumps(v,indent=2)+'\n')
result=v.get('result.json',{})
print(json.dumps(dict(phase=result.get('phase'),step=result.get('step'),passed=result.get('passed'),error=result.get('error'),binaries=result.get('binaries'),control_modes=list(result.get('controls',{})),compile_stderr=v.get('compile.stderr.log','')[-3500:],worker_log=v.get('worker.log','')[-2000:]),indent=2))
