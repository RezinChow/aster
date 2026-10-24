"""Freeze distinct V3 aliases; require actual CUDA interop regression before launch."""
import ast
from xolotl_trial_common import BASE
for kind in ['launch','observe','compare']:
 source=BASE/(kind+'_xolotl_dense_chain'+('_trial' if kind!='compare' else '')+'.frozen.py')
 target=BASE/(kind+'_xolotl_dense_chain_v3'+('_trial' if kind!='compare' else '')+'.frozen.py')
 if target.exists():raise RuntimeError('V3 operator already frozen')
 s=source.read_text().replace('single-current-dense-chain-','single-current-dense-chain-v3-')
 if kind=='launch':
  s=s.replace('xolotl-dense-chain-v2-build-latest.json','xolotl-dense-chain-v3-build-latest.json')
  a="if mc.get('phase')!='built' or not mc.get('passed') or not mc.get('hermetic_fence_tests_passed'):raise RuntimeError('private dense build and lifetime tests must pass')"
  if s.count(a)!=1:raise RuntimeError('V3 qualification gate anchor differs')
  s=s.replace(a,a+"\ngpu_regression=json.loads((BASE/'xolotl-dense-external-regression-result.json').read_text())\nif not gpu_regression.get('passed'):raise RuntimeError('actual CUDA external readback controls must pass')")
 if kind=='compare':s=s.replace("'xolotl-dense-chain-'+args.candidate", "'xolotl-dense-chain-v3-'+args.candidate")
 ast.parse(s);target.write_text(s)
s=(BASE/'inspect_xolotl_dense_chain_runtime.py').read_text().replace('single-current-dense-chain-','single-current-dense-chain-v3-')
ast.parse(s);(BASE/'inspect_xolotl_dense_chain_v3_runtime.py').write_text(s)
print('Prepared closed V3 aliases with same-binary comparison and actual CUDA regression gate')
