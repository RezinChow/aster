import json
from xolotl_trial_common import BASE,jump
r=json.loads((BASE/'xolotl-ptq-mma-v2-intent.json').read_text())
code='''from pathlib import Path
import json,time
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('prototype observation owner differs')
out=dict(unix=time.time())
for name in ['result.json','worker.log','compile.stderr.log','link.stderr.log','gpu.stderr.log','gpu.stdout.log']:
 p=root/name
 if not p.exists():continue
 if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>2*1024**2:raise RuntimeError('prototype artifact bound differs')
 if name.endswith('.json'):out[name]=json.loads(p.read_text())
 else:
  with p.open('rb') as f:f.seek(max(0,p.stat().st_size-16384));out[name]=f.read().decode('utf-8','replace')
print(json.dumps(out))
'''.replace('@ROOT@',repr(r['root']))
v=jump(code);(BASE/'xolotl-ptq-mma-v2-latest.json').write_text(json.dumps(v,indent=2)+'\n');print(json.dumps(v,indent=2))
