"""Retain bounded profile diagnostics, failures and row-layout comparisons."""
import base64,hashlib,json,shutil
from xolotl_trial_common import BASE,WORK,jump
dest=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200'
intent=json.loads((BASE/'xolotl-single-current-profile-prose-v2-intent.json').read_text())
code='''from pathlib import Path
import base64,json
root=Path(@ROOT@);out={}
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('profile owner differs')
for name in ['statistics_cuda_api_sum.csv','statistics_cuda_gpu_kern_sum.csv','statistics_cuda_gpu_mem_time_sum.csv','statistics_cuda_gpu_mem_size_sum.csv','stats.stdout.log','stats.stderr.log','export.stderr.log','statistics-result.json','statistics-worker.py','profile-target-process.json','nsys-launch-process.json','nsys-start.stdout.log','nsys-start.stderr.log','nsys-stop.stdout.log','nsys-stop.stderr.log']:
 p=root/name
 if not p.exists():continue
 if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>262144:raise RuntimeError('profile retention bound differs')
 out[name]=base64.b64encode(p.read_bytes()).decode()
print(json.dumps(out))
'''.replace('@ROOT@',repr(intent['root']))
data=jump(code)
profile=dest/'nsys-prose-v2';profile.mkdir(exist_ok=True)
for name,raw in data.items():(profile/name).write_bytes(base64.b64decode(raw))
for name in ['xolotl-current-round-comparison.json','xolotl-profile-summary.json','xolotl-official-geometry.json']:
 shutil.copy2(BASE/name,dest/name)
op=dest/'operators'
for name in ['retain_xolotl_profile_and_rows.py','retain_xolotl_trial_evidence.py','retain_xolotl_frozen_workers.py','compare_current_xolotl_rounds.py','prepare_xolotl_split_patch.py','stage_xolotl_split_build.py','launch_xolotl_split_build.py','observe_xolotl_split_build.py','xolotl_split_build_worker.frozen.py','xolotl_split_build_launcher.frozen.py','read_xolotl_geometry.py']:
 if (BASE/name).is_file():shutil.copy2(BASE/name,op/name)
for name in ['xolotl-h200-split-mmvq.patch','xolotl-h200-split-mmvq-plan.json','xolotl-h200-split-build-intent.json','xolotl-split-build-latest.json']:
 if (BASE/name).is_file():shutil.copy2(BASE/name,dest/name)
outcome=dest.parent/'OUTCOME.md';s=outcome.read_text(encoding='utf-8')
marker='### Xolotl H200 CUDA trace and expert row layouts (2026-10-24)'
if marker not in s:
 s+='''

### Xolotl H200 CUDA trace and expert row layouts (2026-10-24)

Single-visible GPU0, immutable e9d0826 engine + default-off graph patch, same
weights/prompts/DSpark depth5/conf0.45, arena160 GiB, PF0 and 1 GiB pass metadata.
R2 and R4 select existing `STRATA_EXP_MODE_T143/T11` layouts; Q2_0 retains its
control layout. Every one of the 17 request output ID sequences matches the
cache1024 control in both runs. All measured samples, including outliers, remain.
Mixed serial decode: control 80.8204, R2 89.5452 (+10.80%), R4 91.0824 (+12.70%)
tok/s. R2 count/code/English/Chinese: 120.9958/102.8369/75.8914/88.4147; R4:
113.5969/106.4493/77.1023/90.0539 tok/s. One sequential block per configuration;
these are candidates, not alternating-block confirmation or a universal rate.

Nsight interactive capture succeeded after three prose warmups, 128 output IDs,
engine exit0/reaped. Trace SHA256
`40481df9d08bd9fd5f0b238bb570b5d8ba7da2e26af6a5194ce8c32b308d723b`,
14,192,505 bytes, retained on the owned GPFS artifact path from the trial receipt.
Recorded events: 188,813 kernels and 45,936 copies over 2.1992 seconds; expert
gate/up/down kernels sum 0.67177 seconds of 1.44871 seconds recorded kernel time.
Recorded GPU busy union is 1.48647 seconds, **not** summed API waiting time.
Nsight 2025.3.1 warns driver13.2 is unsupported (uses CUDA12.9 trace libraries)
and some events might be missing; event counts and busy fraction only describe
the recorded trace. The profiled 57.87 tok/s is diagnostic and excluded from
unprofiled optimization comparisons. Stats generated its SQLite successfully;
the subsequent unnecessary export refused the existing SQLite. Read-only
`pragma quick_check` passed. No trace was overwritten or rerun to hide this.

The first capture refused unsupported `nsys start --duration=20` before capture;
its exact target was intentionally reaped (137), not diagnosed as OOM. V2 removed
that option and succeeded. Both attempts and exact frozen operators remain.

Next candidate: default-off PTQ1_0/Q3_K decode-once grouped kernels, separate
immutable build. Runtime values are closed (0/143/11/both); old kernel override
remains available for direct bitwise hardware controls. Numerical qualification
and full-model acceleration are pending, not claimed. The 500 tok/s goal remains
unmet; no HTTP service/key has been delivered by these protocol-only trials.
'''
 outcome.write_text(s,encoding='utf-8')
print(json.dumps(dict(retained_profile_files=len(data),path=str(dest)),indent=2))
