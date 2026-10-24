"""Read exact build artifacts; do not restart on an observation timeout."""
import json
from xolotl_trial_common import BASE,jump
r=json.loads((BASE/'xolotl-h200-current-build-intent.json').read_text())
code='''import json,time
from pathlib import Path
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('build root owner changed')
out=dict(unix=time.time())
for name in ['build-result.json','worker.log','official-ggml-patch.log','h200-experiment-patch.log','configure.log','compile.log']:
 p=root/name
 if p.exists():
  if p.stat().st_size>64*1024**2 or p.stat().st_uid!=10250 or p.is_symlink():raise RuntimeError('build artifact exceeds bound')
  if name.endswith('.json'):out[name]=json.loads(p.read_text())
  else:
   with p.open('rb') as f:f.seek(max(0,p.stat().st_size-6000));out[name]=f.read().decode('utf-8','replace')
print(json.dumps(out))
'''.replace('@ROOT@',repr(r['root']))
v=jump(code)
(BASE/'xolotl-current-build-latest.json').write_text(json.dumps(v,indent=2)+'\n')
print(json.dumps(v,indent=2))
