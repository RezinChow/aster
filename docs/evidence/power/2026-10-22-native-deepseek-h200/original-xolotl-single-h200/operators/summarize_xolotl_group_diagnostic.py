"""Summarize the process-wide executed PTQ groups, without claiming token performance."""
import json,time
from xolotl_trial_common import BASE
r=json.loads((BASE/'xolotl-single-current-mma-v3-diagnostic-latest.json').read_text(encoding='utf-8'))['result.json']
if r.get('phase')!='complete' or r.get('engine_exit')!=0 or not r.get('engine_reaped') or len(r['requests'])!=17 or r['plan'].get('diagnostic_only') is not True:raise RuntimeError('completed diagnostic-only process is required')
inspection=json.loads((BASE/'xolotl-mma-v3-runtime-inspection.json').read_text());lines=inspection['histogram_lines']
if len(lines)!=1 or not lines[0].startswith('ASTER_MMA_GROUPS '):raise RuntimeError('exact live GPU histogram is missing')
h=json.loads(lines[0][len('ASTER_MMA_GROUPS '):]);bins=h['groups'];entries=h['entries']
if len(bins)!=9 or any(type(v) is not int or v<0 for v in bins) or type(entries) is not int or entries<sum(i*bins[i] for i in range(9)) or sum(bins)==0:raise RuntimeError('GPU histogram bounds/semantics differ')
small_groups=sum(bins[:4]);total_groups=sum(bins);small_entries=sum(i*bins[i] for i in range(4))
control=json.loads((BASE/'xolotl-single-current-mma-v2-control-latest.json').read_text(encoding='utf-8'))['result.json']
same=all((a['case'],a['role'],[t['id'] for t in a['tokens']])==(b['case'],b['role'],[t['id'] for t in b['tokens']]) for a,b in zip(control['requests'],r['requests']))
out=dict(unix=time.time(),scope='process-wide actual GPU execution of eligible type143,5120x2304,R4,no-LoRA groups; includes startup/prompt/decode; bin8 means8or more, not exclusive decode distribution',diagnostic_only=True,performance_claimed=False,binary=r['plan']['binary_sha256'],groups=bins,entries=entries,total_logical_groups=total_groups,groups_below4=small_groups,groups_below4_percent=100*small_groups/total_groups,entries_in_groups_below4=small_entries,entries_in_groups_below4_percent=100*small_entries/entries,all_17_output_pairs_equal=bool(len(control['requests'])==17 and same),no_target_300_or_500_claim=True)
(BASE/'xolotl-mma-v3-group-diagnostic.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
