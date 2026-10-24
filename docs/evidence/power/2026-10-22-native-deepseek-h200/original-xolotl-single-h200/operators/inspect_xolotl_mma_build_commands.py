"""Read exact pinned build commands; no build or GPU execution."""
import json
from xolotl_trial_common import BASE,owned
meta=json.loads((BASE/'xolotl-h200-split-rows-build-intent.json').read_text())
code='''import subprocess,json,os
from pathlib import Path
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=os.getuid():raise RuntimeError('build root owner differs')
out={}
for target in ['aster_xq_split_parity','ds41_generate']:
 p=subprocess.run(['ninja','-C',str(root/'build'),'-t','commands',target],capture_output=True,text=True,timeout=10,check=True)
 if len(p.stdout)>8*1024**2:raise RuntimeError('build command inventory exceeds bound')
 lines=p.stdout.splitlines();out[target]=dict(link_command=lines[-1],iq_compile=[s for s in lines if 'iq_kernels.cu.o' in s and ' -c ' in s])
print(json.dumps(out))
'''.replace('@ROOT@',repr(meta['root']))
r=owned(code);(BASE/'xolotl-mma-parent-build-commands.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
