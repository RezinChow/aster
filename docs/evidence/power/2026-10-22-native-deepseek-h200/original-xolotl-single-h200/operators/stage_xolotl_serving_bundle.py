"""Stage only hash-bound public API artifacts into the separately owned serving root."""
import base64,hashlib,json,time
from xolotl_serving_common import BASE,lease,jump,observe
p=BASE/'xolotl-stable-service-stage.json'
if p.exists():raise RuntimeError('serving stage intent exists; inspect it')
o=observe();r=lease();meta=json.loads((BASE/'xolotl-serving-bundle-manifest.json').read_text());raw=(BASE/'xolotl-serving-public-bundle.tar.gz').read_bytes()
if hashlib.sha256(raw).hexdigest()!=meta['archive_sha256'] or len(raw)!=meta['archive_bytes']:raise RuntimeError('public bundle identity differs')
record=dict(root=r['remote']+'/serve-stable',unix=time.time(),phase='prepared',allocation_job=o['job'],allocation_uid=o['job_uid'],replica=o['replicas'][0]['name'],replica_uid=o['replicas'][0]['uid'],manifest=meta,chunks=[])
p.write_text(json.dumps(record,indent=2)+'\n')
code='''from pathlib import Path
import os,json
root=Path(@ROOT@)
if os.getuid()!=10250 or root.parent.resolve()!=root.parent or root.parent.stat().st_uid!=10250 or root.exists():raise RuntimeError('serving stage ownership/exclusivity differs')
root.mkdir(mode=0o700);print(json.dumps(dict(created=True)))
'''.replace('@ROOT@',repr(record['root']));jump(code)
for i in range(0,len(raw),1024**2):
 b=raw[i:i+1024**2];name='public-bundle.part'+str(i//1024**2).zfill(3);row=dict(file=name,bytes=len(b),sha256=hashlib.sha256(b).hexdigest());record['chunks'].append(row)
 code='''from pathlib import Path
import os,json,base64,hashlib
root=Path(@ROOT@);row=@ROW@;raw=base64.b64decode(@DATA@)
if root.resolve()!=root or root.stat().st_uid!=10250 or len(raw)!=row['bytes'] or hashlib.sha256(raw).hexdigest()!=row['sha256']:raise RuntimeError('public bundle chunk differs')
with (root/row['file']).open('xb') as f:f.write(raw)
print(json.dumps(dict(saved=True)))
'''.replace('@ROOT@',repr(record['root'])).replace('@ROW@',repr(row)).replace('@DATA@',repr(base64.b64encode(b).decode()));jump(code)
 record['phase']='staging_public_chunks';p.write_text(json.dumps(record,indent=2)+'\n')
code='''from pathlib import Path,PurePosixPath
import io,os,json,hashlib,tarfile
r=@R@;root=Path(r['root']);raw=b''
for row in r['chunks']:
 p=root/row['file']
 if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size!=row['bytes']:raise RuntimeError('public bundle chunk owner/bound differs')
 b=p.read_bytes()
 if hashlib.sha256(b).hexdigest()!=row['sha256']:raise RuntimeError('public bundle chunk hash differs')
 raw+=b
if hashlib.sha256(raw).hexdigest()!=r['manifest']['archive_sha256'] or len(raw)!=r['manifest']['archive_bytes']:raise RuntimeError('public bundle assembly differs')
wanted={q['file']:q for q in r['manifest']['files']};seen=set();total=0
with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as archive:
 for m in archive:
  name=PurePosixPath(m.name)
  if not m.isfile() or name.is_absolute() or '..' in name.parts or m.name not in wanted or m.name in seen:raise RuntimeError('unsafe or unexpected public archive member')
  row=wanted[m.name];total+=m.size
  if m.size!=row['bytes'] or m.size>4*1024**2 or total>24*1024**2:raise RuntimeError('public archive extraction bound exceeded')
  b=archive.extractfile(m).read(m.size+1)
  if len(b)!=m.size or hashlib.sha256(b).hexdigest()!=row['sha256']:raise RuntimeError('public member hash differs')
  p=root/m.name;p.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
  with p.open('xb') as f:f.write(b)
  p.chmod(0o600);seen.add(m.name)
if seen!=set(wanted):raise RuntimeError('public archive is incomplete')
(root/'public-manifest.json').write_text(json.dumps(r['manifest'],indent=2)+'\\n')
print(json.dumps(dict(staged=True,files=len(seen),bytes=total)))
'''.replace('@R@',repr(record));compile(code,'serving-safe-extract','exec');record['verified']=jump(code);record['phase']='public_artifacts_verified';p.write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(dict(phase=record['phase'],root=record['root'],verified=record['verified'])))
