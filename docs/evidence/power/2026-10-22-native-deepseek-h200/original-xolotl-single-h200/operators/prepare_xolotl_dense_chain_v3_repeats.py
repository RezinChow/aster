"""Predeclare ABBAAB repeat gates for the small first V3 scheduling result."""
import ast,json,time
from xolotl_trial_common import BASE
names=['single-current-dense-chain-v3-candidate-b2','single-current-dense-chain-v3-control-b2','single-current-dense-chain-v3-control-b3','single-current-dense-chain-v3-candidate-b3'];profiles={n:dict(dense_async_chain='candidate' in n,chain_stress=False) for n in names}
first=['single-current-dense-chain-v3-control','single-current-dense-chain-v3-candidate']
if (BASE/'xolotl-dense-chain-v3-repeat-campaign.json').exists():raise RuntimeError('dense repeat campaign already frozen')
for kind in ['launch','observe']:
 src=BASE/(kind+'_xolotl_dense_chain_v3_trial.frozen.py');target=BASE/(kind+'_xolotl_dense_chain_v3_repeat.frozen.py');s=src.read_text();a=s.index('choices=[');b=s.index('],required=True',a)+1 if kind=='launch' else s.index(']);p.add_argument',a)+1;s=s[:a]+'choices='+repr(names)+s[b:]
 if kind=='launch':a=s.index('\nprofiles={')+1;b=s.index('\nmc=',a);s=s[:a]+'profiles='+repr(profiles)+s[b:]
 ast.parse(s);target.write_text(s)
s=(BASE/'inspect_xolotl_dense_chain_v3_runtime.py').read_text();a=s.index('choices=[');b=s.index(']);a=p.parse_args()',a)+1;s=s[:a]+'choices='+repr(first+names)+s[b:];ast.parse(s);(BASE/'inspect_xolotl_dense_chain_v3_repeat_runtime.py').write_text(s)
c=dict(unix=time.time(),reason='First V3 pair+1.55597% with all17 outputs equal; repeat before claiming stable improvement',allocation_uid='b226d64c-28cc-4f38-94d0-a02688df6133',order=first+names,pairs=[first,[names[1],names[0]],[names[2],names[3]]],gate=dict(three_complete_pairs=True,requests_per_trial=17,all51_paired_output_sequences_equal=True,every_pair_mixed_gain_positive=True,pooled_gain_at_least_percent=2.0),milestone300_met=False,goal500_met=False,adopted=False)
(BASE/'xolotl-dense-chain-v3-repeat-campaign.json').write_text(json.dumps(c,indent=2)+'\n')
s=(BASE/'compare_xolotl_qsum_v2_repeats.py').read_text().replace('xolotl-qsum-v2-repeat','xolotl-dense-chain-v3-repeat')
a="  if p.pop('ptq_qsum')!=['0','gu'][i]:raise RuntimeError('repeat qsum state differs')"
if s.count(a)!=1:raise RuntimeError('repeat scheduling flag comparison anchor differs')
s=s.replace(a,"  if p.pop('dense_async_chain')!=[False,True][i]:raise RuntimeError('repeat dense scheduling state differs')\n  proof=json.loads((BASE/('xolotl-'+names[i]+'-runtime.json')).read_text())\n  if not proof['passed'] or proof['first_deferred_finish_logs']!=i:raise RuntimeError('repeat actual scheduling-path proof differs')")
s=s.replace('explicit qsum flag','explicit asynchronous dense-chain flag');ast.parse(s);(BASE/'compare_xolotl_dense_chain_v3_repeats.py').write_text(s)
s=(BASE/'run_xolotl_qsum_v2_repeats.py').read_text().replace('xolotl-qsum-v2-repeat','xolotl-dense-chain-v3-repeat').replace('662c0a01-26eb-4e72-9d39-2e07ef2619c0','b226d64c-28cc-4f38-94d0-a02688df6133').replace('launch_xolotl_qsum_v2_repeat.frozen.py','launch_xolotl_dense_chain_v3_repeat.frozen.py').replace('observe_xolotl_qsum_v2_repeat.frozen.py','observe_xolotl_dense_chain_v3_repeat.frozen.py').replace('compare_xolotl_qsum_v2_repeats.py','compare_xolotl_dense_chain_v3_repeats.py')
a="    require_complete(mode);state['completed'].append(mode);save();break"
if s.count(a)!=1:raise RuntimeError('repeat cleanup/runtime gate anchor differs')
s=s.replace(a,"    require_complete(mode);command('inspect_xolotl_dense_chain_v3_repeat_runtime.py',['--mode',mode]);state['completed'].append(mode);save();break")
ast.parse(s);(BASE/'run_xolotl_dense_chain_v3_repeats.py').write_text(s)
print('Frozen three-pair ABBAAB campaign, exact path/output identity, each-pair-positive and pooled2percent gate')
