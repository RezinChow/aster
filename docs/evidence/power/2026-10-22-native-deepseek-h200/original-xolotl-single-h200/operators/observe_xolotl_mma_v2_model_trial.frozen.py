"""Read one existing trial; does not restart anything or execute GPU work."""
import argparse,json
from xolotl_trial_common import BASE,jump
p=argparse.ArgumentParser();p.add_argument('--mode',required=True,choices=['single-current-mma-v2-control', 'single-current-mma-v2-candidate', 'single-current-mma-v2-diagnostic', 'single-current-mma-v2-original-mtp']);p.add_argument('--brief',action='store_true');a=p.parse_args()
r=json.loads((BASE/('xolotl-'+a.mode+'-intent.json')).read_text())
code='''import json,time
from pathlib import Path
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('trial observation owner differs')
out=dict(unix=time.time())
for name in ['result.json','worker.log','engine.stderr.log','engine-process.json']:
 p=root/name
 if not p.exists():continue
 if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>64*1024**2:raise RuntimeError('trial output bound exceeded')
 if name.endswith('.json'):
  if p.stat().st_size>1024**2:raise RuntimeError('trial JSON bound exceeded')
  out[name]=json.loads(p.read_text())
 else:
  with p.open('rb') as f:f.seek(max(0,p.stat().st_size-16384));out[name]=f.read().decode('utf-8','replace')
print(json.dumps(out))
'''.replace('@ROOT@',repr(r['root']))
v=jump(code)
(BASE/('xolotl-'+a.mode+'-latest.json')).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
result=v.get('result.json',{})
print(json.dumps(dict(phase=result.get('phase'),error=result.get('error'),ready_line=result.get('ready_line'),requests=[dict(case=q['case'],role=q['role'],tokens=q['completion_tokens'],decode_tok_s=q['selected_id_decode_tok_s'],done=q['done']) for q in result.get('requests',[])],stderr=v.get('engine.stderr.log','')[-(1000 if a.brief else 7500):],worker=v.get('worker.log','')[-2000:]),ensure_ascii=False,indent=2))
