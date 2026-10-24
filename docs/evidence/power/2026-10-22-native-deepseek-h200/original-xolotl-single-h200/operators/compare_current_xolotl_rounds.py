"""Same-binary experimental comparison with exact emitted-ID parity checks."""
import json
from xolotl_trial_common import BASE,jump
names=['single-current-warm-control','single-current-warm-cache1024','single-current-warm-cache1024-async']
names+=['single-current-warm-cache1024-r2','single-current-warm-cache1024-r4']
results={}
for name in names:
 p=BASE/('xolotl-'+name+'-latest.json')
 if p.exists():
  v=json.loads(p.read_text(encoding='utf-8'))['result.json']
  if v['phase']=='complete':results[name]=v
if names[0] not in results:raise RuntimeError('new source control incomplete')
control=results[names[0]]
out=dict(target_single_gpu_tok_s=500,goal_complete=False,profiles={},limits='One sequential block per profile; retain all samples/outliers; not three alternating blocks')
for name,r in results.items():
 if r['plan']['binary_sha256']!=control['plan']['binary_sha256']:raise RuntimeError('comparison must use one exact binary')
 if r['plan']['cases']!=control['plan']['cases']:raise RuntimeError('prompts or budgets differ')
 if len(r['requests'])!=len(control['requests']):raise RuntimeError('request sets differ')
 parity=[]
 for a,b in zip(control['requests'],r['requests']):
  if (a['case'],a['role'],a['prompt_tokens'])!=(b['case'],b['role'],b['prompt_tokens']):raise RuntimeError('case order differs')
  parity.append([t['id'] for t in a['tokens']]==[t['id'] for t in b['tokens']])
 summary=json.loads((BASE/('xolotl-'+name+'-summary.json')).read_text(encoding='utf-8'))
 out['profiles'][name]=dict(per_case=summary['per_case'],weighted_decode_tok_s=summary['single_request_weighted_decode_tok_s'],exact_request_id_parity=parity,all_request_id_parity=all(parity),engine_reaped=r['engine_reaped'])
record=BASE/'xolotl-current-round-comparison.json';record.write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))
