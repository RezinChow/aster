"""Report every predeclared pair; never replace missing or regressing samples."""
import json,time
from xolotl_trial_common import BASE
c=json.loads((BASE/'xolotl-qsum-v2-repeat-campaign.json').read_text());states=[[],[]];pairs=[];all_equal=True;plans=[]
def metric(rs):
 qs=[q for r in rs for q in r['requests'] if q['role']=='measured']
 return sum(len(q['tokens'])-1 for q in qs)/sum(q['tokens'][-1]['seconds']-q['tokens'][0]['seconds'] for q in qs)
for names in c['pairs']:
 rs=[json.loads((BASE/('xolotl-'+n+'-latest.json')).read_text())['result.json'] for n in names]
 for i,r in enumerate(rs):
  if r['phase']!='complete' or r.get('engine_exit')!=0 or not r.get('engine_reaped') or len(r['requests'])!=17:raise RuntimeError('each predeclared trial must complete17 and reap with exit0')
  p=dict(r['plan'])
  if p.pop('ptq_qsum')!=['0','gu'][i]:raise RuntimeError('repeat qsum state differs')
  plans.append(p);states[i].append(r)
 rows=[]
 for a,b in zip(rs[0]['requests'],rs[1]['requests']):
  if (a['case'],a['role'],a['prompt_tokens'])!=(b['case'],b['role'],b['prompt_tokens']):raise RuntimeError('paired request identity differs')
  same=[t['id'] for t in a['tokens']]==[t['id'] for t in b['tokens']];all_equal=all_equal and same;rows.append(same)
 a,b=metric([rs[0]]),metric([rs[1]]);pairs.append(dict(modes=names,control_tok_s=a,candidate_tok_s=b,gain_percent=100*(b/a-1),all17_ids_equal=all(rows)))
if any(p!=plans[0] for p in plans):raise RuntimeError('six plans differ beyond the explicit qsum flag')
a,b=metric(states[0]),metric(states[1]);gain=100*(b/a-1);passed=all_equal and all(p['gain_percent']>0 for p in pairs) and gain>=c['gate']['pooled_gain_at_least_percent']
out=dict(unix=time.time(),binary=plans[0]['binary_sha256'],order=c['order'],pairs=pairs,pooled_control_tok_s=a,pooled_candidate_tok_s=b,pooled_gain_percent=gain,all51_paired_ids_equal=all_equal,requests=102,engines_cleanly_reaped=6,predeclared_stability_gate=c['gate'],stability_gate_passed=passed,adopted=False,milestone300_met=False,goal500_met=False)
(BASE/'xolotl-qsum-v2-repeat-comparison.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
