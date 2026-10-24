"""Predeclare three pairs and a conservative noise gate for a1.35% first result."""
import ast,json,time
from xolotl_trial_common import BASE
profiles={'single-current-qsum-v2-gu-b2':'gu','single-current-qsum-v2-control-b2':'0','single-current-qsum-v2-control-b3':'0','single-current-qsum-v2-gu-b3':'gu'}
for source,dest in [('launch_xolotl_qsum_v2_model_trial.frozen.py','launch_xolotl_qsum_v2_repeat.frozen.py'),('observe_xolotl_qsum_v2_model_trial.frozen.py','observe_xolotl_qsum_v2_repeat.frozen.py')]:
 p=BASE/dest
 if p.exists():raise RuntimeError('repeat operator already frozen')
 s=(BASE/source).read_text();a=s.index('choices=[');b=s.index('],required=True',a)+1 if source.startswith('launch') else s.index(']);p.add_argument',a)+1;s=s[:a]+'choices='+repr(list(profiles))+s[b:]
 if source.startswith('launch'):
  a=s.index('\nprofiles={')+1;b=s.index('\nmc=',a);s=s[:a]+'profiles='+repr(profiles)+s[b:]
 ast.parse(s);p.write_text(s)
campaign=dict(unix=time.time(),reason='First V2 GU pair is+1.3455%, below a stable improvement claim; repeated paired trials are required',order=['single-current-qsum-v2-control','single-current-qsum-v2-gu','single-current-qsum-v2-gu-b2','single-current-qsum-v2-control-b2','single-current-qsum-v2-control-b3','single-current-qsum-v2-gu-b3'],pairs=[['single-current-qsum-v2-control','single-current-qsum-v2-gu'],['single-current-qsum-v2-control-b2','single-current-qsum-v2-gu-b2'],['single-current-qsum-v2-control-b3','single-current-qsum-v2-gu-b3']],gate=dict(three_complete_pairs=True,requests_per_trial=17,all51_paired_output_sequences_equal=True,every_pair_mixed_gain_positive=True,pooled_gain_at_least_percent=2.0),milestone300_met=False,goal500_met=False,adopted=False)
(BASE/'xolotl-qsum-v2-repeat-campaign.json').write_text(json.dumps(campaign,indent=2)+'\n');print('Frozen ABBAAB order and three-pair numerical/timing gates before launching any repeat.')
