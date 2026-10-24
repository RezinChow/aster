"""Read bounded task-owned service receipts; never read credential files."""
import json
from xolotl_serving_common import BASE,jump
r=json.loads((BASE/'xolotl-stable-service-intent.json').read_text())
code='''from pathlib import Path
import json,time
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('stable service receipt root differs')
out=dict(unix=time.time())
for n in ['service-result.json','service-process.json','service-worker.log','security-tests.stderr.log','ds41-api-tests.stdout.log','ds41-api-tests.stderr.log','prompt-id-tests.stdout.log','prompt-id-tests.stderr.log','api-attempt1.stdout.log','api-attempt1.stderr.log','engine.log']:
 p=root/n
 if not p.exists():continue
 if p.is_symlink() or p.stat().st_uid!=10250:raise RuntimeError('stable service receipt owner differs')
 if n.endswith('.json'):
  if p.stat().st_size>65536:raise RuntimeError('stable service result bound exceeded')
  out[n]=json.loads(p.read_text())
 else:
  with p.open('rb') as f:
   f.seek(max(0,p.stat().st_size-12000));out[n]=f.read(12000).decode(errors='replace')
print(json.dumps(out))
'''.replace('@ROOT@',repr(r['root']));compile(code,'stable-service-observation','exec');o=jump(code);(BASE/'xolotl-stable-service-latest.json').write_text(json.dumps(o,indent=2)+'\n')
q=o.get('service-result.json',{});print(json.dumps(dict(phase=q.get('phase'),error=q.get('error'),api_tests_passed=q.get('cpu_api_tests_passed'),last_health_status=q.get('last_health_status'),logs={k:v[-1800:] for k,v in o.items() if isinstance(v,str)})))
