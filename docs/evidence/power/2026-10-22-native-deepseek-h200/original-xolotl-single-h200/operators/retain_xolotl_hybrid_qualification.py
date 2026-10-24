import hashlib,json,shutil,subprocess,sys
from xolotl_trial_common import BASE,WORK
dest=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200'
comparison=json.loads((BASE/'xolotl-split-round-comparison.json').read_text())
if comparison['phase']!='complete' or len(comparison['pairs'])!=3 or not all(p['all_request_id_parity'] and all(v>0 for v in p['per_case_gain_percent'].values()) for p in comparison['pairs']):raise RuntimeError('hybrid paired qualification incomplete')
profiles=['single-current-split-control','single-current-split-both','single-current-split-control-b2','single-current-split-hybrid','single-current-split-control-b3','single-current-split-hybrid-b2','single-current-split-control-b4','single-current-split-hybrid-b3']
for mode in profiles:
 p=subprocess.run([str(BASE/'xq-fixture-venv/Scripts/python.exe'),'-X','utf8',str(BASE/'summarize_xolotl_trial.py'),'--mode',mode],cwd=BASE,capture_output=True,text=True,timeout=20)
 if p.returncode:raise RuntimeError('retained tokenizer summary failed: '+p.stderr[-1000:])
baseline=json.loads((BASE/'xolotl-single-current-split-hybrid-b3-intent.json').read_text())['plan']
qualified=dict(schema='aster-xolotl-single-h200-optimization-baseline-v1',profile='PTQ1_0 R4 plus Q3_K decode once',plan=baseline,default_source_flags_promoted=False,following_trial_baseline=True,observed_serial_mixed_tok_s=comparison['hybrid_pooled_serial']['weighted_decode_tok_s'],all_paired_request_ids_equal=True,paired_requests=51,total_requests=102,scope='Four short prompts, nine measured requests per case across three process pairs; actual ctx4096; one request at a time; prefix reuse; no completion reuse',single_request_requirement_tok_s=500,single_request_requirement_met=False,http_service_available=False)
(BASE/'qualified-xolotl-single-h200-baseline.json').write_text(json.dumps(qualified,indent=2)+'\n')
manifest=WORK/'docs/source-manifest.json';m=json.loads(manifest.read_text(encoding='utf-8'));q=m['original_xolotl_h200_20261024']['decode_once_candidate']
q.update(full_model_speed_qualified=True,full_model_qualification_scope=qualified['scope'],selected_profile=qualified['profile'],alternating_pairs=3,paired_request_id_matches=51,observed_mixed_gain_percent=comparison['pooled_gain_percent'],default='off',single_h200_500_tok_s_qualified=False)
manifest.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for name in ['xolotl-split-round-comparison.json','qualified-xolotl-single-h200-baseline.json','xolotl-alternating-campaign.json','xolotl-trial-cleanup-controls.json','xolotl-h200-q8-mmq.patch','xolotl-h200-q8-control.patch','xolotl-h200-q8-mmq-plan.json']:
 if (BASE/name).is_file():shutil.copy2(BASE/name,dest/name)
for name in ['retain_xolotl_hybrid_qualification.py','prepare_xolotl_q8_patch.py','stage_xolotl_q8_build.py','launch_xolotl_q8_build.py','observe_xolotl_q8_build.py','qualify_xolotl_q8_build.py']:
 if (BASE/name).is_file():shutil.copy2(BASE/name,dest/'operators'/name)
outcome=dest.parent/'OUTCOME.md';s=outcome.read_text(encoding='utf-8');marker='### Xolotl hybrid profile: three alternating pairs (2026-10-24)'
if marker not in s:
 s+='''

### Xolotl hybrid profile: three alternating pairs (2026-10-24)

All-on decode-once first observes 80.5859 -> 83.7121 mixed serial tok/s
(+3.88%), but code regresses 4.65%; it is not selected. The hybrid keeps
PTQ1_0 on existing R4 (`STRATA_EXP_MODE_T143=4`) and selects Q3_K's new
decode-once kernel (`STRATA_EXP_MODE_T11=0 ASTER_XQ_SPLIT_MMVQ=11`). Q2_0,
routes, experts, activations and weights are preserved. The exact same
`e9433050...` binary runs all new controls/candidates, GPU0 only.

Three independent process pairs alternate C/H, C/H, C/H, each one warmup
and three measured requests for four public prompts plus arithmetic. Mixed
rates C/H: 81.8408/91.8142 (+12.19%), 84.5981/95.6128 (+13.02%),
84.9996/92.9078 (+9.30%). All four cases improve in every pair; all 51
paired request ID sequences are equal (102 total requests). Every process
exits0 and is reaped. Serial pooling of all measured N-1 token intervals:
83.7891 -> 93.4179 tok/s (+11.49%). Count/code/English/Chinese controls:
112.0719/98.6990/69.7455/82.8520; hybrid:
129.3948/110.8107/78.3789/90.4377 tok/s. Raw outliers remain; code minimum
88.8027, so this does not even claim every measured request exceeds100.

This hybrid is selected only as the following experiment baseline. Source
flags remain off by default; no HTTP service or key is delivered. The active
single-request 500 tok/s requirement remains unmet. Short repeated-prompt
equality is not long-context or broad model quality qualification.

The protocol operator now has a 900-second trial alarm and a 950-second outer
deadline within the immutable resource lease, plus SIGTERM cleanup. Two owned
CPU-only child-process controls exercise the exact worker handler/finally for
alarm and termination: both reaped their child and closed its pidfd. The
tested worker SHA256 equals the hybrid's frozen worker; no GPU work is
claimed for these lifecycle controls. All historical operators remain frozen.

Next bounded candidate, still unbuilt/unqualified at preparation: default-off
SM90 Q8_0 dense projections at widths2..8 select ggml MMQ instead of MMVQ.
It does not transcode weights; TensorCore accumulation/activation rounding
may differ, so paired finite numerical controls and full-model output/quality
review are required. No bitwise, speed or 500 tok/s claim is made for it.
'''
 outcome.write_text(s,encoding='utf-8')
print(json.dumps(dict(qualified_profile=qualified['profile'],mixed_tok_s=qualified['observed_serial_mixed_tok_s'],gain_percent=comparison['pooled_gain_percent'],goal_complete=False)))
