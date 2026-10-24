"""Preserve the failed preflight; no GPU trial/intent existed, then freeze corrected operators."""
import ast,json
from xolotl_trial_common import BASE
failed=json.loads((BASE/'xolotl-dense-chain-v3-repeat-progress.json').read_text())
if failed['phase']!='failed' or 'profile' not in failed['error']:raise RuntimeError('expected local preflight failure differs')
campaign=json.loads((BASE/'xolotl-dense-chain-v3-repeat-campaign.json').read_text())
for mode in campaign['order'][2:]:
 if (BASE/('xolotl-'+mode+'-intent.json')).exists():raise RuntimeError('a model intent exists; do not replace its operator')
p=BASE/'launch_xolotl_dense_chain_v3_repeat_v2.frozen.py'
if p.exists():raise RuntimeError('corrected repeat operator already frozen')
s=(BASE/'launch_xolotl_dense_chain_v3_repeat.frozen.py').read_text();a="\nmc=json.loads((BASE/'xolotl-dense-chain-v3-build-latest.json').read_text())['result.json']"
if s.count(a)!=1 or '\nprofile=profiles[args.mode]\n' in s:raise RuntimeError('missing profile assignment anchor differs')
s=s.replace(a,'\nprofile=profiles[args.mode]'+a);ast.parse(s);p.write_text(s)
s=(BASE/'run_xolotl_dense_chain_v3_repeats.py').read_text().replace('launch_xolotl_dense_chain_v3_repeat.frozen.py','launch_xolotl_dense_chain_v3_repeat_v2.frozen.py').replace('xolotl-dense-chain-v3-repeat-progress.json','xolotl-dense-chain-v3-repeat-progress-v2.json');ast.parse(s);(BASE/'run_xolotl_dense_chain_v3_repeats_v2.py').write_text(s)
print('Preserved failed local preflight; corrected profile lookup before any repeat intent/GPU execution')
