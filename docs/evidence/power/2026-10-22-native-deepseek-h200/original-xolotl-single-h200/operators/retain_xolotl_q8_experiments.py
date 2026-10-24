import hashlib,json,shutil
from xolotl_trial_common import BASE,WORK
dest=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200'
files=['xolotl-h200-q8-mmq.patch','xolotl-h200-q8-control.patch','xolotl-h200-q8-control-v2.patch','xolotl-h200-q8-mmq-v3.patch','xolotl-h200-q8-control-v3.patch','xolotl-h200-q8-mmq-plan.json','xolotl-h200-q8-mmq-v3-plan.json','xolotl-h200-q8-build-intent.json','xolotl-q8-build-latest.json','xolotl-h200-q8-v2-build-intent.json','xolotl-q8-v2-build-latest.json','xolotl-q8-v2-hardware-controls.json','xolotl-h200-q8-v3-build-intent.json','xolotl-q8-v3-build-latest.json','xolotl-q8-v3-hardware-controls.json','xolotl-trial-cleanup-q8-controls.json']
for name in files:
 p=BASE/name
 if p.is_file():
  if p.stat().st_size>2*1024**2:raise RuntimeError('Q8 evidence bounds exceeded')
  shutil.copy2(p,dest/name)
ops=['aster_h200_q8_mmq.cpp','aster_h200_q8_mmq_v3.cpp','prepare_xolotl_q8_patch.py','prepare_xolotl_q8_v2.py','prepare_xolotl_q8_v3.py','stage_xolotl_q8_build.py','launch_xolotl_q8_build.py','observe_xolotl_q8_build.py','qualify_xolotl_q8_build.py','prepare_xolotl_q8_trials.py','prepare_xolotl_q8_v3_trials.py','check_xolotl_q8_trial_cleanup.frozen.py','retain_xolotl_q8_experiments.py']
for version in ['v2','v3']:
 for kind in ['stage','launch','observe','qualify']:ops.append(kind+'_xolotl_q8_'+version+'_build.frozen.py')
 for role in ['build_worker','build_launcher','control_worker']:ops.append('xolotl_q8_'+version+'_'+role+'.frozen.py')
for name in ops:
 if (BASE/name).is_file():shutil.copy2(BASE/name,dest/'operators'/name)
manifest=WORK/'docs/source-manifest.json';m=json.loads(manifest.read_text(encoding='utf-8'))
v3=json.loads((BASE/'xolotl-q8-v3-build-latest.json').read_text())['build-result.json'] if (BASE/'xolotl-q8-v3-build-latest.json').exists() else {}
q8=dict(upstream='https://github.com/ggml-org/llama.cpp',ggml_revision='3cf03257f219afbe7334045ff7c6a06ac68c627d',license='MIT',default='off',source_imported_into_product=False,scope='SM90 Q8_0 dense dispatch at two measured large shapes; MMVQ fp16 activation scale rounding retained in new MMQ path',v2_numerical_gate_passed=False,v3_build_phase=v3.get('phase'),patch_sha256=hashlib.sha256((BASE/'xolotl-h200-q8-mmq-v3.patch').read_bytes()).hexdigest(),full_model_qualified=False,single_h200_500_tok_s_qualified=False)
if v3.get('phase')=='built':q8['engine_binary_sha256']=v3['binaries']['ds41_generate']['sha256']
if (BASE/'xolotl-q8-v3-hardware-controls.json').exists():q8['v3_numerical_gate_passed']=json.loads((BASE/'xolotl-q8-v3-hardware-controls.json').read_text()).get('q8-controls-result.json',{}).get('passed',False)
m['original_xolotl_h200_20261024']['dense_q8_candidate']=q8;manifest.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
outcome=dest.parent/'OUTCOME.md';s=outcome.read_text(encoding='utf-8');marker='### Xolotl Q8 TensorCore candidate and refused broad switch (2026-10-24)'
if marker not in s:
 s+='''

### Xolotl Q8 TensorCore candidate and refused broad switch (2026-10-24)

V1 stopped before compilation/GPU work when the appended CMake test-target
patch did not match the preceding appended split-target context. Its failed
root, rejects and logs remain. V2 changes only that patch context; separate
SM90 build completes (engine SHA256
`282d819b5a806fb97677a225399bd4bc62c2c39bd440985024c2c6caccece2b1`).
The default-off broad selector changes Q8_0 widths2..8 from MMVQ to MMQ.

Twenty-two real-CUDA synthetic matrix controls run each exact graph five
warmups and twenty timed repeats, with paired outputs retained on owned GPFS
and hashed. All values finite; three unchanged M1 controls are bitwise equal.
The nineteen switched cases differ at relative L2 ~2.05e-4..2.32e-4, failing
the predeclared 2e-4 L2/max-normalized gates. No full-model V2 trial is launched.
This is a refused equivalence threshold, not evidence of model quality harm.
Small 5120x1280 M2 worsens 10.735 -> 19.545 us, while 1280x32768 M8 improves
53.015 -> 25.981 us and 5120x129280 M6 improves 348.106 -> 277.795 us. Broad
MMQ is not adopted and microbench times are not converted to model token/s.

Primary source diagnosis: MMVQ stores q8_1 scale through FP16, whereas MMQ's
D4 layout stores FP32. V3 retains the original numerical limits and restricts
dispatch to large 1280x32768 and 5120x129280 matrices at widths2..8. Its new
MMQ overload rounds only selected D4 input scales through FP16; all original
entry points, M1, small shapes, other types and MoE paths retain original
behavior. The second quantizer overload preserves callers, including the
macro-renamed embedded Strata prefill translation unit. V3 build and new
hardware/full-model qualification are separate and pending at preparation.

Future Q8 full-model trials are bounded to600 seconds with650-second outer
cleanup deadlines inside the immutable resource lease. Actual alarm and
SIGTERM child-reaping controls pass on the new worker; the previous hybrid's
exact frozen worker/proof are retained separately. No 500 tok/s claim is made.
'''
 outcome.write_text(s,encoding='utf-8')
print(json.dumps(dict(retained=True,v3_build=q8['v3_build_phase'],goal_complete=False)))
