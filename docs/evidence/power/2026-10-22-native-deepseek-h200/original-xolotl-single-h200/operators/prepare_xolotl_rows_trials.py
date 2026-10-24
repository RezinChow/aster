"""Extend only the closed operator profiles; retain frozen historical workers."""
import ast
from xolotl_trial_common import BASE
for name in ['launch_xolotl_protocol_trial.py','observe_xolotl_protocol_trial.py']:
 p=BASE/name;s=p.read_text();anchor="'single-current-profile-prose-v2']"
 replacement="'single-current-profile-prose-v2','single-current-warm-cache1024-r2','single-current-warm-cache1024-r4']"
 if s.count(anchor)==1:s=s.replace(anchor,replacement)
 elif s.count(replacement)!=1:raise RuntimeError('operator choice anchor differs')
 if name.startswith('launch'):
  anchor="record=dict(unix=time.time(),mode=args.mode,"
  line="if args.mode.endswith(('-r2','-r4')):plan['expert_rows_per_warp']=2 if args.mode.endswith('-r2') else 4\n"
  if line not in s:
   if s.count(anchor)!=1:raise RuntimeError('operator plan anchor differs')
   s=s.replace(anchor,line+anchor)
 ast.parse(s);p.write_text(s)
print('prepared closed R2/R4 PTQ1_0 and Q3_K trials; Q2_0 keeps control layout')
