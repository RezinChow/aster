import ast
from xolotl_trial_common import BASE
new=['single-current-split-hybrid','single-current-split-control-b2','single-current-split-control-b3','single-current-split-control-b4','single-current-split-hybrid-b2','single-current-split-hybrid-b3','single-current-split-r4','single-current-split-r4-b2','single-current-split-r4-b3']
for name in ['launch_xolotl_protocol_trial.py','observe_xolotl_protocol_trial.py']:
 p=BASE/name;s=p.read_text();anchor="'single-current-split-both']"
 replacement="'single-current-split-both',"+','.join(repr(n) for n in new)+']'
 if s.count(anchor)==1:s=s.replace(anchor,replacement)
 elif s.count(replacement)!=1:raise RuntimeError('hybrid choice anchor differs')
 if name.startswith('launch'):
  anchor='record=dict(unix=time.time(),mode=args.mode,'
  branch='''hybrid_profiles={'single-current-split-hybrid','single-current-split-hybrid-b2','single-current-split-hybrid-b3'}
r4_profiles={'single-current-split-r4','single-current-split-r4-b2','single-current-split-r4-b3'}
if args.mode in hybrid_profiles:plan.update(split_mmvq='11',ptq_rows_per_warp=4)
if args.mode in r4_profiles:plan.update(split_mmvq='0',expert_rows_per_warp=4)
'''
  if 'hybrid_profiles=' not in s:
   if s.count(anchor)!=1:raise RuntimeError('hybrid plan anchor differs')
   s=s.replace(anchor,branch+anchor)
 ast.parse(s);p.write_text(s)
print('prepared closed hybrid / R4 / alternating control profiles')
