"""Retain compiler resource lines for the exact merged and baseline GU kernels."""
import json
from xolotl_trial_common import BASE,jump
r=json.loads((BASE/'xolotl-ptq-mma-integrated-v2-intent.json').read_text())
code='''from pathlib import Path
import json,hashlib
root=Path(@ROOT@);p=root/'compile.stderr.log'
if root.resolve()!=root or root.stat().st_uid!=10250 or p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>2*1024**2:raise RuntimeError('compiler resource log identity differs')
raw=p.read_bytes();lines=raw.decode().splitlines();targets=['aster_ptq_hybrid_gu','native_gu_amd_kernelILi143ELi4EE'];out={}
for target in targets:
 out[target]=[lines[i:i+5] for i,line in enumerate(lines) if 'Function properties for' in line and target in line]
print(json.dumps(dict(root=str(root),compile_stderr_sha256=hashlib.sha256(raw).hexdigest(),targets=out)))
'''.replace('@ROOT@',repr(r['root']))
v=jump(code);(BASE/'xolotl-mma-v2-compiler-resources.json').write_text(json.dumps(v,indent=2)+'\n');print(json.dumps(v,indent=2))
