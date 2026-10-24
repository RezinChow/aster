"""Reuse the pinned SM90 engine and source archives; no GPU execution."""
import json
from xolotl_trial_common import BASE,lease,jump
intent=lease()
code='''import hashlib,json,tarfile,time,os
from pathlib import Path,PurePosixPath
root=Path(@ROOT@)/'xolotl-b345'
if root.exists():raise RuntimeError('immutable Xolotl stage exists; inspect it')
parent=root.parent
if parent.resolve()!=parent or parent.stat().st_uid!=10250 or os.getuid()!=10250:raise RuntimeError('trial stage owner changed')
os.umask(0o077);root.mkdir(mode=0o700)
assets=parent.parent
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  while b:=f.read(8*1024**2):h.update(b)
 return h.hexdigest()
proof={}
for name,expected in [('validated-h200-engine.tar.gz','c5574540f36a37deef52ec4f72acca894b738f97f72dfac2bef37c6becfb3c95'),('source/xolotl.tar.gz','faf35a4a783a6f95f8bafa39c4004d3b97dce93b4b36c5128c9663531005eadc')]:
 p=assets/name
 if sha(p)!=expected:raise RuntimeError('pinned existing engine/source archive changed')
 proof[name]=expected
 dest=root/('source' if name.startswith('source/') else 'engine')
 dest.mkdir()
 with tarfile.open(p,'r:gz') as tf:
  members=tf.getmembers()
  if len(members)>30000 or sum(m.size for m in members)>1024**3:raise RuntimeError('existing engine source archive bound exceeded')
  for m in members:
   parts=PurePosixPath(m.name).parts
   if not parts or '..' in parts or PurePosixPath(m.name).is_absolute() or m.issym() or m.islnk():raise RuntimeError('unsafe archive member')
   if name.startswith('source/'):parts=parts[1:]
   if not parts:continue
   target=dest.joinpath(*parts)
   if m.isdir():target.mkdir(parents=True,exist_ok=True)
   elif m.isfile():
    target.parent.mkdir(parents=True,exist_ok=True)
    with tf.extractfile(m) as f,target.open('xb') as out:
     while b:=f.read(1024**2):out.write(b)
    target.chmod(m.mode&0o777)
   else:raise RuntimeError('unsupported archive member')
binary=root/'engine/build-h200/ds41_generate'
if binary.stat().st_size!=247846768:raise RuntimeError('existing engine binary size differs')
out=dict(unix=time.time(),root=str(root),engine_revision='b3452666e07a6374d06bb8c2185dffa271e8f65f',binary_sha256=sha(binary),binary_bytes=binary.stat().st_size,archives=proof,gpu_execution_claimed=False)
(root/'stage-result.json').write_text(json.dumps(out,indent=2)+'\\n')
print(json.dumps(out))
'''.replace('@ROOT@',repr(intent['remote']))
v=jump(code,100)
(BASE/'xolotl-b345-stage-result.json').write_text(json.dumps(v,indent=2)+'\n')
print(json.dumps(v,indent=2))
