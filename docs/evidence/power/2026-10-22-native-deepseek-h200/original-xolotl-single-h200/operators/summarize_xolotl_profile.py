"""Read-only analysis; API waiting and GPU busy union are kept distinct."""
import json
from xolotl_trial_common import BASE,jump
r=json.loads((BASE/'xolotl-single-current-profile-prose-v2-intent.json').read_text())
code='''from pathlib import Path
import json,sqlite3,csv,collections
root=Path(@ROOT@);p=root/'warm-prose.sqlite'
if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>512*1024**2:raise RuntimeError('SQLite bounds differ')
c=sqlite3.connect(p.as_uri()+'?mode=ro',uri=True)
if c.execute('pragma quick_check').fetchone()[0]!='ok':raise RuntimeError('SQLite integrity refused')
tables={x[0] for x in c.execute("select name from sqlite_master where type='table'")}
rows=[];counts={};sums={}
for t in ['CUPTI_ACTIVITY_KIND_KERNEL','CUPTI_ACTIVITY_KIND_MEMCPY','CUPTI_ACTIVITY_KIND_MEMSET']:
 if t not in tables:continue
 v=c.execute('select start,end,deviceId from '+t).fetchall()
 if len(v)>1000000:raise RuntimeError('timeline event bound exceeded')
 if any(d!=0 for _,_,d in v):raise RuntimeError('nonzero GPU in single-device capture')
 rows.extend((a,b) for a,b,_ in v);counts[t]=len(v);sums[t]=sum(b-a for a,b,_ in v)
rows.sort();merged=[]
for a,b in rows:
 if merged and a<=merged[-1][1]:merged[-1][1]=max(b,merged[-1][1])
 else:merged.append([a,b])
busy=sum(b-a for a,b in merged);span=rows[-1][1]-rows[0][0]
kernel=c.execute('select k.start,k.end,s.value from CUPTI_ACTIVITY_KIND_KERNEL k join StringIds s on k.demangledName=s.id').fetchall()
groups=collections.defaultdict(lambda:[0,0])
for a,b,n in kernel:
 if 'native_gu_' in n or 'native_down_' in n:g='routed-expert-gu-down'
 elif 'mul_mat_vec_q' in n or 'mul_mat_q<' in n:g='ggml-quantized-matmul'
 elif 'quantize' in n:g='activation-quantize'
 elif 'flash_attn' in n or 'lightning_indexer' in n:g='attention-indexer'
 else:g='other-gpu-kernels'
 groups[g][0]+=1;groups[g][1]+=b-a
out=dict(schema='aster-xolotl-diagnostic-profile-v1',diagnostic_only=True,trace='warm-prose.nsys-rep',sqlite_integrity='ok',gpu_ids=[0],gpu_event_counts=counts,gpu_time_sum_ns=sums,gpu_busy_union_ns=busy,gpu_event_span_ns=span,gpu_busy_fraction_of_event_span=busy/span,event_span_limit='First GPU operation to final GPU operation, not host idle capture padding; profiler overhead included',kernel_groups={k:dict(count=v[0],sum_ns=v[1]) for k,v in groups.items()},cuda_api=list(csv.DictReader((root/'statistics_cuda_api_sum.csv').open())),kernel_top=list(csv.DictReader((root/'statistics_cuda_gpu_kern_sum.csv').open()))[:12],mem_time=list(csv.DictReader((root/'statistics_cuda_gpu_mem_time_sum.csv').open())),mem_size=list(csv.DictReader((root/'statistics_cuda_gpu_mem_size_sum.csv').open())),diagnostics=c.execute('select text from DIAGNOSTIC_EVENT').fetchall(),export_note='nsys stats created and used SQLite successfully; subsequent redundant export refused existing file; no overwrite or reprofile')
print(json.dumps(out))
'''.replace('@ROOT@',repr(r['root']))
v=jump(code)
v['capture_limit']='Nsight 2025.3.1 reports driver 13.2 unsupported (uses 12.9 libraries), and not all CUDA events might be collected. Counts, kernel sums and busy union describe recorded events only; busy fraction is not an exact hardware utilization estimate.'
(BASE/'xolotl-profile-summary.json').write_text(json.dumps(v,indent=2)+'\n')
print(json.dumps({k:v for k,v in v.items() if k not in ['cuda_api','kernel_top']},indent=2))
