"""Compare complete same-binary paired trials and retain every output ID."""
import json,time,argparse
from xolotl_trial_common import BASE
p=argparse.ArgumentParser();p.add_argument('--candidate',choices=['normal','stress'],required=True);args=p.parse_args()
names=['single-current-dense-chain-v3-'+('stress-' if args.candidate=='stress' else '')+'control','single-current-dense-chain-v3-'+('stress-' if args.candidate=='stress' else '')+'candidate']
rs=[json.loads((BASE/('xolotl-'+n+'-latest.json')).read_text(encoding='utf-8'))['result.json'] for n in names]
for r in rs:
 if r.get('phase')!='complete' or r.get('engine_exit')!=0 or not r.get('engine_reaped') or len(r['requests'])!=(9 if args.candidate=='stress' else 17):raise RuntimeError('both 17-request trials must finish and reap cleanly')
plans=[dict(r['plan']) for r in rs]
runtime=[json.loads((BASE/('xolotl-'+n+'-runtime.json')).read_text()) for n in names]
if not all(x['passed'] for x in runtime) or [x['first_deferred_finish_logs'] for x in runtime]!=[0,1]:raise RuntimeError('actual dense-chain runtime activation proof is required')
if [p.pop('dense_async_chain') for p in plans]!=[False,True] or plans[0]!=plans[1]:raise RuntimeError('same-binary plans differ beyond the explicit dense asynchronous-chain flag')
rows=[]
for index,(a,b) in enumerate(zip(rs[0]['requests'],rs[1]['requests'])):
 if (a['case'],a['role'],a['prompt_tokens'])!=(b['case'],b['role'],b['prompt_tokens']):raise RuntimeError('paired request identity differs')
 ai=[t['id'] for t in a['tokens']];bi=[t['id'] for t in b['tokens']]
 rows.append(dict(index=index,case=a['case'],role=a['role'],ids_equal=ai==bi,control_ids=ai,candidate_ids=bi,control_tok_s=a['selected_id_decode_tok_s'],candidate_tok_s=b['selected_id_decode_tok_s']))
def metric(r):
 qs=[q for q in r['requests'] if q['role']=='measured']
 n=sum(len(q['tokens'])-1 for q in qs);s=sum(q['tokens'][-1]['seconds']-q['tokens'][0]['seconds'] for q in qs)
 per={}
 for q in qs:per.setdefault(q['case'],[]).append(q)
 return dict(mixed_tok_s=n/s,per_case={c:dict(tok_s=sum(len(q['tokens'])-1 for q in v)/sum(q['tokens'][-1]['seconds']-q['tokens'][0]['seconds'] for q in v),min_tok_s=min(q['selected_id_decode_tok_s'] for q in v),samples=len(v)) for c,v in per.items()},all_measured_at_least_300=all(q['selected_id_decode_tok_s']>=300 for q in qs),all_measured_at_least_500=all(q['selected_id_decode_tok_s']>=500 for q in qs))
metrics=[metric(r) for r in rs];equal=all(row['ids_equal'] for row in rows)
out=dict(unix=time.time(),scope='single physical H200, one sequential request; actual first-to-last generated-ID arrival span; same binary with dense-chain0/1; '+args.candidate+', one paired round',binary=plans[0]['binary_sha256'],control=metrics[0],candidate=metrics[1],mixed_rate_gain_percent=100*(metrics[1]['mixed_tok_s']/metrics[0]['mixed_tok_s']-1),all_paired_ids_equal=equal,paired_output_count=len(rows),paired_requests=rows,runtime_proofs=runtime,diagnostic_only=args.candidate=='stress',stable_speed_qualified=False,adopted=False,target_300_met=args.candidate=='normal' and metrics[1]['all_measured_at_least_300'] and equal,target_500_met=args.candidate=='normal' and metrics[1]['all_measured_at_least_500'] and equal)
(BASE/('xolotl-dense-chain-v3-'+args.candidate+'-comparison.json')).write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in out.items() if k!='paired_requests'},indent=2))
