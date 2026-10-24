"""Retain completed failed optimizations and the current requested milestone."""
import json,shutil
from xolotl_trial_common import BASE,WORK
dest=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200'
for name in ['xolotl-current-milestone.json','xolotl-q8-round-comparison.json','xolotl-conf300-round-comparison.json','xolotl-conf300-pair-campaign.json','xolotl-trial-cleanup-conf300-controls.json','xolotl-pair-retired-for-single300.json','xolotl-single300-lease-pending.json']:
 p=BASE/name
 if p.exists():
  if p.stat().st_size>2*1024**2:raise RuntimeError('milestone evidence bounds exceeded')
  shutil.copy2(p,dest/name)
for name in ['retain_xolotl_300_milestone.py','prepare_xolotl_single300_lease.py','submit_xolotl_single300_lease.frozen.py','retire_xolotl_pair_for_single300.py','check_xolotl_mtp_jump_network.py']:
 if (BASE/name).is_file():shutil.copy2(BASE/name,dest/'operators'/name)
path=WORK/'docs/source-manifest.json';m=json.loads(path.read_text(encoding='utf-8'));x=m['original_xolotl_h200_20261024']
x['current_milestone']=dict(target_single_gpu_single_request_decode_tok_s=300,achieved=False,user_instruction='先做到单卡300 token/s',basis='93.417856 pooled serial tok/s for the qualified expert hybrid; no aggregate substitution')
q=x['dense_q8_candidate'];q.update(v3_numerical_gate_passed=True,v3_full_model_phase='complete',full_model_qualified=False,adopted=False,control_mixed_tok_s=90.26348683806856,candidate_mixed_tok_s=85.87206882685805,delta_percent=-4.865110096055392,paired_request_token_ids_identical=False,single_h200_300_tok_s_qualified=False)
x['lower_draft_confidence_candidate']=dict(default='off',control_confidence=0.45,candidate_confidence=0.20,control_mixed_tok_s=92.07139494193243,candidate_mixed_tok_s=79.48042211696364,delta_percent=-13.675227613212183,paired_request_token_ids_identical=False,adopted=False)
path.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path=dest.parent/'OUTCOME.md';s=path.read_text(encoding='utf-8');marker='### Current single-H200 300 tok/s milestone (2026-10-24)'
if marker not in s:
 s+='''

### Current single-H200 300 tok/s milestone (2026-10-24)

The user now requests 300 tok/s first. This is the current milestone;
historical 500/1000 requirements and failed trials remain in the record.
300 is unmet. Measurement remains serial `(N-1)/(last-first)` token-arrival
intervals; actual context4096, four short prompts, no generated-response reuse.

Q8 V3 real-SM90 controls pass22/22 at the unchanged2e-4 numerical limits
(max relative L2 2.4565e-7); all15 unselected cases are bitwise equal.
Same-binary full-model control/candidate complete17 requests each, exit0
and reap: mixed90.26349 ->85.87207 tok/s (-4.8651%). Code/English/Chinese
token sequences differ, while count and arithmetic agree. It is not adopted;
synthetic equivalence within tolerance does not establish output identity or
broad quality. The exact two-shape MMQ/scale-rounding patches remain default off.

A separate same-binary DSpark threshold pair uses the qualified expert
hybrid, GPU0 only, depth5, PF0. Confidence0.45 ->0.20 yields
92.07139 ->79.48042 mixed tok/s (-13.6752%). The twelve measured samples
per profile include every outlier; all seventeen requests finish, exit0 and
reap. Request token sequences are not all equal. The lower threshold is not
adopted; the previous93.41786 pooled hybrid remains the selected baseline.
Actual worker alarm/SIGTERM controls pass both CPU-only child-reaping cases.

Both full-model pairs preserve frozen workers, stderr, input IDs, all output
IDs, monotonic arrivals, numerical controls and comparison operators. Commands:
`summarize_xolotl_trial.py --mode single-current-q8-mmq`,
`summarize_xolotl_trial.py --mode single-current-split-conf020`,
`summarize_xolotl_trial.py --mode single-current-split-conf045-final`,
`compare_xolotl_conf300.py`, and `check_xolotl_conf300_cleanup.frozen.py`.

The completed two-H200 allocation is stopped only after GPU-idle proof and
reaped trials; its exact job and replica UIDs are terminal before submitting
one new single-H200 allocation. The follow-up has a separate immutable
one-hour lease, restartNever, no overlapping allocation, and no HTTP/key claim.
The platform admits20CPU/220GiB/oneH200 despite requesting40CPU/440GiB;
resource validation and any model load must use the actual admitted limits.

Anonymous HEAD attempts for the original8.42GB higher-precision DSpark
sidecar time out through both compute exec and the dev-jump transport.
No download, completed weight hash, or higher-precision inference is claimed.

Explicitly not claimed: 300 tok/s reached, an upper hardware bound, every
request above100, broad model quality, long-context performance, or a serving
endpoint/API key. No product source flag is promoted by these experiments.
'''
 path.write_text(s,encoding='utf-8')
print(json.dumps(dict(retained=True,current_milestone_tok_s=300,achieved=False)))
