"""All samples retained, three alternating pairs, exact output token comparisons."""
import json
from xolotl_trial_common import BASE
pairs=[('single-current-split-control-b2','single-current-split-hybrid'),('single-current-split-control-b3','single-current-split-hybrid-b2'),('single-current-split-control-b4','single-current-split-hybrid-b3')]
names=['single-current-split-control','single-current-split-both']+[n for pair in pairs for n in pair]
def metric(qs):
 n=sum(len(q['tokens'])-1 for q in qs)
 d=sum(q['tokens'][-1]['seconds']-q['tokens'][0]['seconds'] for q in qs)
 return n/d
results={};out=dict(phase='partial',goal_complete=False,target_single_request_decode_tok_s=500,profiles={},pairs=[],limits='Serial single-request N-1 token arrival intervals; one warmup and three measured requests per case, all samples/outliers retained. Three alternating independent process pairs when complete. Prefixes reused, completions recomputed. Actual context4096.')
for name in names:
 path=BASE/('xolotl-'+name+'-latest.json')
 if not path.exists():continue
 r=json.loads(path.read_text(encoding='utf-8')).get('result.json',{})
 if r.get('phase')!='complete':continue
 if not r.get('engine_reaped') or r['engine_exit']!=0 or len(r['requests'])!=17:raise RuntimeError('incomplete trial cannot qualify')
 results[name]=r;qs=[q for q in r['requests'] if q['role']=='measured'];cases={}
 for q in qs:cases.setdefault(q['case'],[]).append(q)
 out['profiles'][name]=dict(weighted_decode_tok_s=metric(qs),per_case={k:dict(weighted_decode_tok_s=metric(v),samples=[q['selected_id_decode_tok_s'] for q in v]) for k,v in cases.items()},binary_sha256=r['plan']['binary_sha256'],engine_reaped=True)
def compare(a,b):
 for field in ['binary_sha256','model_sha256','rank','sidecar','engram','visible_devices','draft_depth','d3_prefetch','draft_confidence','graph_metadata_mib','arena_gib','campaign','cases']:
  if a['plan'][field]!=b['plan'][field]:raise RuntimeError('comparison field differs: '+field)
 parity=[]
 for x,y in zip(a['requests'],b['requests']):
  if (x['case'],x['role'],x['prompt_tokens'])!=(y['case'],y['role'],y['prompt_tokens']):raise RuntimeError('request order differs')
  parity.append([t['id'] for t in x['tokens']]==[t['id'] for t in y['tokens']])
 return parity
if names[0] in results:
 for name,r in results.items():
  parity=compare(results[names[0]],r);out['profiles'][name].update(exact_request_id_parity=parity,all_request_id_parity=all(parity))
for a,b in pairs:
 if a in results and b in results:
  x,y=out['profiles'][a],out['profiles'][b]
  out['pairs'].append(dict(control=a,candidate=b,weighted_gain_percent=100*(y['weighted_decode_tok_s']/x['weighted_decode_tok_s']-1),per_case_gain_percent={k:100*(y['per_case'][k]['weighted_decode_tok_s']/v['weighted_decode_tok_s']-1) for k,v in x['per_case'].items()},all_request_id_parity=all(compare(results[a],results[b]))))
if len(out['pairs'])==3:
 out['phase']='complete'
 for label,index in [('control',0),('hybrid',1)]:
  qs=[q for pair in pairs for q in results[pair[index]]['requests'] if q['role']=='measured'];cases={}
  for q in qs:cases.setdefault(q['case'],[]).append(q)
  out[label+'_pooled_serial']=dict(weighted_decode_tok_s=metric(qs),per_case={k:dict(weighted_decode_tok_s=metric(v),min_decode_tok_s=min(q['selected_id_decode_tok_s'] for q in v),max_decode_tok_s=max(q['selected_id_decode_tok_s'] for q in v),samples=len(v)) for k,v in cases.items()})
 out['pooled_gain_percent']=100*(out['hybrid_pooled_serial']['weighted_decode_tok_s']/out['control_pooled_serial']['weighted_decode_tok_s']-1)
out['default_promoted']=False
(BASE/'xolotl-split-round-comparison.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:v for k,v in out.items() if k!='profiles'}|dict(profile_rates={k:v['weighted_decode_tok_s'] for k,v in out['profiles'].items()}),indent=2))
