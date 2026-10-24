"""Freeze V2 profiles without altering V1 workers, intents or measurements."""
import ast
from xolotl_trial_common import BASE
for source,dest in [('launch_xolotl_qsum_model_trial.frozen.py','launch_xolotl_qsum_v2_model_trial.frozen.py'),('observe_xolotl_qsum_model_trial.frozen.py','observe_xolotl_qsum_v2_model_trial.frozen.py'),('compare_xolotl_qsum_model.frozen.py','compare_xolotl_qsum_v2_model.frozen.py')]:
 p=BASE/dest
 if p.exists():raise RuntimeError('V2 profile operator already frozen')
 s=(BASE/source).read_text().replace('single-current-qsum-','single-current-qsum-v2-').replace('xolotl-ptq-qsum-latest.json','xolotl-ptq-qsum-v2-latest.json').replace('xolotl-ptq-qsum-intent.json','xolotl-ptq-qsum-v2-intent.json')
 if source.startswith('compare'):s=s.replace("'xolotl-qsum-'+args.candidate","'xolotl-qsum-v2-'+args.candidate")
 ast.parse(s);p.write_text(s)
print('V2 profiles prepared only, same full-model worker and39-control gate retained.')
