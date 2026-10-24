"""Prove actual async-path activation from complete bounded stderr, not a truncated tail."""
import argparse,json,hashlib
from xolotl_trial_common import BASE,jump
p=argparse.ArgumentParser();p.add_argument('--mode',required=True,choices=['single-current-dense-chain-v3-control','single-current-dense-chain-v3-candidate','single-current-dense-chain-v3-stress-control','single-current-dense-chain-v3-stress-candidate']);a=p.parse_args();r=json.loads((BASE/('xolotl-'+a.mode+'-intent.json')).read_text())
code='''from pathlib import Path
import json,hashlib
r=@R@;root=Path(r['root']);p=root/'engine.stderr.log'
if root.resolve()!=root or root.stat().st_uid!=10250 or p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>262144:raise RuntimeError('dense runtime receipt bound differs')
q=json.loads((root/'result.json').read_text())
if q['phase']!='complete' or q.get('engine_exit')!=0 or not q.get('engine_reaped'):raise RuntimeError('dense runtime must complete and reap')
raw=p.read_bytes();s=raw.decode();marker='ASTER_DENSE_CHAIN first cached single-sequence CUDA finish queued'
count=s.count(marker);expected=1 if r['plan']['dense_async_chain'] else0
if count!=expected:raise RuntimeError('actual cached CUDA finish activation differs: '+str(count))
resets=s.count('ds41_dense: pass graph cache full (')
if r['plan']['chain_stress'] and resets==0:raise RuntimeError('requested pass-cache reset stress did not occur')
print(json.dumps(dict(mode=@MODE@,phase=q['phase'],requests=len(q['requests']),async_chain=r['plan']['dense_async_chain'],first_deferred_finish_logs=count,pass_cache_resets=resets,stderr_sha256=hashlib.sha256(raw).hexdigest(),stderr_bytes=len(raw),passed=True)))
'''.replace('@R@',repr(r)).replace('@MODE@',repr(a.mode)).replace('else0','else 0')
compile(code,'dense-runtime-inspection','exec');v=jump(code);(BASE/('xolotl-'+a.mode+'-runtime.json')).write_text(json.dumps(v,indent=2)+'\n');print(json.dumps(v))
