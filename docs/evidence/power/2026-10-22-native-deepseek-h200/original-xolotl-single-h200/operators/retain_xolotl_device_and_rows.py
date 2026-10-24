"""Preserve transport qualification and the separate pending row-kernel candidate."""
import json,shutil,hashlib
from xolotl_trial_common import BASE,WORK
dest=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200'
files=['xolotl-single300-environment.json','xolotl-h200-device-verify.patch','xolotl-h200-device-verify-plan.json','xolotl-h200-device-verify-build-intent.json','xolotl-device-verify-build-latest.json','xolotl-device-verify-hardware-controls.json','xolotl-device-verify-controls-launch.json','xolotl-device-verify-campaign.json','xolotl-device-round-comparison.json','xolotl-device-cpu-comparison.json','xolotl-device-cpu-fallback-prompt.json','xolotl-trial-cleanup-device-controls.json','xolotl-h200-split-rows.patch','xolotl-h200-split-rows-plan.json','xolotl-h200-split-rows-build-intent.json','xolotl-split-rows-build-latest.json','xolotl-split-rows-hardware-controls.json','xolotl-split-rows-controls-launch.json','xolotl-split-rows-campaign.json','xolotl-split-rows-round-comparison.json']
files+=['xolotl-trial-cleanup-rows-controls.json']
files+=['xolotl-300-next-iteration.json']
ops=['prepare_xolotl_device_verify_patch.py','stage_xolotl_device_verify_build.py','stage_xolotl_device_verify_build.frozen.py','launch_xolotl_device_verify_build.py','observe_xolotl_device_verify_build.py','qualify_xolotl_device_verify_build.py','qualify_xolotl_device_verify_build.frozen.py','xolotl_device_verify_build_worker.frozen.py','xolotl_device_verify_build_launcher.frozen.py','xolotl_device_verify_build_observer.frozen.py','xolotl_device_verify_control_worker.frozen.py','prepare_xolotl_device_verify_trials.py','prepare_xolotl_cpu_fallback_prompt.py','run_xolotl_device_verify_campaign.py','check_xolotl_device_cleanup.frozen.py','compare_xolotl_transport.py','aster_xq_split_rows.cuh','prepare_xolotl_split_rows_patch.py','stage_xolotl_split_rows_build.py','stage_xolotl_split_rows_build.frozen.py','launch_xolotl_split_rows_build.py','observe_xolotl_split_rows_build.py','qualify_xolotl_split_rows_build.py','qualify_xolotl_split_rows_build.frozen.py','xolotl_split_rows_build_worker.frozen.py','xolotl_split_rows_build_launcher.frozen.py','xolotl_split_rows_build_observer.frozen.py','xolotl_split_rows_control_worker.frozen.py','probe_xolotl_single300_environment.py','retain_xolotl_device_and_rows.py','prepare_xolotl_split_rows_trials.py','run_xolotl_split_rows_campaign.py','compare_xolotl_split_rows.py','compare_xolotl_split_rows.frozen.py','check_xolotl_rows_cleanup.frozen.py']
ops+=['persist_xolotl_300_next_iteration.py']
for name in files+ops:
 p=BASE/name
 if p.is_file():
  if p.stat().st_size>2*1024**2:raise RuntimeError('device/rows evidence exceeds bound')
  shutil.copy2(p,(dest/'operators' if name in ops else dest)/name)
path=WORK/'docs/source-manifest.json';m=json.loads(path.read_text(encoding='utf-8'));x=m['original_xolotl_h200_20261024']
comparison=json.loads((BASE/'xolotl-device-round-comparison.json').read_text());cpu=json.loads((BASE/'xolotl-device-cpu-comparison.json').read_text())
x['device_verify_candidate']=dict(upstream='https://github.com/Indras-Mirror/Xolotl',license='MIT',default='off',source_imported_into_product=False,patch_sha256=hashlib.sha256((BASE/'xolotl-h200-device-verify.patch').read_bytes()).hexdigest(),engine_binary_sha256='6c6ae00cf26236f6e6aa6c9c3f20261e6e35313a4f498f056bf4f6354d4b1811',full_model_token_id_pairs_equal=17,cpu_fallback_token_id_pairs_equal=4,real_cpu_fallback_experts_per_decode=41,control_mixed_tok_s=comparison['rows'][0]['mixed']['tok_s'],candidate_mixed_tok_s=comparison['rows'][1]['mixed']['tok_s'],one_pair_delta_percent=comparison['delta_percent'],adopted=False,stable_speedup_qualified=False,single_h200_300_tok_s_qualified=False,scope='One actual single-H200 allocation, short repeated prompts, ctx4096, 17 broad and4 deliberate CPU-fallback requests per profile; no broad-quality or long-context claim')
rows_plan=json.loads((BASE/'xolotl-h200-split-rows-plan.json').read_text());rowbuild=json.loads((BASE/'xolotl-split-rows-build-latest.json').read_text()).get('build-result.json',{}) if (BASE/'xolotl-split-rows-build-latest.json').exists() else {}
x['split_rows_candidate']=dict(upstream='https://github.com/Indras-Mirror/Xolotl',license='MIT',default='off',patch_sha256=rows_plan['patch_sha256'],build_phase=rowbuild.get('phase','building'),hardware_qualified=False,full_model_speed_qualified=False,single_h200_300_tok_s_qualified=False)
if (BASE/'xolotl-split-rows-hardware-controls.json').exists():x['split_rows_candidate']['hardware_qualified']=json.loads((BASE/'xolotl-split-rows-hardware-controls.json').read_text()).get('controls-result.json',{}).get('passed',False)
if (BASE/'xolotl-split-rows-round-comparison.json').exists():
 rc=json.loads((BASE/'xolotl-split-rows-round-comparison.json').read_text())
 x['split_rows_candidate'].update(full_model_phase=rc['phase'],paired_request_ids_equal=rc['all_ids_equal'],paired_requests=17,control_mixed_tok_s=rc['rows'][0]['mixed']['tok_s'],row2_mixed_tok_s=rc['rows'][1]['mixed']['tok_s'],delta_percent=rc['delta_percent'],adopted=False,row4_full_model_tested=False)
path.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path=dest.parent/'OUTCOME.md';s=path.read_text(encoding='utf-8');marker='### Device-resident expert verify inputs on the new single H200 (2026-10-24)'
if marker not in s:
 s+='''

### Device-resident expert verify inputs on the new single H200 (2026-10-24)

The new allocation validates exactly one physical H200, SM90, driver595.71.05,
143771MiB NVML memory,700W limit. Actual cgroup allowance is20CPU/220GiB.
The old two-card job/replica are terminal before submission. This is a new
node and CPU allowance: use its same-binary control, not cross-node timings,
for an isolated optimization comparison. Immutable one-hour lease remains.

Default-off `ASTER_XQ_DEVICE_VERIFY=1` keeps the batched expert input tensor
on the CUDA backend instead of copying it to host and then back. Host route
IDs/weights, existing dense and tier fences, quantization, expert arithmetic,
and outputs remain. Actual CPU expert jobs trigger an exact D2H copy before
their pool work. CPU dense, unbatched, and either remote-helper mechanism
refuse this new entry point. Existing public method signatures are retained.

SM90 build completes with engine SHA256
`6c6ae00cf26236f6e6aa6c9c3f20261e6e35313a4f498f056bf4f6354d4b1811`.
Twelve grouped expert bitwise controls plus fused-quantization and HC-mix
CUDA controls pass; CPU-only alarm/SIGTERM child-reaping controls pass both.
Full generation control/direct:94.99749 ->96.26502 mixed serial tok/s
(+1.3343%, one process pair). All17 paired request ID sequences agree;
both exit0 and reap. This small gain is not yet stable-speed qualification
and does not promote the default flag or replace the qualified baseline.

Separate correctness-only control/direct campaigns force the batched PCIe
share to zero, using the public prompt `1+1` and max2 generated tokens.
Each request actually runs41 CPU experts (plus439 GPU hits); the cold prompt
runs137 CPU experts. All4 paired request ID sequences agree, exit0/reaped.
The CPU-fallback timing is not a model speed or300 tok/s qualification.
Commands/operators and exact frozen workers, stderr, IDs and monotonic
arrivals are retained with the single-device allocation and cgroup proof.

A separate pending kernel combines weight-decode-once with2/4 interleaved
output rows per warp for PTQ1_0 and Q3_K. It retains the scalar lane-k and
warp-reduction order and has a closed default-off selector. Preparation and
source patch are retained separately from build and hardware qualification.
No performance or correctness result is claimed for this pending kernel.

Explicitly not claimed:300 tok/s, stable transport speedup, long context,
broad quality, a model-serving address/API key, or any GPU1 work.
'''
 path.write_text(s,encoding='utf-8')
marker='### Combined decode-once and row-interleave result (2026-10-24)'
if (BASE/'xolotl-split-rows-round-comparison.json').exists() and marker not in s:
 s+='''

### Combined decode-once and row-interleave result (2026-10-24)

The new SM90 build completes, engine SHA256
`72e53b0d3b2652ab8721ac0fbeb89d46d50e854ccf2ab1416bd731a7e37ffa7b`.
Row2/row4 each pass12 grouped-expert bitwise controls (24 total), with
unused groups/entries and scatter destinations. FQ/HC-mix CUDA controls and
both actual worker alarm/SIGTERM CPU-only child-reaping controls also pass.

The same-binary serial full-model control/row2 pair completes17 requests
each, exit0/reaped, all17 paired output ID sequences equal. Mixed speed
94.77734 ->85.51606 tok/s (-9.7716%). Count129.21982 ->115.22597;
code115.57320 ->103.12128; English78.69821 ->71.12273;
Chinese91.07215 ->82.92161. Every case regresses; row2 is not adopted.
Row4 is slower than row2 on all Q3_K micro widths, so its full-model trial
and the second control are not launched after this screen. No row4
full-model performance claim is made. Source defaults remain off.

The `-r2` name also triggers older generic row metadata in the launcher.
The frozen worker's later PTQ-specific selector overwrites both T143/T11,
so the effective candidate selectors remain T143=0,T11=0, split=both,
interleave=2. The original intent and frozen worker are retained. Comparison
normalizes this superseded metadata only after requiring the explicit later
selector; all other model/input/config fields must match.

Commands: `qualify_xolotl_split_rows_build.py --observe`,
`run_xolotl_split_rows_campaign.py`,
`summarize_xolotl_trial.py --mode single-current-rows-control`,
`summarize_xolotl_trial.py --mode single-current-rows-r2`,
`compare_xolotl_split_rows.py`, `check_xolotl_rows_cleanup.frozen.py`.
All samples, raw token arrivals, exact historical workers and stderr remain.
300 tok/s remains unmet. The previous qualified expert hybrid is preserved;
the transport +1.3343% single pair is not promoted to stable qualification.
'''
 path.write_text(s,encoding='utf-8')
print(json.dumps(dict(retained=True,device_pair_gain_percent=comparison['delta_percent'],cpu_pairs=4,rows_phase=rowbuild.get('phase'),target_300_met=False)))
