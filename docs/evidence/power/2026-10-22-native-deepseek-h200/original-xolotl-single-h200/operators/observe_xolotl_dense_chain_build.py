"""Observe a frozen build without restarting a possibly running compiler."""
import json
from xolotl_trial_common import BASE,jump
r=json.loads((BASE/'xolotl-dense-chain-build-intent.json').read_text())
code='''from pathlib import Path
import json
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('dense observation owner differs')
out={}
for n in ['result.json','process.json','worker.log','compile.stderr.log','host-test.stdout.log']:
 p=root/n
 if p.exists():
  if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>262144:raise RuntimeError('dense output bound exceeded')
  out[n]=json.loads(p.read_text()) if n.endswith('.json') else p.read_text()
print(json.dumps(out))
'''.replace('@ROOT@',repr(r['root']))
v=jump(code);(BASE/'xolotl-dense-chain-build-latest.json').write_text(json.dumps(v,indent=2)+'\n');q=v.get('result.json',{});print(json.dumps(dict(phase=q.get('phase'),step=q.get('step'),passed=q.get('passed'),error=q.get('error'),binary=q.get('binary'),host_tests=v.get('host-test.stdout.log'),compiler=v.get('compile.stderr.log','')[-1800:])))
