"""Closed paired actual-generation trials, plus an intentional CPU-fallback pair."""
import ast
from xolotl_trial_common import BASE
modes=['single-current-device-control','single-current-device-direct','single-current-device-cpu-control','single-current-device-cpu-direct']
for name in ['launch_xolotl_protocol_trial.py','observe_xolotl_protocol_trial.py']:
 p=BASE/name;s=p.read_text();tree=ast.parse(s)
 calls=[n for n in ast.walk(tree) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr=='add_argument' and n.args and isinstance(n.args[0],ast.Constant) and n.args[0].value=='--mode']
 if len(calls)!=1:raise RuntimeError('device mode parser anchor differs')
 choices=[k.value for k in calls[0].keywords if k.arg=='choices']
 if len(choices)!=1 or not isinstance(choices[0],ast.List):raise RuntimeError('device mode closed set differs')
 old=ast.get_source_segment(s,choices[0]);values=ast.literal_eval(choices[0])
 if any(mode in values for mode in modes) or s.count(old)!=1:raise RuntimeError('device choices already prepared or ambiguous')
 s=s.replace(old,repr(values+modes))
 if name.startswith('launch'):
  anchor='record=dict(unix=time.time(),mode=args.mode,'
  branch='''if args.mode.startswith('single-current-device-'):
 dc=json.loads((BASE/'xolotl-device-verify-hardware-controls.json').read_text()).get('controls-result.json',{})
 db=json.loads((BASE/'xolotl-device-verify-build-latest.json').read_text())['build-result.json']
 if not dc.get('passed') or len(dc.get('additional_controls',[]))!=2 or db['phase']!='built':raise RuntimeError('new single-GPU controls must pass before model testing')
 di=json.loads((BASE/'xolotl-h200-device-verify-build-intent.json').read_text());stage['root']=di['root']
 plan.update(binary=db['binaries']['ds41_generate']['path'],binary_sha256=db['binaries']['ds41_generate']['sha256'],graph_metadata_mib=1024,split_mmvq='11',ptq_rows_per_warp=4,max_trial_seconds=600,device_verify=args.mode.endswith('-direct'))
 if '-cpu-' in args.mode:
  cpu_prompt=json.loads((BASE/'xolotl-device-cpu-fallback-prompt.json').read_text(encoding='utf-8'))
  plan.update(cases=[cpu_prompt],campaign='cpu-fallback-transport-v1',tier_batch_pcie=0.0,max_trial_seconds=900)
'''
  if s.count(anchor)!=1:raise RuntimeError('device plan anchor differs')
  s=s.replace(anchor,branch+anchor)
 ast.parse(s);p.write_text(s)
p=BASE/'xolotl_protocol_trial_worker.py';s=p.read_text();anchor="    if 'q8_mmq' in PLAN:"
branch='''    if 'device_verify' in PLAN:
        if type(PLAN['device_verify']) is not bool:raise RuntimeError('device verify must be a boolean')
        env['ASTER_XQ_DEVICE_VERIFY']='1' if PLAN['device_verify'] else '0'
    if 'tier_batch_pcie' in PLAN:
        if PLAN['tier_batch_pcie']!=0.0:raise RuntimeError('CPU fallback transport control requires zero PCIe share')
        env['STRATA_TIER_BATCH_PCIE']='0'
'''
if s.count(anchor)!=1:raise RuntimeError('device env anchor differs')
s=s.replace(anchor,branch+anchor);ast.parse(s);p.write_text(s)
cleanup=(BASE/'check_xolotl_trial_cleanup.py').read_text().replace('xolotl-trial-cleanup-controls.json','xolotl-trial-cleanup-device-controls.json')
(BASE/'check_xolotl_device_cleanup.frozen.py').write_text(cleanup)
print('Prepared default-off device transport and deliberate CPU fallback pairs; no model launch.')
