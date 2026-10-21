import json
import math
import statistics
from runtime import BASE, save

rows=json.loads((BASE/'ordinary-load.json').read_text())['records']
summary={}
for label in ['control','candidate']:
    summary[label]={}
    for concurrency in [1,8,16,32]:
        group=[row for row in rows if row['case'].startswith(label+'-') and int(row['case'].split('-')[2])==concurrency]
        success=[row for row in group if row['status']==200]
        values=sorted(row['completion_seconds'] for row in success)
        summary[label][str(concurrency)]={'success':len(success),'refused':len(group)-len(success),'median_seconds':statistics.median(values),
            'p95_seconds':values[math.ceil(.95*len(values))-1]}
summary['ratios']={str(concurrency):summary['candidate'][str(concurrency)]['p95_seconds']/summary['control'][str(concurrency)]['p95_seconds'] for concurrency in [1,8,16,32]}
summary['all_within_ten_percent']=all(summary['ratios'][str(concurrency)]<=1.10 for concurrency in [1,8,16])
save('ordinary-load-summary.json',summary)
print(json.dumps(summary,indent=2))
