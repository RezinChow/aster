import json
from xolotl_trial_common import BASE,jump
r=json.loads((BASE/'xolotl-h200-split-rows-build-intent.json').read_text())
code='''import json
from pathlib import Path
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('split build owner differs')
o={}
for name in ['build-result.json','worker.log','configure.log','compile.log','split-mmvq-patch.log','device-verify-patch.log','split-rows-patch.log']:
 p=root/name
 if not p.exists():continue
 if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>64*1024**2:raise RuntimeError('split build log bound differs')
 if p.suffix=='.json':o[name]=json.loads(p.read_text())
 else:
  with p.open('rb') as f:f.seek(max(0,p.stat().st_size-3000));o[name]=f.read().decode('utf-8','replace')
print(json.dumps(o))
'''.replace('@ROOT@',repr(r['root']))
v=jump(code)
(BASE/'xolotl-split-rows-build-latest.json').write_text(json.dumps(v,indent=2)+'\n')
print(json.dumps(v,indent=2))
