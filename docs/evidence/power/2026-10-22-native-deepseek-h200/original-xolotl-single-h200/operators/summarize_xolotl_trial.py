"""Decode actual IDs and preserve every serial sample, including cold runs."""
import argparse,json
from pathlib import Path
from tokenizers import Tokenizer
BASE=Path('D:/code/aster/target/h200-native')
p=argparse.ArgumentParser();p.add_argument('--mode',required=True);a=p.parse_args()
v=json.loads((BASE/('xolotl-'+a.mode+'-latest.json')).read_text(encoding='utf-8'));r=v['result.json']
t=Tokenizer.from_file(str(BASE/'xolotl-official-tokenizer.json'))
measured=[];rows=[]
for q in r['requests']:
 ids=[x['id'] for x in q['tokens']]
 text=t.decode(ids,skip_special_tokens=True)
 row=dict(case=q['case'],role=q['role'],tokens=len(ids),decode_tok_s=q['selected_id_decode_tok_s'],text=text,ttft_seconds=q['ttft_seconds'],request_seconds=q['request_seconds'])
 if q['role']=='measured':measured.append(q)
 rows.append(row)
num=sum(max(0,len(q['tokens'])-1) for q in measured)
den=sum(q['tokens'][-1]['seconds']-q['tokens'][0]['seconds'] for q in measured)
gpus={}
for s in r.get('telemetry',[]):
 for line in s['stdout'].splitlines():
  x=[p.strip() for p in line.split(',')]
  if len(x)!=5:continue
  g=gpus.setdefault(x[1],dict(index=int(x[0]),max_memory_mib=0,max_utilization_percent=0))
  g['max_memory_mib']=max(g['max_memory_mib'],int(x[3]));g['max_utilization_percent']=max(g['max_utilization_percent'],int(x[2]))
summary=dict(mode=a.mode,phase=r['phase'],ready_line=r.get('ready_line'),single_request_weighted_decode_tok_s=num/den if den>0 else None,all_samples=rows,gpu_peaks=gpus,engine_exit=r.get('engine_exit'),engine_reaped=r.get('engine_reaped'),single_request_1000_met=False)
per_case={}
for q in measured:per_case.setdefault(q['case'],[]).append(q)
summary['per_case']={}
for name,qs in per_case.items():
 n=sum(len(q['tokens'])-1 for q in qs)
 d=sum(q['tokens'][-1]['seconds']-q['tokens'][0]['seconds'] for q in qs)
 summary['per_case'][name]=dict(samples=len(qs),weighted_decode_tok_s=n/d,min_decode_tok_s=min(q['selected_id_decode_tok_s'] for q in qs),max_decode_tok_s=max(q['selected_id_decode_tok_s'] for q in qs),measured_ids_identical=all([x['id'] for x in q['tokens']]==[x['id'] for x in qs[0]['tokens']] for q in qs))
milestone=BASE/'xolotl-current-milestone.json'
summary['target_single_gpu_decode_tok_s']=json.loads(milestone.read_text(encoding='utf-8'))['target_single_gpu_single_request_decode_tok_s'] if milestone.exists() else 500
summary['all_measured_cases_min_300']=bool(per_case) and all(v['min_decode_tok_s']>=300 for v in summary['per_case'].values())
summary['all_measured_cases_min_100']=bool(per_case) and all(v['min_decode_tok_s']>=100 for v in summary['per_case'].values())
summary['all_measured_cases_min_500']=bool(per_case) and all(v['min_decode_tok_s']>=500 for v in summary['per_case'].values())
(BASE/('xolotl-'+a.mode+'-summary.json')).write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False,indent=2))
