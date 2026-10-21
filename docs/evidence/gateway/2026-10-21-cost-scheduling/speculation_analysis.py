"""Independent analysis of retained payloads, including the failed collector.

The labelled-metric KeyError remains failed. Per-response native draft counts
were retained before it and are sufficient for separate, explicitly scoped
draft/latency observations; no missing counter is silently replaced by zero.
"""
import json
import statistics
from runtime import BASE,save

raw=json.loads((BASE/'speculation-decision.json').read_text())['profiles']
baseline=raw[0];summary=[]
for profile in raw:
    rows=profile['records']+profile.get('parallel',[])
    medians={name:statistics.median(row['seconds'] for row in rows if row['key'].startswith(name+'-')) for name in ['code','ordinal','repetitive','tool','long-cold','long-warm']}
    if profile['mode']=='none':base_medians=medians
    draft=[row for row in rows if 'draft_n' in row['timings']]
    expected={row['key']:row['payload_sha256'] for row in baseline['records']+baseline['parallel']}
    parity=all(row['payload_sha256']==expected[row['key']] for row in rows)
    summary.append({'mode':profile['mode'],'original_collector_passed':profile['passed'],'collector_error':profile.get('error'),
        'retained_rows':len(rows),'payload_parity_against_baseline':parity,'medians_seconds':medians,
        'ratios':{name:medians[name]/base_medians[name] for name in medians},
        'native_response_drafted_tokens':sum(row['timings']['draft_n'] for row in draft),
        'native_response_accepted_tokens':sum(row['timings']['draft_n_accepted'] for row in draft),
        'response_draft_counts_available':len(draft),'first_unseen_code_draft_tokens':rows[0]['timings'].get('draft_n')})
save('speculation-independent-analysis.json',{'profiles':summary,'production_speculation':'none',
    'not_claimed':'Original labelled-metric aggregation passed, authenticated cross-caller speculation isolation, representative general-code speedup, or a promoted speculative profile.'})
print(json.dumps(summary,indent=2))
