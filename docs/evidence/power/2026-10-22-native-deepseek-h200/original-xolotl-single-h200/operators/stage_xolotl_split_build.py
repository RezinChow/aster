"""Reuse immutable public archives in a new owner-only directory, no git repo."""
import base64,hashlib,json,time
from xolotl_trial_common import BASE,jump
prior=json.loads((BASE/'xolotl-h200-current-build-intent.json').read_text())
path=BASE/'xolotl-h200-split-build-intent.json'
if path.exists():raise RuntimeError('split build exists; inspect existing intent')
source=(BASE/'xolotl_current_build_worker.py').read_text()
anchor=" command(['patch','--batch','--fuzz=0','-p1','-d',str(source),'-i',str(ROOT/'h200-experiments.patch')],'h200-experiment-patch',30)"
if source.count(anchor)!=1:raise RuntimeError('worker patch anchor differs')
source=source.replace(anchor,anchor+"\n command(['patch','--batch','--fuzz=0','-p1','-d',str(source),'-i',str(ROOT/'split-mmvq.patch')],'split-mmvq-patch',30)")
source=source.replace("'-DSTRATA_BUILD_TESTS=OFF'","'-DSTRATA_BUILD_TESTS=OFF','-DASTER_XQ_BUILD_SPLIT_TEST=ON'")
source=source.replace("'test_ds41_fq','test_ds41_hcmix'","'aster_xq_split_parity'")
compile(source,'split-build-worker.py','exec')
(BASE/'xolotl_split_build_worker.frozen.py').write_text(source,encoding='utf-8',newline='\n')
payload={'h200-experiments.patch':(BASE/'xolotl-h200-graph-experiments.patch').read_bytes(),'split-mmvq.patch':(BASE/'xolotl-h200-split-mmvq.patch').read_bytes(),'worker.py':source.encode()}
r=dict(unix=time.time(),phase='prepared',root=prior['root'].rsplit('/',1)[0]+'/xolotl-split-mmvq-h200',source_revision=prior['source_revision'],prior_root=prior['root'],files=prior['files'][:2]+[dict(file=k,bytes=len(v),sha256=hashlib.sha256(v).hexdigest()) for k,v in payload.items()])
path.write_text(json.dumps(r,indent=2)+'\n')
code='''from pathlib import Path,PurePosixPath
import os,hashlib,json,base64,tarfile
r=@RECORD@;root=Path(r['root']);prior=Path(r['prior_root'])
if root.parent.resolve()!=root.parent or root.parent.stat().st_uid!=10250 or os.getuid()!=10250:raise RuntimeError('split stage ownership differs')
os.umask(0o077);root.mkdir(mode=0o700,exist_ok=False)
for m in r['files'][:2]:
 p=prior/m['file']
 if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size!=m['bytes'] or hashlib.sha256(p.read_bytes()).hexdigest()!=m['sha256']:raise RuntimeError('public source archive identity differs')
 os.link(p,root/m['file'])
payload=@PAYLOAD@
for m in r['files'][2:]:
 raw=base64.b64decode(payload[m['file']])
 if len(raw)!=m['bytes'] or hashlib.sha256(raw).hexdigest()!=m['sha256']:raise RuntimeError('split input differs')
 (root/m['file']).write_bytes(raw)
for archive,dest in [(root/'xolotl.tar.gz',root/'source'),(root/'llama.tar.gz',root/'source/third_party/llama.cpp')]:
 dest.mkdir(parents=True,exist_ok=False)
 with tarfile.open(archive,'r:gz') as tf:
  members=tf.getmembers()
  if len(members)>30000 or sum(m.size for m in members)>1024**3:raise RuntimeError('extraction bounds differ')
  for m in members:
   parts=PurePosixPath(m.name).parts
   if not parts or '..' in parts or PurePosixPath(m.name).is_absolute() or m.issym() or m.islnk():raise RuntimeError('unsafe archive member')
   parts=parts[1:]
   if not parts:continue
   p=dest.joinpath(*parts)
   if m.isdir():p.mkdir(parents=True,exist_ok=True)
   elif m.isfile():
    p.parent.mkdir(parents=True,exist_ok=True)
    with tf.extractfile(m) as inp,p.open('xb') as out:
     while b:=inp.read(1024**2):out.write(b)
    p.chmod(m.mode&0o777)
   else:raise RuntimeError('unsupported source member')
print(json.dumps(dict(extracted=True,git_repositories_created=False)))
'''.replace('@RECORD@',repr(r)).replace('@PAYLOAD@',repr({k:base64.b64encode(v).decode() for k,v in payload.items()}))
r['stage']=jump(code,100);r['phase']='staged';path.write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps(dict(root=r['root'],phase=r['phase']),indent=2))
