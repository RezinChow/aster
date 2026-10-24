"""Read complete diagnostic stderr and exact parent native-class metadata."""
import json
from xolotl_trial_common import BASE,jump
r=json.loads((BASE/'xolotl-single-current-mma-v2-diagnostic-intent.json').read_text())
code='''from pathlib import Path
import json
root=Path(@ROOT@);p=root/'engine.stderr.log'
if root.resolve()!=root or root.stat().st_uid!=10250 or p.is_symlink() or p.stat().st_size>262144:raise RuntimeError('runtime diagnostic identity differs')
s=p.read_text();out=dict(stderr_bytes=p.stat().st_size,prefix=s[:14000],histogram_lines=[line for line in s.splitlines() if line.startswith('ASTER_MMA_GROUPS')])
print(json.dumps(out))
'''.replace('@ROOT@',repr(r['root']))
v=jump(code);(BASE/'xolotl-mma-v2-runtime-inspection.json').write_text(json.dumps(v,indent=2)+'\n');print(json.dumps(v,indent=2))
