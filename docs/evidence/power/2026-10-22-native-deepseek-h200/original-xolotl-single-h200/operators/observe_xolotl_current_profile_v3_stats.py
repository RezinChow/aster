"""Read only the exact current profile statistics and capture receipts."""
import json,time
from xolotl_trial_common import BASE,jump
r=json.loads((BASE/'xolotl-single-current-qsum-v2-profile-intent.json').read_text())
code='''from pathlib import Path
import json,time
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('statistics observation owner differs')
out=dict(unix=time.time())
for n in ['statistics-launch.json','statistics-result.json','statistics-worker.log','stats.stdout.log','stats.stderr.log','nsys-start.log','nsys-stop.log','profile-target-process.json','nsys-launch-process.json']:
 p=root/n
 if not p.exists():continue
 if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>2*1024**2:raise RuntimeError('statistics receipt bound exceeded')
 out[n]=json.loads(p.read_text()) if n.endswith('.json') else p.read_text()[-12000:]
print(json.dumps(out))
'''.replace('@ROOT@',repr(r['root']))
v=jump(code);(BASE/'xolotl-current-profile-v3-statistics-latest.json').write_text(json.dumps(v,indent=2)+'\n');print(json.dumps(v,indent=2))
