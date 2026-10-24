import ast
from xolotl_trial_common import BASE
for name in ['launch_xolotl_protocol_trial.py','observe_xolotl_protocol_trial.py']:
 p=BASE/name;s=p.read_text();anchor="'single-current-warm-cache1024-r4']"
 replacement="'single-current-warm-cache1024-r4','single-current-split-control','single-current-split-both']"
 if s.count(anchor)==1:s=s.replace(anchor,replacement)
 elif s.count(replacement)!=1:raise RuntimeError('split choice anchor differs')
 if name.startswith('launch') and "if args.mode.startswith('single-current-split-'):" not in s:
  anchor='record=dict(unix=time.time(),mode=args.mode,'
  if s.count(anchor)!=1:raise RuntimeError('split plan anchor differs')
  branch='''if args.mode.startswith('single-current-split-'):
 split_controls=json.loads((BASE/'xolotl-split-build-hardware-controls.json').read_text()).get('controls-result.json',{})
 split_build=json.loads((BASE/'xolotl-split-build-latest.json').read_text())['build-result.json']
 if not split_controls.get('passed') or split_build['phase']!='built':raise RuntimeError('split kernel hardware controls must pass before model launch')
 split_intent=json.loads((BASE/'xolotl-h200-split-build-intent.json').read_text())
 stage['root']=split_intent['root']
 plan.update(binary=split_build['binaries']['ds41_generate']['path'],binary_sha256=split_build['binaries']['ds41_generate']['sha256'],graph_metadata_mib=1024,split_mmvq='both' if args.mode.endswith('-both') else '0')
'''
  s=s.replace(anchor,branch+anchor)
 ast.parse(s);p.write_text(s)
print('prepared closed split control and both profiles; hardware qualification required')
