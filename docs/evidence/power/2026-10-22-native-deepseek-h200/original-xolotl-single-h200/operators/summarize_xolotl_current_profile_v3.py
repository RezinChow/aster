"""Report exact symbol timings and recorded GPU busy union; no utilization ceiling claim."""
import json
from xolotl_trial_common import BASE,jump
r=json.loads((BASE/'xolotl-single-current-qsum-v2-profile-intent.json').read_text())
code='''from pathlib import Path
import json,sqlite3,csv
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('profile summary owner differs')
stats=json.loads((root/'statistics-result.json').read_text())
if stats['phase']!='complete' or stats['sqlite_integrity']!='ok':raise RuntimeError('statistics must complete with valid SQLite')
p=root/'warm-prose.sqlite'
if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>512*1024**2:raise RuntimeError('profile SQLite bound differs')
c=sqlite3.connect(p.as_uri()+'?mode=ro',uri=True)
tables={x[0] for x in c.execute("select name from sqlite_master where type='table'")}
if not {'CUPTI_ACTIVITY_KIND_KERNEL','StringIds','DIAGNOSTIC_EVENT'}.issubset(tables):raise RuntimeError('required profiler schema differs')
rows=[];counts={};sums={}
for t in ['CUPTI_ACTIVITY_KIND_KERNEL','CUPTI_ACTIVITY_KIND_MEMCPY','CUPTI_ACTIVITY_KIND_MEMSET']:
 if t not in tables:continue
 if c.execute('select count(*) from '+t).fetchone()[0]>1000000:raise RuntimeError('timeline event bound exceeded')
 v=c.execute('select start,end,deviceId from '+t).fetchall()
 if any(d!=0 or b<a for a,b,d in v):raise RuntimeError('single-device timeline or event span differs')
 rows.extend((a,b) for a,b,_ in v);counts[t]=len(v);sums[t]=sum(b-a for a,b,_ in v)
if not rows:raise RuntimeError('no captured GPU activity')
rows.sort();merged=[]
for a,b in rows:
 if merged and a<=merged[-1][1]:merged[-1][1]=max(b,merged[-1][1])
 else:merged.append([a,b])
busy=sum(b-a for a,b in merged);span=rows[-1][1]-rows[0][0]
top=c.execute('select s.value,count(*),sum(k.end-k.start) from CUPTI_ACTIVITY_KIND_KERNEL k join StringIds s on k.demangledName=s.id group by s.value order by sum(k.end-k.start) desc limit 30').fetchall()
def csv_rows(name):
 p=root/name
 if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>2*1024**2:raise RuntimeError('statistics CSV bound differs')
 return list(csv.DictReader(p.open()))
out=dict(diagnostic_only=True,statistics=stats,gpu_ids=[0],event_counts=counts,time_sum_ns=sums,busy_union_ns=busy,event_span_ns=span,busy_fraction_of_recorded_span=busy/span,exact_kernel_symbols=[dict(symbol=n,count=k,time_ns=t) for n,k,t in top],cuda_api=csv_rows('statistics_cuda_api_sum.csv'),mem_time=csv_rows('statistics_cuda_gpu_mem_time_sum.csv'),mem_size=csv_rows('statistics_cuda_gpu_mem_size_sum.csv'),diagnostics=c.execute('select text from DIAGNOSTIC_EVENT').fetchall(),limits='Recorded events only; Nsight/driver warnings apply. API waits overlap GPU work and must not be added to GPU time. Capture overhead is included; busy fraction is not exact hardware utilization or a single-H200 speed ceiling.')
print(json.dumps(out))
'''.replace('@ROOT@',repr(r['root']))
v=jump(code);(BASE/'xolotl-current-profile-v3-summary.json').write_text(json.dumps(v,indent=2)+'\n');print(json.dumps(v,indent=2))
