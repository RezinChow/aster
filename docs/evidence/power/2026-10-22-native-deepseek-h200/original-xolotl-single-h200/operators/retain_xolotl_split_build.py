import hashlib,json,shutil
from xolotl_trial_common import BASE,WORK
dest=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200'
for name in ['xolotl-h200-split-mmvq.patch','xolotl-h200-split-mmvq-plan.json','xolotl-h200-split-build-intent.json','xolotl-split-build-latest.json','xolotl-split-build-hardware-controls.json','xolotl-split-controls-launch.json']:
 if (BASE/name).is_file():shutil.copy2(BASE/name,dest/name)
for name in ['qualify_xolotl_split_build.py','prepare_xolotl_split_trials.py','xolotl_split_control_worker.frozen.py','retain_xolotl_split_build.py']:
 if (BASE/name).is_file():shutil.copy2(BASE/name,dest/'operators'/name)
manifest=WORK/'docs/source-manifest.json';m=json.loads(manifest.read_text(encoding='utf-8'))
build=json.loads((BASE/'xolotl-split-build-latest.json').read_text())['build-result.json']
controls=json.loads((BASE/'xolotl-split-build-hardware-controls.json').read_text()).get('controls-result.json',{})
if build['phase']!='built' or not controls.get('passed'):raise RuntimeError('split provenance requires actual build and CUDA controls')
m['original_xolotl_h200_20261024']['decode_once_candidate']=dict(license='MIT',derived_from=['src/kernels/cuda/fork/fork_vecdot.cuh','src/kernels/cuda/iq_kernels.cu','src/kernels/iq_multi_parity.cpp'],patch_sha256=hashlib.sha256((BASE/'xolotl-h200-split-mmvq.patch').read_bytes()).hexdigest(),engine_binary_sha256=build['binaries']['ds41_generate']['sha256'],runtime_flag='ASTER_XQ_SPLIT_MMVQ',runtime_closed_set=['0','143','11','both'],default='off',hardware='NVIDIA H200 SM90, visible ordinal0',direct_bitwise_cases_passed=12,control_seed=18,geometry=[5120,2304],edge_cases='0..11 entries per group; unused grid rows; scattered destination rows; small 1024x512 geometry',full_model_speed_qualified=False,single_h200_500_tok_s_qualified=False)
manifest.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
outcome=dest.parent/'OUTCOME.md';s=outcome.read_text(encoding='utf-8');marker='### Xolotl decode-once kernel hardware qualification (2026-10-24)'
if marker not in s:
 s+='''

### Xolotl decode-once kernel hardware qualification (2026-10-24)

The separate SM90 Release build completed (engine SHA256
`e943305094fd8612718cf817985cf232ee457e31d434c0512b32a8097e7f30b8`).
Patch `04d402b60751fe31ca742b2402e4b5ffbecda7d91af9f7e106c0b7692fccffeb`
adds default-off PTQ1_0/Q3_K Split load/apply and routes only grouped expert
launchers through it. Original whole-block PTQ layout is compile-time required;
the older-kernel override still selects an independent scalar control. Model
weights, routes, activations, grid sizes and reduction order remain unchanged.

`CUDA_VISIBLE_DEVICES=0 ASTER_XQ_SPLIT_MMVQ=both
build/aster_xq_split_parity --aster-xq` ran on NVIDIA H200 SM90: 12/12 grouped
cases bitwise equal, zero failures, exit0. Tests cover six gate/down pairs at
5120x2304 and 1024x512, nine groups with 0..11 entries, unused grid rows and
scattered output destinations; output finiteness and unwritten sentinels are
checked. Synthetic data seed18, small finite scales. The whole model has not
yet been qualified at this point.

Microbench timings include activation quantization: PTQ type143 scalar/split
at T1/3/5/8: 116.30/121.76, 316.54/281.74, 515.85/450.38,
816.25/697.57 us. Q3_K type11: 162.39/177.42, 439.30/228.85,
718.95/405.99, 1138.19/489.45 us. Single-token regressions are retained;
these synthetic kernel timings are not full-model token/s. Original frozen
patch, build worker, control worker, exact binary identities and stdout are
retained; full-model control/candidate comparison is next. No 500 tok/s claim.
'''
 outcome.write_text(s,encoding='utf-8')
print(json.dumps(dict(retained=True,hardware_cases=12,default='off',goal_complete=False)))
