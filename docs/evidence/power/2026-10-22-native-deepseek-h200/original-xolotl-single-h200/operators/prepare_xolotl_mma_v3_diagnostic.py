"""Use the qualified private shutdown-hook binary only for group diagnostics."""
import ast
from xolotl_trial_common import BASE
mode='single-current-mma-v3-diagnostic'
launcher=(BASE/'launch_xolotl_mma_v2_model_trial.frozen.py').read_text().replace('single-current-mma-v2-','single-current-mma-v3-').replace('xolotl-ptq-mma-integrated-v2-','xolotl-ptq-mma-integrated-v3-')
start=launcher.index('choices=[');end=launcher.index('],required=True',start)+1;launcher=launcher[:start]+'choices='+repr([mode])+launcher[end:]
ast.parse(launcher);(BASE/'launch_xolotl_mma_v3_diagnostic.frozen.py').write_text(launcher)
observer=(BASE/'observe_xolotl_mma_v2_model_trial.frozen.py').read_text();start=observer.index('choices=[');end=observer.index(']);p.add_argument',start)+1;observer=observer[:start]+'choices='+repr([mode])+observer[end:]
ast.parse(observer);(BASE/'observe_xolotl_mma_v3_diagnostic.frozen.py').write_text(observer)
inspection=(BASE/'inspect_xolotl_mma_v2_runtime.py').read_text().replace('single-current-mma-v2-diagnostic','single-current-mma-v3-diagnostic').replace('xolotl-mma-v2-runtime-inspection.json','xolotl-mma-v3-runtime-inspection.json')
ast.parse(inspection);(BASE/'inspect_xolotl_mma_v3_runtime.frozen.py').write_text(inspection)
print('Prepared diagnostic-only run with explicit CUDA counter output before the native serve _Exit.')
