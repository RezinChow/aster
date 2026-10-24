"""Freeze public upstream API sources, matching tokenizer and minimal pinned wheels."""
import concurrent.futures,gzip,hashlib,io,json,tarfile,time,urllib.request
from pathlib import Path
from xolotl_trial_common import BASE
src=BASE/'xolotl-trial-source-e9d0826d71c5/source';out=BASE/'xolotl-serving-bundle'
out.mkdir(exist_ok=True);deps=out/'wheels';deps.mkdir(exist_ok=True)
packages={'regex':'2026.9.10','Jinja2':'3.1.6','MarkupSafe':'3.0.3'}
def fetch(item):
 name,version=item;url='https://pypi.org/pypi/'+name+'/'+version+'/json'
 with urllib.request.urlopen(url,timeout=25) as q:meta=json.load(q)
 if meta['info']['version']!=version:raise RuntimeError('pinned Python release differs')
 rows=[r for r in meta['urls'] if r['packagetype']=='bdist_wheel' and ('py3-none-any' in r['filename'] or ('cp310-cp310' in r['filename'] and 'manylinux' in r['filename'] and 'x86_64' in r['filename']))]
 if not rows:raise RuntimeError('no pinned CPython3.10 Linux binary wheel: '+name)
 r=sorted(rows,key=lambda v:(len(v['filename']),v['filename']))[0];p=deps/r['filename']
 if p.exists():data=p.read_bytes()
 else:
  with urllib.request.urlopen(r['url'],timeout=40) as q:data=q.read(2*1024**2+1)
 if len(data)!=r['size'] or len(data)>2*1024**2 or hashlib.sha256(data).hexdigest()!=r['digests']['sha256']:raise RuntimeError('pinned wheel identity differs: '+name)
 if not p.exists():p.write_bytes(data)
 return dict(package=name,version=version,file='wheels/'+p.name,bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),source=url,download_url=r['url'])
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: wheels=list(pool.map(fetch,packages.items()))
files={}
for p in (src/'serve').rglob('*.py'):
 if '__pycache__' not in p.parts:files['source/'+p.relative_to(src).as_posix()]=p
for n in ['LICENSE','tools/strata_tokenizer.py','tools/v41/dsv41_encoding.py','tools/v41/serve/serve_ds41.py','tools/v41/serve/test_serve_ds41.py']:
 files['source/'+n]=src/n
for p in (BASE/'xolotl-serving-tokenizer').iterdir():
 if p.is_file():files['tokenizer/'+p.name]=p
for r in wheels:files[r['file']]=out/r['file']
tk=(BASE/'official-reference/tokenizer.json').read_bytes()
if hashlib.sha256(tk).hexdigest()!=json.loads((BASE/'xolotl-trial-prompt-ids.json').read_text())['tokenizer_sha256']:raise RuntimeError('official tokenizer provenance differs')
manifest=dict(schema='aster-xolotl-public-serving-bundle-v1',unix=time.time(),source_revision='e9d0826d71c59072cbff77d2a31dd51f27ab7a12',upstream='https://github.com/Indras-Mirror/Xolotl',tokenizer_source_sha256=hashlib.sha256(tk).hexdigest(),wheels=wheels,files=[])
total=0;body=io.BytesIO()
with gzip.GzipFile(fileobj=body,mode='wb',mtime=0) as gz:
 with tarfile.open(fileobj=gz,mode='w') as tar:
  for name,p in sorted(files.items()):
   raw=p.read_bytes();total+=len(raw)
   if len(raw)>4*1024**2 or total>24*1024**2:raise RuntimeError('serving public bundle bound exceeded')
   manifest['files'].append(dict(file=name,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest()))
   member=tarfile.TarInfo(name);member.size=len(raw);member.mode=0o600;member.mtime=0;tar.addfile(member,io.BytesIO(raw))
raw=body.getvalue();(BASE/'xolotl-serving-public-bundle.tar.gz').write_bytes(raw)
manifest.update(archive_bytes=len(raw),archive_sha256=hashlib.sha256(raw).hexdigest(),uncompressed_bytes=total)
(BASE/'xolotl-serving-bundle-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(dict(prepared=True,files=len(files),archive_bytes=len(raw),sha256=manifest['archive_sha256'],wheels=[dict(package=r['package'],version=r['version']) for r in wheels])))
