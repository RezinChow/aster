"""Prepare a closed lower-confidence experiment within the existing resource lease."""
import ast,json,time
from xolotl_trial_common import BASE

modes=['single-current-split-conf020','single-current-split-conf045-final']
for name in ['launch_xolotl_protocol_trial.py','observe_xolotl_protocol_trial.py']:
 p=BASE/name;s=p.read_text();anchor="'single-current-q8-mmq']"
 if s.count(anchor)!=1:raise RuntimeError('closed choice anchor changed')
 s=s.replace(anchor,"'single-current-q8-mmq',"+','.join(map(repr,modes))+']')
 if name.startswith('launch'):
  anchor='record=dict(unix=time.time(),mode=args.mode,'
  if s.count(anchor)!=1:raise RuntimeError('plan anchor changed')
  branch="if args.mode in "+repr(modes)+":plan.update(split_mmvq='11',ptq_rows_per_warp=4,max_trial_seconds=300,draft_confidence=0.20 if args.mode.endswith('conf020') else 0.45)\n"
  s=s.replace(anchor,branch+anchor)
 ast.parse(s);p.write_text(s)
p=BASE/'xolotl_protocol_trial_worker.py';s=p.read_text();anchor='budget not in (600,900,1800)'
if s.count(anchor)!=1:raise RuntimeError('budget set changed')
s=s.replace(anchor,'budget not in (300,600,900,1800)').replace('trial duration must be 600, 900 or 1800 seconds','trial duration must be 300, 600, 900 or 1800 seconds')
ast.parse(s);p.write_text(s)
cleanup=(BASE/'check_xolotl_trial_cleanup.py').read_text().replace('xolotl-trial-cleanup-controls.json','xolotl-trial-cleanup-conf300-controls.json')
compile(cleanup,'cleanup-conf300.py','exec');(BASE/'check_xolotl_conf300_cleanup.frozen.py').write_text(cleanup)
milestone=dict(unix=time.time(),user_instruction='先做到单卡300 token/s',target_single_gpu_single_request_decode_tok_s=300,measurement='(generated tokens - 1) / (last token arrival - first token arrival); serial requests, no aggregate substitution',achieved=False,previous_goal_tok_s=500)
(BASE/'xolotl-current-milestone.json').write_text(json.dumps(milestone,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Prepared two single-device confidence profiles; 300 second worker / 350 second outer budget; immutable lease unchanged.')
