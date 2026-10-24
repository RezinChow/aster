"""Report an already completed predeclared pair without hiding later incomplete pairs."""
import argparse,json,time
from xolotl_trial_common import BASE
p=argparse.ArgumentParser();p.add_argument('--pair',type=int,choices=[1,2,3],required=True);args=p.parse_args();campaign=json.loads((BASE/'xolotl-dense-chain-v3-repeat-campaign.json').read_text());names=campaign['pairs'][args.pair-1];rs=[];plans=[]
for i,n in enumerate(names):
 r=json.loads((BASE/('xolotl-'+n+'-latest.json')).read_text())['result.json'];proof=json.loads((BASE/('xolotl-'+n+'-runtime.json')).read_text())
 if r['phase']!='complete' or r.get('engine_exit')!=0 or not r.get('engine_reaped') or len(r['requests'])!=17 or not proof['passed'] or proof['first_deferred_finish_logs']!=i:raise RuntimeError('pair requires clean completion and actual path proof')
 plan=dict(r['plan'])
 if plan.pop('dense_async_chain')!=bool(i):raise RuntimeError('pair flag differs')
 plans.append(plan);rs.append(r)
if plans[0]!=plans[1]:raise RuntimeError('pair plans differ beyond the scheduling flag')
def rate(r):
 rows=[q for q in r['requests'] if q['role']=='measured']
 return sum(len(q['tokens'])-1 for q in rows)/sum(q['tokens'][-1]['seconds']-q['tokens'][0]['seconds'] for q in rows)
a,b=[rate(r) for r in rs];equal=all((a['case'],a['role'],[v['id'] for v in a['tokens']])==(b['case'],b['role'],[v['id'] for v in b['tokens']]) for a,b in zip(rs[0]['requests'],rs[1]['requests']))
out=dict(unix=time.time(),pair=args.pair,modes=names,control_tok_s=a,candidate_tok_s=b,gain_percent=100*(b/a-1),all17_ids_equal=equal,adopted=False,three_pair_stability_not_yet_claimed=True)
(BASE/('xolotl-dense-chain-v3-pair'+str(args.pair)+'-interim.json')).write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
