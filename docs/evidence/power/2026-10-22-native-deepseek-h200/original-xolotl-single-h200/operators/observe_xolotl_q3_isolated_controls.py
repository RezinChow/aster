"""Observe only the existing exact Q3-only control worker and its measurements."""
import json
from xolotl_trial_common import BASE,jump
r=json.loads((BASE/'xolotl-q3-isolated-controls-intent.json').read_text())
code='''from pathlib import Path
import json
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('Q3 observation owner differs')
out={}
for n in ['result.json','process.json','worker.log']:
 p=root/n
 if p.exists():
  if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>262144:raise RuntimeError('Q3 artifact bound exceeded')
  out[n]=json.loads(p.read_text()) if n.endswith('.json') else p.read_text()
print(json.dumps(out))
'''.replace('@ROOT@',repr(r['root']))
v=jump(code);(BASE/'xolotl-q3-isolated-controls-latest.json').write_text(json.dumps(v,indent=2)+'\n');q=v.get('result.json',{});print(json.dumps(dict(phase=q.get('phase'),passed=q.get('passed'),error=q.get('error'),strict_cases=q.get('strict_cases'),step=q.get('step'),modes=list(q.get('controls',{})))))
