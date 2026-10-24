import ast
from xolotl_trial_common import BASE
new=['single-current-q8-control','single-current-q8-mmq']
for name in ['launch_xolotl_protocol_trial.py','observe_xolotl_protocol_trial.py']:
 p=BASE/name;s=p.read_text();anchor="'single-current-split-r4-b3']";replacement="'single-current-split-r4-b3',"+','.join(repr(n) for n in new)+']'
 if s.count(anchor)==1:s=s.replace(anchor,replacement)
 elif s.count(replacement)!=1:raise RuntimeError('Q8 choice anchor differs')
 if name.startswith('launch') and "if args.mode.startswith('single-current-q8-'):" not in s:
  anchor='record=dict(unix=time.time(),mode=args.mode,'
  branch='''if args.mode.startswith('single-current-q8-'):
 q8_controls=json.loads((BASE/'xolotl-q8-v2-hardware-controls.json').read_text()).get('q8-controls-result.json',{})
 q8_build=json.loads((BASE/'xolotl-q8-v2-build-latest.json').read_text())['build-result.json']
 if not q8_controls.get('passed') or q8_build['phase']!='built':raise RuntimeError('Q8 paired hardware controls must pass before model launch')
 q8_intent=json.loads((BASE/'xolotl-h200-q8-v2-build-intent.json').read_text())
 stage['root']=q8_intent['root']
 plan.update(binary=q8_build['binaries']['ds41_generate']['path'],binary_sha256=q8_build['binaries']['ds41_generate']['sha256'],graph_metadata_mib=1024,split_mmvq='11',ptq_rows_per_warp=4,max_trial_seconds=900,q8_mmq=args.mode=='single-current-q8-mmq')
'''
  if s.count(anchor)!=1:raise RuntimeError('Q8 plan anchor differs')
  s=s.replace(anchor,branch+anchor)
 ast.parse(s);p.write_text(s)
worker=(BASE/'xolotl_protocol_trial_worker.py').read_text();anchor="    if 'split_mmvq' in PLAN:"
if "ASTER_H200_Q8_MMQ" not in worker:
 if worker.count(anchor)!=1:raise RuntimeError('Q8 worker env anchor differs')
 worker=worker.replace(anchor,"    if 'q8_mmq' in PLAN:\n        if type(PLAN['q8_mmq']) is not bool:raise RuntimeError('Q8 MMQ must be a boolean')\n        env['ASTER_H200_Q8_MMQ']='1' if PLAN['q8_mmq'] else '0'\n"+anchor)
 ast.parse(worker);(BASE/'xolotl_protocol_trial_worker.py').write_text(worker)
print('prepared Q8 control/candidate profiles; both retain qualified expert hybrid, require numerical controls')
