"""Read the exact parent compile command for the private shutdown diagnostic hook."""
import json
from xolotl_trial_common import BASE,owned
parent=json.loads((BASE/'xolotl-h200-split-rows-build-intent.json').read_text())['root']
code='''from pathlib import Path
import os,json,subprocess,shlex
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=os.getuid():raise RuntimeError('main build root differs')
p=subprocess.run(['ninja','-C',str(root/'build'),'-t','commands','ds41_generate'],capture_output=True,text=True,timeout=10,check=True)
if len(p.stdout)>8*1024**2:raise RuntimeError('main command inventory bound exceeded')
lines=[]
for s in p.stdout.splitlines():
 args=shlex.split(s)
 if args.count('-c')==1 and args[args.index('-c')+1]==str(root/'source/tools/v41/engine/ds41_generate.cpp'):lines.append(s)
if len(lines)!=1:raise RuntimeError('main translation-unit command is not unique')
print(json.dumps(dict(parent=str(root),command=lines[0])))
'''.replace('@ROOT@',repr(parent))
v=owned(code);(BASE/'xolotl-parent-main-compile-command.json').write_text(json.dumps(v,indent=2)+'\n');print(json.dumps(v,indent=2))
