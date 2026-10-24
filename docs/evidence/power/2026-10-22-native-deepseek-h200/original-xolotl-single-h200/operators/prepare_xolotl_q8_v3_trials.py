import ast
from xolotl_trial_common import BASE
p=BASE/'launch_xolotl_protocol_trial.py';s=p.read_text()
for a,b in [('xolotl-q8-v2-hardware-controls.json','xolotl-q8-v3-hardware-controls.json'),('xolotl-q8-v2-build-latest.json','xolotl-q8-v3-build-latest.json'),('xolotl-h200-q8-v2-build-intent.json','xolotl-h200-q8-v3-build-intent.json')]:
 if s.count(a)!=1:raise RuntimeError('V3 model qualification anchor differs')
 s=s.replace(a,b)
anchor="split_mmvq='11',ptq_rows_per_warp=4,max_trial_seconds=900,q8_mmq="
if s.count(anchor)!=1:raise RuntimeError('Q8 model budget anchor differs')
s=s.replace(anchor,"split_mmvq='11',ptq_rows_per_warp=4,max_trial_seconds=600,q8_mmq=");ast.parse(s);p.write_text(s)
p=BASE/'xolotl_protocol_trial_worker.py';s=p.read_text();anchor='budget not in (900,1800)'
if s.count(anchor)!=1:raise RuntimeError('worker budget set differs')
s=s.replace(anchor,'budget not in (600,900,1800)').replace('trial duration must be 900 or 1800 seconds','trial duration must be 600, 900 or 1800 seconds');ast.parse(s);p.write_text(s)
cleanup=(BASE/'check_xolotl_trial_cleanup.py').read_text().replace('xolotl-trial-cleanup-controls.json','xolotl-trial-cleanup-q8-controls.json')
compile(cleanup,'q8-worker-cleanup.py','exec');(BASE/'check_xolotl_q8_trial_cleanup.frozen.py').write_text(cleanup)
print('V3 numerical gate retained; Q8 model trials capped at 600 seconds, outer 650, within immutable lease')
