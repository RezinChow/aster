"""Inspect one sidecar upload/hash intent without recreating any process."""
import json,time
from xolotl_trial_common import BASE,jump
r=json.loads((BASE/'xolotl-original-mtp-stage-intent.json').read_text())
code='''from pathlib import Path
import json,time
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('sidecar observation owner differs')
out=dict(unix=time.time())
for name in ['V41-MTP-Vision-1017.gguf.part','V41-MTP-Vision-1017.gguf']:
 p=root/name
 if p.exists():
  if p.is_symlink() or p.stat().st_uid!=10250:raise RuntimeError('sidecar file owner differs')
  out[name]=dict(bytes=p.stat().st_size,inode=p.stat().st_ino)
for name in ['result.json','process.json','worker.log']:
 p=root/name
 if p.exists():
  if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>65536:raise RuntimeError('sidecar receipt bound differs')
  out[name]=json.loads(p.read_text()) if name.endswith('.json') else p.read_text()[-4096:]
print(json.dumps(out))
'''.replace('@ROOT@',repr(r['root']))
v=jump(code);(BASE/'xolotl-original-mtp-stage-latest.json').write_text(json.dumps(v,indent=2)+'\n');print(json.dumps(v,indent=2))
