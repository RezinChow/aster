"""Compare complete serial single-request campaigns without dropping samples."""
import json,time
from xolotl_trial_common import BASE

names=['single-current-split-conf045-final','single-current-split-conf020']
rs=[json.loads((BASE/('xolotl-'+n+'-latest.json')).read_text(encoding='utf-8'))['result.json'] for n in names]
for r in rs:
 if r['phase']!='complete' or r['engine_exit']!=0 or not r['engine_reaped'] or len(r['requests'])!=17:raise RuntimeError('complete/reaped 17-request campaign required')
 if r['plan']['visible_devices']!='0':raise RuntimeError('not a single-visible-device experiment')
plans=[{k:v for k,v in r['plan'].items() if k!='draft_confidence'} for r in rs]
if plans[0]!=plans[1]:raise RuntimeError('paired plans differ beyond confidence')
def measure(qs):
 n=sum(len(q['tokens'])-1 for q in qs)
 d=sum(q['tokens'][-1]['seconds']-q['tokens'][0]['seconds'] for q in qs)
 return dict(samples=len(qs),tokens_after_first=n,decode_seconds=d,tok_s=n/d,min_tok_s=min(q['selected_id_decode_tok_s'] for q in qs),max_tok_s=max(q['selected_id_decode_tok_s'] for q in qs))
rows=[]
for name,r in zip(names,rs):
 qs=[q for q in r['requests'] if q['role']=='measured']
 rows.append(dict(mode=name,confidence=r['plan']['draft_confidence'],mixed=measure(qs),per_case={case:measure([q for q in qs if q['case']==case]) for case in dict.fromkeys(q['case'] for q in qs)}))
parity=[]
for a,b in zip(rs[0]['requests'],rs[1]['requests']):
 if (a['case'],a['role'])!=(b['case'],b['role']):raise RuntimeError('request alignment changed')
 parity.append(dict(case=a['case'],role=a['role'],token_ids_identical=[t['id'] for t in a['tokens']]==[t['id'] for t in b['tokens']]))
out=dict(unix=time.time(),target_tok_s=300,target_met=False,rows=rows,delta_percent=(rows[1]['mixed']['tok_s']/rows[0]['mixed']['tok_s']-1)*100,paired_request_ids=parity,all_17_requests_identical=all(q['token_ids_identical'] for q in parity),adopted=False,qualification_scope='one sequential candidate/control pair; no broad quality or stable speedup claim')
(BASE/'xolotl-conf300-round-comparison.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))
