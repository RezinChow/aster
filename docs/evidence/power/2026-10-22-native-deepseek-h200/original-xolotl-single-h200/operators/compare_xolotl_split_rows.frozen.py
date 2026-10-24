"""Compare one complete same-binary host/device input pair, preserving every token."""
import argparse,json,time
from xolotl_trial_common import BASE
p=argparse.ArgumentParser();p.add_argument('--cpu',action='store_true');a=p.parse_args()
stem='single-current-device-cpu-' if a.cpu else 'single-current-device-'
names=['single-current-rows-control','single-current-rows-r2'];expected=17
rs=[json.loads((BASE/('xolotl-'+n+'-latest.json')).read_text(encoding='utf-8'))['result.json'] for n in names]
for r in rs:
 if r['phase']!='complete' or r['engine_exit']!=0 or not r['engine_reaped'] or len(r['requests'])!=expected:raise RuntimeError('complete/reaped campaigns required')
 if r['plan']['visible_devices']!='0':raise RuntimeError('single device required')
for r in rs:
 if 'expert_rows_per_warp' in r['plan'] and 'ptq_rows_per_warp' not in r['plan']:raise RuntimeError('generic expert rows are not overridden by the final PTQ selector')
plans=[{k:v for k,v in r['plan'].items() if k not in ('ptq_rows_per_warp','split_mmvq','split_rows','expert_rows_per_warp')} for r in rs]
if plans[0]!=plans[1]:raise RuntimeError('plans differ beyond the combined expert layout')
def measure(qs):
 n=sum(len(q['tokens'])-1 for q in qs);d=sum(q['tokens'][-1]['seconds']-q['tokens'][0]['seconds'] for q in qs)
 return dict(samples=len(qs),tokens_after_first=n,decode_seconds=d,tok_s=n/d,min_tok_s=min(q['selected_id_decode_tok_s'] for q in qs),max_tok_s=max(q['selected_id_decode_tok_s'] for q in qs))
rows=[]
for name,r in zip(names,rs):
 qs=[q for q in r['requests'] if q['role']=='measured']
 rows.append(dict(mode=name,mixed=measure(qs),per_case={case:measure([q for q in qs if q['case']==case]) for case in dict.fromkeys(q['case'] for q in qs)}))
parity=[]
for x,y in zip(rs[0]['requests'],rs[1]['requests']):
 if (x['case'],x['role'])!=(y['case'],y['role']):raise RuntimeError('request alignment differs')
 parity.append(dict(case=x['case'],role=x['role'],same_ids=[t['id'] for t in x['tokens']]==[t['id'] for t in y['tokens']]))
out=dict(unix=time.time(),phase='complete',cpu_fallback_control=a.cpu,selector_note='Generic expert row metadata is superseded by the later PTQ selector, which sets both T143 and T11 in the frozen worker; original intents retained',target_tok_s=300,target_met=False,rows=rows,delta_percent=(rows[1]['mixed']['tok_s']/rows[0]['mixed']['tok_s']-1)*100,paired_requests=parity,all_ids_equal=all(r['same_ids'] for r in parity),adopted=False,scope='one serial paired expert-layout campaign; no stable speedup qualification')
name='xolotl-split-rows-round-comparison.json'
(BASE/name).write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
