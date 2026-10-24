"""Read the immutable dense source, archive identity and exact compiler invocation."""
import json,base64
from xolotl_trial_common import BASE,owned
parent=json.loads((BASE/'xolotl-h200-split-rows-build-intent.json').read_text())['root']
code='''from pathlib import Path
import os,json,hashlib,subprocess,shlex,base64
r=Path(@ROOT@);p=r/'source/tools/v41/engine/ds41_dense.cpp';lib=r/'build/libds41_dense.a'
if r.resolve()!=r or r.stat().st_uid!=os.getuid() or p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>512*1024:raise RuntimeError('dense parent identity differs')
q=subprocess.run(['ninja','-C',str(r/'build'),'-t','commands','ds41_generate'],capture_output=True,text=True,timeout=10,check=True)
if len(q.stdout)>8*1024**2:raise RuntimeError('dense command inventory bound exceeded')
matches=[]
for line in q.stdout.splitlines():
 a=shlex.split(line)
 if a.count('-c')==1 and a[a.index('-c')+1]==str(p):matches.append(line)
if len(matches)!=1:raise RuntimeError('dense compiler command not unique')
raw=p.read_bytes();out=dict(parent=str(r),source_sha256=hashlib.sha256(raw).hexdigest(),source_bytes=len(raw),source_base64=base64.b64encode(raw).decode(),compile_command=matches[0],archive_sha256=hashlib.sha256(lib.read_bytes()).hexdigest(),archive_bytes=lib.stat().st_size)
print(json.dumps(out))
'''.replace('@ROOT@',repr(parent));v=owned(code);raw=base64.b64decode(v.pop('source_base64'));(BASE/'xolotl-dense-chain-parent.cpp').write_bytes(raw);(BASE/'xolotl-dense-chain-parent.json').write_text(json.dumps(v,indent=2)+'\n');print(json.dumps(v,indent=2))
