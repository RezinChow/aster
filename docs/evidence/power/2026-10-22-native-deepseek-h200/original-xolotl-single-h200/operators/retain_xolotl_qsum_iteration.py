"""Retain the current bounded experiment and make the exact allocation recoverable."""
import base64,hashlib,json,shutil,time
from xolotl_trial_common import BASE,WORK,lease,observe,jump
r=lease();o=observe()
if r['submitted']['uid']!='662c0a01-26eb-4e72-9d39-2e07ef2619c0' or o['job_uid']!=r['submitted']['uid']:raise RuntimeError('cont3 identity differs')
dest=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200';folder=dest/'frozen-qsum/v1';folder.mkdir(parents=True,exist_ok=True)
ops=['prepare_xolotl_ptq_qsum.py','aster_ptq_qsum.cuh','aster_ptq_qsum_iq_kernels.cu','aster_ptq_qsum_parity.cu','xolotl_ptq_qsum_build_worker.py','stage_xolotl_ptq_qsum.py','observe_xolotl_ptq_qsum.py','prepare_xolotl_qsum_model_trials.py','xolotl_qsum_protocol_worker.frozen.py','launch_xolotl_qsum_model_trial.frozen.py','observe_xolotl_qsum_model_trial.frozen.py','compare_xolotl_qsum_model.frozen.py','prepare_xolotl_single500_cont3.py','submit_xolotl_single500_cont3_lease.frozen.py','inspect_xolotl_cont3_startup.py','xolotl_trial_common.py','retain_xolotl_qsum_iteration.py']
ops+=['prepare_xolotl_ptq_qsum_v2.py','aster_ptq_qsum_v2.cuh','aster_ptq_qsum_v2_iq_kernels.cu','stage_xolotl_ptq_qsum_v2.frozen.py','observe_xolotl_ptq_qsum_v2.frozen.py','prepare_xolotl_qsum_v2_model_trials.py','launch_xolotl_qsum_v2_model_trial.frozen.py','observe_xolotl_qsum_v2_model_trial.frozen.py','compare_xolotl_qsum_v2_model.frozen.py']
ops+=['prepare_xolotl_qsum_v2_repeats.py','launch_xolotl_qsum_v2_repeat.frozen.py','observe_xolotl_qsum_v2_repeat.frozen.py','compare_xolotl_qsum_v2_repeats.py','retain_xolotl_frozen_workers.py','retain_xolotl_trial_evidence.py']
ops+=['run_xolotl_qsum_v2_repeats.py','prepare_xolotl_current_profile_v3.py','xolotl_current_profile_v3_worker.frozen.py','launch_xolotl_current_profile_v3.frozen.py','observe_xolotl_current_profile_v3.frozen.py','analyze_xolotl_current_profile_v3.py','summarize_xolotl_current_profile_v3.py']
ops+=['observe_xolotl_current_profile_v3_stats.py','persist_xolotl_profile_v3_findings.py']
for n in ops:shutil.copy2(BASE/n,dest/'operators'/n)
files=['xolotl-ptq-qsum-source-plan.json','xolotl-ptq-qsum-intent.json','xolotl-ptq-qsum-latest.json','xolotl-single500-cont3-lease-pending.json','xolotl-cont3-startup-latest.json','xolotl-trial-resource-latest.json','xolotl-qsum-gu-model-comparison.json','xolotl-qsum-both-model-comparison.json']
files+=['xolotl-ptq-qsum-v2-source-plan.json','xolotl-ptq-qsum-v2-intent.json','xolotl-ptq-qsum-v2-latest.json','xolotl-qsum-v2-gu-model-comparison.json','xolotl-qsum-v2-both-model-comparison.json','xolotl-cont3-gpu-power-clock-readonly.json']
files+=['xolotl-qsum-v2-repeat-campaign.json','xolotl-qsum-v2-repeat-comparison.json','xolotl-public-latest-commit-check.json']
files+=['xolotl-qsum-v2-repeat-progress.json','xolotl-current-profile-v3-statistics-launch.json','xolotl-current-profile-v3-summary.json']
files+=['xolotl-current-profile-v3-statistics-latest.json','xolotl-current-profile-v3-findings.json']
modes=['single-current-qsum-control','single-current-qsum-gu','single-current-qsum-both','single-current-qsum-v2-control','single-current-qsum-v2-gu','single-current-qsum-v2-both']
modes+=['single-current-qsum-v2-gu-b2','single-current-qsum-v2-control-b2','single-current-qsum-v2-control-b3','single-current-qsum-v2-gu-b3']
modes+=['single-current-qsum-v2-profile']
for mode in modes:
 for suffix in ['intent','latest','summary']:files.append('xolotl-'+mode+'-'+suffix+'.json')
for n in files:
 p=BASE/n
 if p.exists():
  if p.stat().st_size>2*1024**2:raise RuntimeError('qsum receipt bound exceeded')
  shutil.copy2(p,dest/n)
build={};builds={}
for version,suffix in [('v1',''),('v2','-v2')]:
 intent=BASE/('xolotl-ptq-qsum'+suffix+'-intent.json')
 if not intent.exists():continue
 folder=dest/('frozen-qsum/'+version);folder.mkdir(parents=True,exist_ok=True)
 m=json.loads(intent.read_text());names=['plan.json','worker.py','process.json','result.json','iq_kernels.original.cu','iq_kernels.cu','iq-qsum.patch','aster_ptq_qsum.cuh','qsum_parity.cu','compile.stderr.log','compile.stdout.log','fixture-compile.stderr.log','fixture-compile.stdout.log','worker.log','controls-0.stdout.log','controls-0.stderr.log','controls-gu.stdout.log','controls-gu.stderr.log','controls-both.stdout.log','controls-both.stderr.log']
 for chunk in [names[:9],names[9:]]:
  code='''from pathlib import Path
import json,base64
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('qsum evidence owner differs')
out={}
for n in @NAMES@:
 p=root/n
 if p.exists():
  if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>2*1024**2:raise RuntimeError('qsum evidence bound differs')
  out[n]=base64.b64encode(p.read_bytes()).decode()
print(json.dumps(out))
'''.replace('@ROOT@',repr(m['root'])).replace('@NAMES@',repr(chunk))
  for n,v in jump(code).items():(folder/n).write_bytes(base64.b64decode(v))
 if (folder/'result.json').exists():
  build=json.loads((folder/'result.json').read_text());builds[version]=dict(phase=build['phase'],passed=build['passed'],strict_cases=build.get('strict_cases'),binaries=build.get('binaries'),finished_unix=build.get('finished_unix'))
updates=dict(current_owned_allocation_intent=str(BASE/'xolotl-single500-cont3-lease-pending.json'),current_owned_resource_proof=str(BASE/'xolotl-trial-resource-latest.json'),current_owned_allocation_phase=o['phase'],current_owned_allocation_resources_reserved=o['phase'] in ['Inqueue','Starting','Running'],current_service_available=False,current_service_intent=None,next_iteration_record=str(BASE/'xolotl-qsum-next-iteration.json'),current_original_engine_candidate_adopted=False,current_selected_qualified_baseline=str(BASE/'qualified-xolotl-single-h200-baseline.json'),single_request_requirement_tok_s=300,single_request_requirement_met=False,broader_single_request_goal_tok_s=500,broader_single_request_goal_met=False)
findings=BASE/'xolotl-current-profile-v3-findings.json'
if findings.exists():updates['next_profile_findings']=str(findings)
trials={}
for mode in modes:
 ip=BASE/('xolotl-'+mode+'-intent.json')
 if not ip.exists():continue
 updates['current_original_engine_trial']=str(ip);updates['current_original_engine_trial_phase']='launched_not_observed'
 p=BASE/('xolotl-'+mode+'-latest.json')
 if p.exists():
  result=json.loads(p.read_text())['result.json'];trials[mode]=dict(phase=result['phase'],requests=len(result['requests']),engine_exit=result.get('engine_exit'),engine_reaped=result.get('engine_reaped'))
  updates['current_original_engine_trial']=str(BASE/('xolotl-'+mode+'-intent.json'));updates['current_original_engine_trial_phase']=result['phase']
  if result['phase'] in ['complete','failed'] and result.get('engine_reaped'):
   updates['last_original_engine_trial_intent']=str(ip);updates['last_original_engine_trial_phase']=result['phase'];updates['current_original_engine_trial']=None;updates['current_original_engine_trial_phase']='no_active_worker'
comparisons={}
for n in ['xolotl-qsum-gu-model-comparison.json','xolotl-qsum-both-model-comparison.json','xolotl-qsum-v2-gu-model-comparison.json','xolotl-qsum-v2-both-model-comparison.json']:
 p=BASE/n
 if p.exists():
  c=json.loads(p.read_text());comparisons[n]=dict(control_tok_s=c['control']['mixed_tok_s'],candidate_tok_s=c['candidate']['mixed_tok_s'],gain_percent=c['mixed_rate_gain_percent'],all17_ids_equal=c['all_17_pairs_ids_equal'],adopted=False)
record=dict(unix=time.time(),milestone_tok_s=300,ultimate_goal_tok_s=500,milestone_met=False,ultimate_goal_met=False,allocation=dict(job=o['job'],job_uid=o['job_uid'],phase=o['phase'],root=r['remote'],replicas=[dict(name=x['name'],uid=x['uid'],phase=x['phase']) for x in o['replicas']],lease_ends_unix=o.get('resource-result.json',{}).get('leaseEndsUnix')),qsum=dict(written=True,built=bool(build.get('binaries')),hardware_controls_passed=build.get('passed',False),phase=build.get('phase','source_prepared'),strict_cases=build.get('strict_cases'),versions=builds,adopted=False,model_speed_qualified=False),trials=trials,comparisons=comparisons,active_worktree_updates=updates)
if findings.exists():record['next_research']=json.loads(findings.read_text())['next_research']
(BASE/'xolotl-qsum-next-iteration.json').write_text(json.dumps(record,indent=2)+'\n');shutil.copy2(BASE/'xolotl-qsum-next-iteration.json',dest/'xolotl-qsum-next-iteration.json')
a=json.loads((BASE/'active-worktree.json').read_text());a.update(updates);(BASE/'active-worktree.json').write_text(json.dumps(a,indent=2)+'\n')
mfile=WORK/'docs/source-manifest.json';manifest=json.loads(mfile.read_text(encoding='utf-8'));manifest['original_xolotl_h200_20261024']['ptq_activation_sum_experiments']=dict(flag='ASTER_XQ_PTQ_QSUM=0|gu|both',default_off=True,model_precision_unchanged=True,parent_iq_sha256='230d47355c244f5d9b0a4a75b08c902579601f6da8391112761275d4b3d9a46a',v1='Exact int32 activation sums once per entry in temporary float-h scratch; extra launch per enabled GU/Down; no LoRA; 5120x2304, PTQ143, R4 only',v2='Exact sums per group entry in640 bytes of shared memory inside the original R4 launch; no extra launch, weight cache or scratch lifetime change; same strict geometry/no-LoRA gate',builds=builds,comparisons=comparisons,adopted=False,target300_met=False,target500_met=False)
mfile.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
repeat=BASE/'xolotl-qsum-v2-repeat-comparison.json'
if repeat.exists():
 data=json.loads(repeat.read_text());manifest['original_xolotl_h200_20261024']['ptq_activation_sum_experiments']['repeat_comparison']=data;mfile.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if findings.exists():
 manifest['original_xolotl_h200_20261024']['current_profile_v3_findings']=json.loads(findings.read_text());mfile.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
outcome=dest.parent/'OUTCOME.md';text=outcome.read_text(encoding='utf-8');marker='### Exact PTQ activation-sum reuse: full-model regressions (2026-10-24)'
if marker not in text and len(comparisons)>=2:
 text+='''

### Exact PTQ activation-sum reuse: full-model regressions (2026-10-24)

The measured eligible expert distribution motivates small-group work. V1
retains the original ternary decoder, per-block FP32 scaling and warp
reductions, and precomputes exact int32 activation-code sums once per entry.
It never divides the rounded q8 half sum by its scale. A default-off closed
operator flag selects0,gu,both; only PTQ143,R4,5120x2304,no-LoRA is eligible.
The temporary float-h scratch is used before GU/SwiGLU or after quantization
before Down. Weights and public APIs do not change.

All39 GPU cases pass: exact GU and final Down floats, identical post-SwiGLU
q8 bytes, finite written outputs, and untouched output/GU sentinel rows.
Cases include empty groups,1/2/3/5/8-entry groups, mixed PTQ/Q3 projections,
arbitrary token and destination maps, more input tokens than entry capacity,
fallback shape, grouped-v1 and separate phase1/phase2 execution.
The new GU uses101 registers versus127 for original R4, both without spills.
Down uses80 for both. Compiler resource savings are not model-speed gains.

The exact same binary gives94.422852 tok/s with the flag off,
91.623769 with GU reuse (-2.964413%), and91.283100 with GU/Down reuse
(-3.325203%). Each profile completes17 serial real-model requests,
exits0 and reaps. Every paired output ID agrees. No variant is adopted.
The small synthetic cases also show the extra launch cost. V2 therefore
moves the exact sum into640 bytes of shared memory in the original block;
its build, numerical gates and separate full-model outcomes are retained
individually. A prepared or numerically correct kernel is not a speed claim.

The first local model launcher encounters a variable-name error before
writing any intent or creating any remote model process. Its corrected
operator is retained. No trial was silently restarted or overwritten.
Neither the300 milestone nor the500 broader goal is achieved here.
'''
 outcome.write_text(text,encoding='utf-8')
marker='### PTQ sum reuse rejected after three paired full-model rounds (2026-10-24)'
if repeat.exists() and marker not in text:
 data=json.loads(repeat.read_text())
 text+=f'''

{marker}

V2 passes another39 exact GPU controls. Its first same-binary GU result is
92.105277 to93.344551 tok/s (+1.345497%); GU/Down is93.669060 (+1.697821%).
These are one-pair observations, not stable gains. Before any repeats, the
ABBAAB order and adoption gate are frozen: three complete17-request pairs,
all51 output pairs equal, every pair positive, and pooled gain at least2%.
The next two GU pairs yield-0.719850% and-0.750808%. All six engines exit0
and reap, with all51 output pairs identical. Pooled rates are
{data['pooled_control_tok_s']:.6f}/{data['pooled_candidate_tok_s']:.6f} tok/s,
{data['pooled_gain_percent']:.6f}%. The predeclared gate fails, so the entire
activation-sum direction remains off. No300/500 milestone is achieved.

The next action is a separate bounded GPU timeline capture of the existing
R4/Q3 configuration with sums off. Its three warmups and one captured prose
request are diagnostics only. Its600-second alarm, exact target PID/start
identity cleanup and separate CPU statistics operator are retained. No
speedup or complete diagnosis is claimed merely from preparing that worker.
'''
 outcome.write_text(text,encoding='utf-8')
marker='### Current R4/Q3 timeline redirects the next experiment (2026-10-24)'
if findings.exists() and marker not in text:
 f=json.loads(findings.read_text());text+=f'''

{marker}

The separately captured existing R4/Q3 profile completes three warmups and
one captured128-token prose request, with a reaped engine. The14206044-byte
trace SHA is7fb4df56b43862e98ef57270782333db7a51d92c96d00469d43696903f382862.
The CPU-only statistics command succeeds, with a34590720-byte SQLite file
passing quick_check. Exact full kernel symbols and counts are retained,
without inferring unknown kernel meanings from word-list categories.

The recorded kernel sum is1254918053 ns. The exact Q3_K expert GU/Down
symbols total203760939 ns ({f['profile']['q3_share_of_recorded_kernel_sum_percent']:.6f}%),
versus147071307 ns ({f['profile']['ptq_share_of_recorded_kernel_sum_percent']:.6f}%)
for the PTQ143 R4 GU/Down symbols. Individual Q8 dense specializations are
also among the largest recorded kernels. The capture records188813 kernels,
45919 copies and9561 cudaStreamSynchronize calls. Recorded GPU busy union
is1293497751 ns across2020980987 ns of recorded event span. Nsight warns
that driver13.2 is unsupported by its12.9 collection libraries and not all
events may be collected. These are diagnostic recorded events, not exact
hardware utilization. API waits overlap GPU execution and are not added to
GPU time, and the profiled token rate is not a service performance claim.

An explicitly untested next hypothesis isolates Q3_K row interleaving while
retaining PTQ R4 and split11. The historical row experiment simultaneously
replaced the PTQ path, so it did not settle that isolated question. Its
exact current13-case GPU fixture and same-binary full-model gates must pass
before any claimed gain. Larger dense and host synchronization execution
changes remain necessary research; no300/500 feasibility or speed ceiling
is established by this capture. No further PTQ-sum variant is planned.
''';outcome.write_text(text,encoding='utf-8')
profile_intent=BASE/'xolotl-single-current-qsum-v2-profile-intent.json'
if profile_intent.exists():
 pr=json.loads(profile_intent.read_text());pf=dest/'frozen-qsum/profile-v3';pf.mkdir(parents=True,exist_ok=True)
 names=['plan.json','worker.py','process.json','result.json','profile_target.py','profile-target-process.json','nsys-launch-process.json','nsys-start.log','nsys-stop.log','statistics-worker.py','statistics-launch.json','statistics-result.json','statistics-worker.log','stats.stdout.log','stats.stderr.log','statistics_cuda_api_sum.csv','statistics_cuda_gpu_kern_sum.csv','statistics_cuda_gpu_mem_time_sum.csv','statistics_cuda_gpu_mem_size_sum.csv']
 code='''from pathlib import Path
import json,base64,hashlib
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('profile retention owner differs')
out={}
for n in @NAMES@:
 p=root/n
 if not p.exists():continue
 if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>2*1024**2:raise RuntimeError('profile retention bound exceeded')
 raw=p.read_bytes()
 if n=='worker.py' and hashlib.sha256(raw).hexdigest()!=@SHA@:raise RuntimeError('profile frozen worker differs')
 out[n]=base64.b64encode(raw).decode()
print(json.dumps(out))
'''.replace('@ROOT@',repr(pr['root'])).replace('@NAMES@',repr(names)).replace('@SHA@',repr(pr['worker_sha256']))
 for n,v in jump(code).items():(pf/n).write_bytes(base64.b64decode(v))
print(json.dumps(dict(saved=True,allocation_phase=o['phase'],qsum=record['qsum'],trials=trials)))
