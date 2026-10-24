"""Prepare independent default-off row2/row4 full-generation comparisons."""
import ast
from xolotl_trial_common import BASE
modes=['single-current-rows-control','single-current-rows-r2','single-current-rows-control-b2','single-current-rows-r4']
for name in ['launch_xolotl_protocol_trial.py','observe_xolotl_protocol_trial.py']:
 p=BASE/name;s=p.read_text();tree=ast.parse(s)
 calls=[n for n in ast.walk(tree) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr=='add_argument' and n.args and isinstance(n.args[0],ast.Constant) and n.args[0].value=='--mode']
 if len(calls)!=1:raise RuntimeError('row mode parser differs')
 choices=[k.value for k in calls[0].keywords if k.arg=='choices']
 if len(choices)!=1:raise RuntimeError('row choices differ')
 old=ast.get_source_segment(s,choices[0]);values=ast.literal_eval(choices[0])
 if any(mode in values for mode in modes) or s.count(old)!=1:raise RuntimeError('row choices already prepared or ambiguous')
 s=s.replace(old,repr(values+modes))
 if name.startswith('launch'):
  anchor='record=dict(unix=time.time(),mode=args.mode,'
  branch='''if args.mode.startswith('single-current-rows-'):
 plan.pop('expert_rows_per_warp',None)
 rc=json.loads((BASE/'xolotl-split-rows-hardware-controls.json').read_text()).get('controls-result.json',{})
 rb=json.loads((BASE/'xolotl-split-rows-build-latest.json').read_text())['build-result.json']
 if not rc.get('passed') or len(rc.get('row_controls',[]))!=2 or len(rc.get('additional_controls',[]))!=2 or rb['phase']!='built':raise RuntimeError('both row2/4 and dense GPU controls must pass before generation')
 ri=json.loads((BASE/'xolotl-h200-split-rows-build-intent.json').read_text());stage['root']=ri['root']
 rows=2 if args.mode=='single-current-rows-r2' else 4 if args.mode=='single-current-rows-r4' else 0
 plan.update(binary=rb['binaries']['ds41_generate']['path'],binary_sha256=rb['binaries']['ds41_generate']['sha256'],graph_metadata_mib=1024,split_mmvq='both' if rows else '11',ptq_rows_per_warp=0 if rows else 4,max_trial_seconds=600,device_verify=False,split_rows=rows)
'''
  if s.count(anchor)!=1:raise RuntimeError('row plan anchor differs')
  s=s.replace(anchor,branch+anchor)
 ast.parse(s);p.write_text(s)
p=BASE/'xolotl_protocol_trial_worker.py';s=p.read_text();anchor="    if 'device_verify' in PLAN:"
branch='''    if 'split_rows' in PLAN:
        rows=PLAN['split_rows']
        if type(rows) is not int or rows not in (0,2,4):raise RuntimeError('split rows must be 0, 2 or 4')
        env['ASTER_XQ_SPLIT_ROWS']=str(rows)
'''
if s.count(anchor)!=1:raise RuntimeError('row environment anchor differs')
s=s.replace(anchor,branch+anchor)
start=s.index("    if 'ptq_rows_per_warp' in PLAN:");end=s.index('    command=[',start)
body=s[start:end]
if body.count('rows not in (2,4)')!=1:raise RuntimeError('PTQ row closed set differs')
body=body.replace('rows not in (2,4)','rows not in (0,2,4)').replace('PTQ rows per warp must be 2 or 4','PTQ rows per warp must be 0, 2 or 4')
s=s[:start]+body+s[end:];ast.parse(s);p.write_text(s)
cleanup=(BASE/'check_xolotl_trial_cleanup.py').read_text().replace('xolotl-trial-cleanup-controls.json','xolotl-trial-cleanup-rows-controls.json')
(BASE/'check_xolotl_rows_cleanup.frozen.py').write_text(cleanup)
print('Prepared closed scalar-hybrid / row2 / scalar-hybrid / row4 plans; no launch.')
