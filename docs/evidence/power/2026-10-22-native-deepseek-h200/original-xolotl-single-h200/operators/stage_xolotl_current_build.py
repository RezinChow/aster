"""Stage official pinned archives and frozen opt-in patch; no GPU process."""
import base64,hashlib,json,shlex,subprocess,time
from xolotl_trial_common import BASE,SSH,lease,jump
recordpath=BASE/'xolotl-h200-current-build-intent.json'
if recordpath.exists():raise RuntimeError('build intent exists; inspect it instead of restarting')
intent=lease();source=BASE/'xolotl-trial-source-e9d0826d71c5'
files=[source/'Xolotl-e9d0826d71c59072cbff77d2a31dd51f27ab7a12.tar.gz',source/'llama.cpp-3cf03257f219afbe7334045ff7c6a06ac68c627d.tar.gz',BASE/'xolotl-h200-graph-experiments.patch',BASE/'xolotl_current_build_worker.py']
names=['xolotl.tar.gz','llama.tar.gz','h200-experiments.patch','worker.py']
root=intent['remote']+'/xolotl-current-h200'
r=dict(unix=time.time(),phase='prepared',root=root,source_revision='e9d0826d71c59072cbff77d2a31dd51f27ab7a12',files=[dict(file=n,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for n,p in zip(names,files)])
def save():recordpath.write_text(json.dumps(r,indent=2)+'\n')
save()
code='''from pathlib import Path
import json,os
p=Path(@ROOT@)
if p.parent.resolve()!=p.parent or p.parent.stat().st_uid!=10250 or os.getuid()!=10250:raise RuntimeError('build stage owner differs')
os.umask(0o077);p.mkdir(mode=0o700,exist_ok=False)
print(json.dumps(dict(created=True)))
'''.replace('@ROOT@',repr(root))
r['created']=jump(code);r['phase']='uploading';save()
for meta,path in zip(r['files'],files):
 code='''from pathlib import Path
import hashlib,json,sys,os
root=Path(@ROOT@);m=@META@
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('archive upload owner changed')
os.umask(0o077);p=root/(m['file']+'.partial');h=hashlib.sha256();n=0
with p.open('xb') as out:
 while b:=sys.stdin.buffer.read(1024**2):
  n+=len(b)
  if n>m['bytes']:raise RuntimeError('archive exceeds frozen length')
  out.write(b);h.update(b)
if n!=m['bytes'] or h.hexdigest()!=m['sha256']:raise RuntimeError('archive hash differs')
p.rename(root/m['file'])
print(json.dumps(dict(file=m['file'],bytes=n,verified=True)))
'''.replace('@ROOT@',repr(root)).replace('@META@',repr(meta))
 command='python3 -c '+shlex.quote(code)
 with path.open('rb') as inp:
  p=subprocess.run(SSH+[command],stdin=inp,capture_output=True,timeout=180)
 if p.returncode:raise RuntimeError('source upload failed; inspect frozen stage: '+p.stderr.decode(errors='replace')[-1500:])
 meta['upload']=json.loads(p.stdout);save()
code='''from pathlib import Path,PurePosixPath
import tarfile,json
root=Path(@ROOT@)
for archive,dest in [(root/'xolotl.tar.gz',root/'source'),(root/'llama.tar.gz',root/'source/third_party/llama.cpp')]:
 if dest.exists():raise RuntimeError('source extraction would replace existing directory')
 dest.mkdir(parents=True)
 with tarfile.open(archive,'r:gz') as tf:
  members=tf.getmembers()
  if len(members)>30000 or sum(m.size for m in members)>1024**3:raise RuntimeError('source extraction bound exceeded')
  for m in members:
   parts=PurePosixPath(m.name).parts
   if not parts or '..' in parts or PurePosixPath(m.name).is_absolute() or m.issym() or m.islnk():raise RuntimeError('unsafe source archive member')
   parts=parts[1:]
   if not parts:continue
   p=dest.joinpath(*parts)
   if m.isdir():p.mkdir(parents=True,exist_ok=True)
   elif m.isfile():
    p.parent.mkdir(parents=True,exist_ok=True)
    with tf.extractfile(m) as inp,p.open('xb') as out:
     while b:=inp.read(1024**2):out.write(b)
    p.chmod(m.mode&0o777)
   else:raise RuntimeError('unsupported source archive entry')
print(json.dumps(dict(extracted=True,git_repositories_created=False)))
'''.replace('@ROOT@',repr(root))
r['extraction']=jump(code,100);r['phase']='staged';save();print(json.dumps(r,indent=2))
