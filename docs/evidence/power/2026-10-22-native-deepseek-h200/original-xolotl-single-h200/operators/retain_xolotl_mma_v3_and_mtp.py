"""Retain explicit-shutdown diagnostics, completed sidecar checks and final trial outcomes."""
import base64,json,shutil
from xolotl_trial_common import BASE,WORK,jump
dest=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200'
r=json.loads((BASE/'xolotl-ptq-mma-integrated-v3-intent.json').read_text());folder=dest/'frozen-mma/integrated-v3';folder.mkdir(parents=True,exist_ok=True)
groups=[['plan.json','worker.py','process.json','result.json','iq-mma.patch','aster_ptq_mma.cuh','iq_kernels.original.cu','iq_kernels.cu','ds41_generate.original.cpp','ds41_generate.cpp','main-shutdown.patch'],['compile.stdout.log','compile.stderr.log','main-compile.stdout.log','main-compile.stderr.log','controls-0.stdout.log','controls-0.stderr.log','controls-1.stdout.log','controls-1.stderr.log','controls-1-diagnostic.stdout.log','controls-1-diagnostic.stderr.log','worker.log']]
for names in groups:
 code='''from pathlib import Path
import json,base64,hashlib
r=@R@;root=Path(r['root']);expected={m['file']:m for m in r['files']};out={}
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('shutdown diagnostic owner differs')
for name in @NAMES@:
 p=root/name
 if not p.exists():continue
 if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>2*1024**2:raise RuntimeError('shutdown diagnostic artifact bound differs')
 raw=p.read_bytes()
 if name in expected and (len(raw)!=expected[name]['bytes'] or hashlib.sha256(raw).hexdigest()!=expected[name]['sha256']):raise RuntimeError('frozen shutdown diagnostic input differs')
 out[name]=base64.b64encode(raw).decode()
print(json.dumps(out))
'''.replace('@R@',repr(r)).replace('@NAMES@',repr(names))
 for name,b64 in jump(code).items():(folder/name).write_bytes(base64.b64decode(b64))
operators=['prepare_xolotl_mma_v3_shutdown.py','xolotl_ptq_mma_integrated_v3_worker.py','aster_ptq_mma_integrated_v3.cuh','stage_xolotl_ptq_mma_integrated_v3.frozen.py','observe_xolotl_ptq_mma_integrated_v3.frozen.py','prepare_xolotl_mma_v3_diagnostic.py','launch_xolotl_mma_v3_diagnostic.frozen.py','observe_xolotl_mma_v3_diagnostic.frozen.py','inspect_xolotl_mma_v3_runtime.frozen.py','inspect_xolotl_mma_v2_runtime.py','summarize_xolotl_group_diagnostic.py','read_xolotl_parent_main_command.py','prepare_xolotl_mtp_resume2.py','resume_xolotl_original_mtp_windows_v2.frozen.py','prepare_xolotl_mtp_comparison.py','compare_xolotl_original_mtp.frozen.py','stage_xolotl_original_mtp.py','observe_xolotl_original_mtp_stage.py','retain_xolotl_mma_v3_and_mtp.py']
for name in operators:shutil.copy2(BASE/name,dest/'operators'/name)
files=['xolotl-ptq-mma-integrated-v3-intent.json','xolotl-ptq-mma-integrated-v3-latest.json','xolotl-parent-main-compile-command.json','xolotl-mma-v2-runtime-inspection.json','xolotl-mma-v3-runtime-inspection.json','xolotl-mma-v3-group-diagnostic.json','xolotl-original-mtp-windows-resume2-intent.json','xolotl-original-mtp-windows-resume2-latest.json','xolotl-original-mtp-stage-intent.json','xolotl-original-mtp-stage-latest.json','xolotl-original-mtp-model-comparison.json','xolotl-hostthreads-4-comparison.json','xolotl-trial-resource-latest.json']
for name in files:
 p=BASE/name
 if p.exists():
  if p.stat().st_size>2*1024**2:raise RuntimeError('current research receipt bound differs')
  shutil.copy2(p,dest/name)
for mode in ['single-current-mma-v2-original-mtp','single-current-mma-v3-diagnostic','single-current-hostthreads-1','single-current-hostthreads-4']:
 for suffix in ['intent','latest','summary']:
  p=BASE/('xolotl-'+mode+'-'+suffix+'.json')
  if p.exists():shutil.copy2(p,dest/p.name)
result=json.loads((folder/'result.json').read_text());hist=json.loads((BASE/'xolotl-mma-v3-group-diagnostic.json').read_text());mtp=json.loads((BASE/'xolotl-original-mtp-model-comparison.json').read_text(encoding='utf-8'));upload=json.loads((BASE/'xolotl-original-mtp-stage-latest.json').read_text())['result.json']
mfile=WORK/'docs/source-manifest.json';m=json.loads(mfile.read_text(encoding='utf-8'));section=m['original_xolotl_h200_20261024']
section['ptq_mma_merged_experiment']['v2_serve_histogram_available']=False
section['ptq_mma_merged_experiment']['v2_missing_histogram_cause']='native serve deliberately uses std::_Exit(0), bypassing atexit; absence was not evidence of a missed kernel gate'
section['ptq_group_diagnostic_v3']=dict(binary=result['binaries']['ds41_generate'],original_main_sha256=result['original_main_sha256'],patched_main_sha256=result['patched_main_sha256'],header_sha256=result['mma_header_sha256'],strict_control_cases=18,controls_passed=result['passed'],explicit_dump_before_tier_close_and_exit=True,process_wide_eligible_ptq_groups=hist,performance_claimed=False,adopted=False)
section['original_mtp_verified_experiment']=dict(revision='c66fada630aba9123bd6011731fa83c267027122',bytes=8421868640,sha256='6f3d5b8611ddb3954bb89c09e8890806225715fea90868a6d7ec0ffee5c72082',windows_verified=True,server_verified=upload['verified'],server_path=upload['path'],same_binary_control_tok_s=mtp['control']['mixed_tok_s'],candidate_tok_s=mtp['candidate']['mixed_tok_s'],gain_percent=mtp['mixed_rate_gain_percent'],all_17_pairs_ids_equal=mtp['all_17_pairs_ids_equal'],adopted=False,target_300_met=False,target_500_met=False)
thread=json.loads((BASE/'xolotl-hostthreads-4-comparison.json').read_text());single=json.loads((BASE/'xolotl-single-current-hostthreads-1-latest.json').read_text())['result.json']
section['host_thread_screens']=dict(threads16_control_tok_s=thread['control']['mixed_tok_s'],threads4_tok_s=thread['candidate']['mixed_tok_s'],threads4_gain_percent=thread['mixed_rate_gain_percent'],threads4_all_17_ids_equal=thread['all_17_pairs_ids_equal'],threads1_phase=single['phase'],threads1_requests=len(single['requests']),threads1_engine_reaped=single.get('engine_reaped'),threads1_engine_exit=single.get('engine_exit'),threads1_decode_rate_qualified=False,selected_threads=16)
mfile.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path=dest.parent/'OUTCOME.md';s=path.read_text(encoding='utf-8');marker='### Explicit shutdown diagnostics and original MTP result (2026-10-24)'
if marker not in s:
 s+=f'''

{marker}

The initial merged-kernel real-model diagnostic finished successfully but
did not print its atexit counter. Pinned native serve intentionally calls
`std::_Exit(0)` to avoid a detached stdin reader holding cin's teardown lock.
The missing counter does not establish that the new kernel was not executed.
V3 retains that shutdown policy and dumps the GPU aggregate explicitly before
tier.close, with a diagnostic-only device synchronization. Default timing
profiles have diagnostics off. Original/patched main sources, exact parent
C++ compile command, links, header and hashes are retained. All18 numerical
and exact synthetic histogram checks pass again. The17-request real-model
diagnostic exits0, reaps, and has identical output IDs to control.

Its actual eligible PTQ groups are {hist['groups']},
{hist['total_logical_groups']} logical groups and{hist['entries']} entries.
{hist['groups_below4_percent']:.6f}% of groups and
{hist['entries_in_groups_below4_percent']:.6f}% of entries belong to groups
below4. This is process-wide type143,5120x2304,R4,no-LoRA execution,
including any startup, prompt and decode calls. Bin8 means8or more.
It is not an exclusive decode histogram or token-rate qualification.
The next kernel work should prioritize those small groups; uniform-window5
or8 microbenchmarks do not represent their distribution.

The first3600-second resume ends at8321500432 bytes with curl28. Its exact
handle is terminal before a separate300-second continuation resumes the
last100368208 bytes. Complete Windows SHA256 matches the pinned8421868640-byte
file. A fresh private GPFS directory receives one SCP upload; its independent
whole-file SHA matches before atomic publication. Both source/transfer/hash
workers and receipts are retained. The main model was already present.

On the exact same binary and main-model inputs, Q2_K/original MTP rates are
{mtp['control']['mixed_tok_s']:.6f}/{mtp['candidate']['mixed_tok_s']:.6f} tok/s
({mtp['mixed_rate_gain_percent']:.6f}%). Each finishes17 requests with exit0
and a reaped engine; all17 token sequences equal: {mtp['all_17_pairs_ids_equal']}.
This whole-profile comparison also includes the changed draft footprint and
acceptance. It is not a gain, and Q2_K stays selected. Original precision is
not assumed faster. No300/500 milestone is met.

The same-binary16/four-host-thread screen gives
{thread['control']['mixed_tok_s']:.6f}/{thread['candidate']['mixed_tok_s']:.6f}
tok/s ({thread['mixed_rate_gain_percent']:.6f}%), all17 output pairs equal.
The one-thread screen reaches its300-second alarm during loading, before
READY or any request, and exits with a reaped engine ({single.get('engine_exit')}).
No one-thread decode speed exists. Sixteen threads remain selected.
''';path.write_text(s,encoding='utf-8')
print(json.dumps(dict(retained=True,diagnostic_groups=hist['total_logical_groups'],original_mtp_server_verified=True,adopted=False,target_met=False)))
