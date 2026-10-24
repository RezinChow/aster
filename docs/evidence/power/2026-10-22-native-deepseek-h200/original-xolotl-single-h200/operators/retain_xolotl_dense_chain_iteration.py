"""Retain Q3 rejection, async sources/builds and exact current allocation recovery."""
import json,base64,hashlib,shutil,time,difflib
from xolotl_trial_common import BASE,WORK,lease,observe,jump
r=lease();o=observe()
if r['submitted']['uid']!='b226d64c-28cc-4f38-94d0-a02688df6133' or o['job_uid']!=r['submitted']['uid']:raise RuntimeError('dense-chain continuation identity differs')
d=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200';folder=d/'frozen-dense-chain';folder.mkdir(parents=True,exist_ok=True)
ops=['stage_xolotl_q3_isolated_controls.py','observe_xolotl_q3_isolated_controls.py','inspect_xolotl_dense_parent.py','aster_dense_async_fence.hpp','aster_dense_async_fence_test.cpp','prepare_xolotl_dense_async_chain.py','aster_dense_async_chain.cpp','prepare_xolotl_dense_async_chain_v2.py','aster_dense_async_chain_v2.cpp','xolotl_dense_chain_build_worker.py','stage_xolotl_dense_async_chain.py','stage_xolotl_dense_async_chain_v2.frozen.py','observe_xolotl_dense_chain_build.py','observe_xolotl_dense_chain_v2_build.frozen.py','prepare_xolotl_dense_chain_trials.py','xolotl_dense_chain_protocol_worker.frozen.py','launch_xolotl_dense_chain_trial.frozen.py','observe_xolotl_dense_chain_trial.frozen.py','compare_xolotl_dense_chain.frozen.py','prepare_xolotl_single500_cont4.py','submit_xolotl_single500_cont4_lease.frozen.py','xolotl_trial_common.py','retain_xolotl_dense_chain_iteration.py']
ops+=['inspect_xolotl_dense_chain_runtime.py','inspect_xolotl_cont4_startup.py','retain_xolotl_trial_evidence.py','retain_xolotl_frozen_workers.py']
ops+=['prepare_xolotl_dense_async_chain_v3.py','aster_dense_async_chain_v3.cpp','stage_xolotl_dense_async_chain_v3.frozen.py','observe_xolotl_dense_chain_v3_build.frozen.py','aster_dense_external_readback_test.cu','stage_xolotl_dense_external_regression.py','prepare_xolotl_dense_chain_v3_trials.py','launch_xolotl_dense_chain_v3_trial.frozen.py','observe_xolotl_dense_chain_v3_trial.frozen.py','compare_xolotl_dense_chain_v3.frozen.py','inspect_xolotl_dense_chain_v3_runtime.py','prepare_xolotl_dense_chain_v3_repeats.py','launch_xolotl_dense_chain_v3_repeat.frozen.py','launch_xolotl_dense_chain_v3_repeat_v2.frozen.py','observe_xolotl_dense_chain_v3_repeat.frozen.py','inspect_xolotl_dense_chain_v3_repeat_runtime.py','compare_xolotl_dense_chain_v3_repeats.py','run_xolotl_dense_chain_v3_repeats.py','run_xolotl_dense_chain_v3_repeats_v2.py','repair_xolotl_dense_repeat_preflight_v2.py']
ops+=['report_xolotl_dense_chain_v3_pair.py','qualify_xolotl_dense_chain_v3.py']
for n in ops:shutil.copy2(BASE/n,d/'operators'/n)
files=['xolotl-q3-isolated-controls-intent.json','xolotl-q3-isolated-controls-latest.json','xolotl-dense-chain-parent.json','xolotl-dense-async-chain-source-plan.json','xolotl-dense-async-chain-v2-source-plan.json','xolotl-dense-chain-build-intent.json','xolotl-dense-chain-build-latest.json','xolotl-dense-chain-v2-build-intent.json','xolotl-dense-chain-v2-build-latest.json','xolotl-single500-cont3-terminal-proof.json','xolotl-single500-cont4-lease-pending.json','xolotl-trial-resource-latest.json','xolotl-dense-chain-normal-comparison.json','xolotl-dense-chain-stress-comparison.json']
modes=['single-current-dense-chain-control','single-current-dense-chain-candidate','single-current-dense-chain-stress-control','single-current-dense-chain-stress-candidate']
modes+=['single-current-dense-chain-v3-control','single-current-dense-chain-v3-candidate','single-current-dense-chain-v3-stress-control','single-current-dense-chain-v3-stress-candidate','single-current-dense-chain-v3-candidate-b2','single-current-dense-chain-v3-control-b2','single-current-dense-chain-v3-control-b3','single-current-dense-chain-v3-candidate-b3']
files+=['xolotl-dense-async-chain-v3-source-plan.json','xolotl-dense-chain-v3-build-intent.json','xolotl-dense-chain-v3-build-latest.json','xolotl-dense-external-regression-intent.json','xolotl-dense-external-regression-result.json','xolotl-dense-chain-v3-normal-comparison.json','xolotl-dense-chain-v3-stress-comparison.json','xolotl-dense-chain-v3-repeat-campaign.json','xolotl-dense-chain-v3-repeat-progress.json','xolotl-dense-chain-v3-repeat-progress-v2.json','xolotl-dense-chain-v3-repeat-comparison.json']
files+=['xolotl-dense-chain-v3-pair2-interim.json','qualified-xolotl-dense-chain-v3-optimization-baseline.json']
for mode in modes:
 for suffix in ['intent','latest','summary','runtime']:files.append('xolotl-'+mode+'-'+suffix+'.json')
for n in files:
 p=BASE/n
 if p.exists():
  if p.stat().st_size>2*1024**2:raise RuntimeError('dense receipt bound exceeded')
  shutil.copy2(p,d/n)
builds={}
for key,intent_name in [('q3-only','xolotl-q3-isolated-controls-intent.json'),('v1','xolotl-dense-chain-build-intent.json'),('v2','xolotl-dense-chain-v2-build-intent.json'),('v3','xolotl-dense-chain-v3-build-intent.json')]:
 p=BASE/intent_name
 if not p.exists():continue
 intent=json.loads(p.read_text());target=folder/key;target.mkdir(parents=True,exist_ok=True)
 names=['plan.json','worker.py','process.json','result.json','worker.log','ds41_dense.cpp','aster_dense_async_fence.hpp','fence_test.cpp','compile.stdout.log','compile.stderr.log','host-test-compile.stdout.log','host-test-compile.stderr.log','host-test.stdout.log','host-test.stderr.log','link.stdout.log','link.stderr.log','rows0.stdout.log','rows0.stderr.log','rows2.stdout.log','rows2.stderr.log','rows4.stdout.log','rows4.stderr.log']
 for chunk in [names[:8],names[8:]]:
  code='''from pathlib import Path
import json,base64,hashlib
r=@R@;root=Path(r['root']);out={};inputs={m['file']:m for m in r['files']}
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('dense retained root differs')
for n in @NAMES@:
 p=root/n
 if not p.exists():continue
 if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>512*1024:raise RuntimeError('dense retained artifact bound differs')
 raw=p.read_bytes()
 if n in inputs and (len(raw)!=inputs[n]['bytes'] or hashlib.sha256(raw).hexdigest()!=inputs[n]['sha256']):raise RuntimeError('dense frozen input differs')
 out[n]=base64.b64encode(raw).decode()
print(json.dumps(out))
'''.replace('@R@',repr(intent)).replace('@NAMES@',repr(chunk))
  for n,b in jump(code).items():(target/n).write_bytes(base64.b64decode(b))
 if (target/'result.json').exists():
  q=json.loads((target/'result.json').read_text());builds[key]=dict(phase=q['phase'],passed=q['passed'],host_fence_tests_passed=q.get('hermetic_fence_tests_passed'),strict_gpu_cases=q.get('strict_cases'),binary=q.get('binary'),performance_claimed=False)
original=(BASE/'xolotl-dense-chain-parent.cpp').read_text();patched=(BASE/'aster_dense_async_chain_v2.cpp').read_text();(folder/'ds41_dense.original.cpp').write_text(original);(folder/'dense-chain-v2.patch').write_text(''.join(difflib.unified_diff(original.splitlines(True),patched.splitlines(True),fromfile='a/tools/v41/engine/ds41_dense.cpp',tofile='b/tools/v41/engine/ds41_dense.cpp')))
patched=(BASE/'aster_dense_async_chain_v3.cpp').read_text();(folder/'dense-chain-v3.patch').write_text(''.join(difflib.unified_diff(original.splitlines(True),patched.splitlines(True),fromfile='a/tools/v41/engine/ds41_dense.cpp',tofile='b/tools/v41/engine/ds41_dense.cpp')))
updates=dict(current_owned_allocation_intent=str(BASE/'xolotl-single500-cont4-lease-pending.json'),current_owned_resource_proof=str(BASE/'xolotl-trial-resource-latest.json'),current_owned_allocation_phase=o['phase'],current_owned_allocation_resources_reserved=o['phase'] in ['Inqueue','Starting','Running'],current_service_available=False,current_service_intent=None,current_original_engine_trial=None,current_original_engine_trial_phase='no_active_worker',current_original_engine_candidate_adopted=False,current_selected_qualified_baseline=str(BASE/'qualified-xolotl-single-h200-baseline.json'),next_iteration_record=str(BASE/'xolotl-dense-chain-next-iteration.json'),local_original_mtp_download_record=str(BASE/'xolotl-original-mtp-windows-resume2-latest.json'),server_original_mtp_verified_record=str(BASE/'xolotl-original-mtp-stage-latest.json'),single_request_requirement_tok_s=300,single_request_requirement_met=False,broader_single_request_goal_tok_s=500,broader_single_request_goal_met=False)
trials={}
for mode in modes:
 ip=BASE/('xolotl-'+mode+'-intent.json');p=BASE/('xolotl-'+mode+'-latest.json')
 if not ip.exists():continue
 updates['current_original_engine_trial']=str(ip);updates['current_original_engine_trial_phase']='launched_not_observed'
 if p.exists():
  q=json.loads(p.read_text())['result.json'];trials[mode]=dict(phase=q['phase'],requests=len(q['requests']),engine_exit=q.get('engine_exit'),engine_reaped=q.get('engine_reaped'))
  updates['current_original_engine_trial_phase']=q['phase']
  if q['phase'] in ['complete','failed'] and q.get('engine_reaped'):updates.update(current_original_engine_trial=None,current_original_engine_trial_phase='no_active_worker',last_original_engine_trial_intent=str(ip),last_original_engine_trial_phase=q['phase'])
comparisons={}
for kind in ['normal','stress','v3-normal','v3-stress','v3-repeat']:
 p=BASE/('xolotl-dense-chain-'+kind+'-comparison.json')
 if p.exists():
  q=json.loads(p.read_text());comparisons[kind]={k:v for k,v in q.items() if k!='paired_requests'}
runtime={}
for mode in modes:
 p=BASE/('xolotl-'+mode+'-runtime.json')
 if p.exists():runtime[mode]=json.loads(p.read_text())
gpu_quality=all(k in comparisons and comparisons[k]['all_paired_ids_equal'] for k in ['v3-normal','v3-stress'])
updates.update(current_dense_chain_comparison=str(BASE/'xolotl-dense-chain-v3-normal-comparison.json') if 'v3-normal' in comparisons else None,current_mma_model_comparison=None,latest_owned_gpu_idle_proof=None)
serving=BASE/'xolotl-serving-active-state-updates.json'
if serving.exists():updates.update(json.loads(serving.read_text()))
qualified=BASE/'qualified-xolotl-dense-chain-v3-optimization-baseline.json'
optimization_baseline=json.loads(qualified.read_text()) if qualified.exists() else None
if optimization_baseline:updates.update(current_optimization_qualified_baseline=str(qualified),current_optimization_baseline_gain_percent=optimization_baseline['paired_gain_percent'],current_original_engine_candidate_adopted_for_optimization=True,current_serving_qualified_baseline=str(BASE/'qualified-xolotl-single-h200-baseline.json'))
record=dict(unix=time.time(),milestone300_met=False,goal500_met=False,allocation=dict(job=o['job'],job_uid=o['job_uid'],root=r['remote'],phase=o['phase'],replicas=[dict(name=x['name'],uid=x['uid'],phase=x['phase']) for x in o['replicas']],lease_ends_unix=o.get('resource-result.json',{}).get('leaseEndsUnix')),builds=builds,trials=trials,comparisons=comparisons,runtime_proofs=runtime,gpu_quality_passed=gpu_quality,adopted=False,next_action='Require the actual deferred-finish log and normal17-request paired output identity. Complete separate9-request allocator/cache stress with actual cache-reset evidence before adoption. Repeat any positive rate on the same allocation, binary and prompts. A negative or mismatching result rejects this candidate. Never infer500/300 from host tests, a single small timing gain or removed sync counts.',active_worktree_updates=updates)
(BASE/'xolotl-dense-chain-next-iteration.json').write_text(json.dumps(record,indent=2)+'\n');shutil.copy2(BASE/'xolotl-dense-chain-next-iteration.json',d/'xolotl-dense-chain-next-iteration.json')
if optimization_baseline:
 record.update(adopted_as_optimization_baseline=True,serving_promoted=False,qualified_optimization_baseline=optimization_baseline,next_action='Use the qualified V3 async chain as the next optimization control; retain the independent stable API on e9433050. Optimize dense Q8 or broader GPU execution based on the actual profile rather than more PTQ micro-tuning. Current immutable cont4 ends1792840251.469; only replace its optimization allocation after exact job AND replica terminal proof, keeping at most one serving and one optimization H200. Never change the serving allocation via the optimization transport. Milestone300 and full500 remain unmet.')
 (BASE/'xolotl-dense-chain-next-iteration.json').write_text(json.dumps(record,indent=2)+'\n');shutil.copy2(BASE/'xolotl-dense-chain-next-iteration.json',d/'xolotl-dense-chain-next-iteration.json')
a=json.loads((BASE/'active-worktree.json').read_text());a.update(updates);(BASE/'active-worktree.json').write_text(json.dumps(a,indent=2)+'\n')
mfile=WORK/'docs/source-manifest.json';m=json.loads(mfile.read_text(encoding='utf-8'));section=m['original_xolotl_h200_20261024'];section['q3_only_row_screen']=dict(fixed_ptq_mode=4,fixed_q3_mode=0,fixed_split_mmvq='11',qsum_off=True,strict_cases=builds.get('q3-only',{}).get('strict_gpu_cases'),passed=builds.get('q3-only',{}).get('passed'),full_model_gain_claimed=False,adopted=False)
section['dense_async_chain_experiment']=dict(parent_source_sha256='1773c49096f1634258e5c04ad48042d9db2d8d0353f1a749de2d169859250096',v2_source_sha256=hashlib.sha256((BASE/'aster_dense_async_chain_v2.cpp').read_bytes()).hexdigest(),v3_source_sha256=hashlib.sha256((BASE/'aster_dense_async_chain_v3.cpp').read_bytes()).hexdigest(),flag='ASTER_XQ_DENSE_ASYNC_CHAIN=0|1',default_off=True,changes_model_math=False,builds=builds,trials=trials,comparisons=comparisons,runtime_proofs=runtime,adopted=False,gpu_quality_passed=gpu_quality,performance_claimed=False,target300_met=False,target500_met=False);mfile.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if optimization_baseline:
 section['dense_async_chain_experiment'].update(qualified_prototype_version=3,adopted_as_optimization_baseline=True,serving_promoted=False,qualified_optimization_baseline=optimization_baseline)
 mfile.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path=d.parent/'OUTCOME.md';text=path.read_text(encoding='utf-8');marker='### Q3-only rejection and asynchronous dense-chain prototype (2026-10-24)'
if marker not in text:
 text+='''

### Q3-only rejection and asynchronous dense-chain prototype (2026-10-24)

A39-case exact current-fixture screen keeps PTQ143 R4, Q3_K mode0, split11
and sums off, while selecting only Q3 row0/2/4. Every GU/Down float, q8 byte,
finite and sentinel check passes. In the heterogeneous mixed-format cases,
Q3 Down whole-call times are306.732819/306.783997/314.862396 us; Q3 GU
times are308.489624/313.998413/398.291199 us. These cases give no useful
positive signal, so neither variant is taken to another full-model screen.
The scope is those actual synthetic cases, not an all-Q3 speed ceiling.

The source-linked next prototype instead queues persistent single-sequence
CUDA finish and same-backend attention work before the existing route
readback fence. It is default off, preserves weights/math and the tier's
cross-stream fence, and drains pending work before non-reusable allocator
operations, pass/whole graph-cache invalidation and destruction. V2 also
drains any partial failed graph submission before returning an error.
Caller-owned finish graphs, multiple slots and row-mode finish stay on
the existing synchronous path. Exact source, compiler, archive substitution,
private build result and hermetic lifetime-order test output are retained.
V1 was compiled/host-tested only and is superseded before any live-model use.

Host tests are not GPU correctness or performance evidence. Before adoption,
V2 needs paired17-request full-model output identity, actual candidate-path
activation, separate allocator/cache stress and repeated timing if positive.
Cont3 job and replica both complete before one bounded cont4 request is
submitted; no immutable lease extension or overlapping GPU allocation occurs.
No300 or500 token/s result is claimed here.
''';path.write_text(text,encoding='utf-8')
print(json.dumps(dict(saved=True,allocation_phase=o['phase'],builds=builds,trials=trials,adopted=False)))
if optimization_baseline:
 text=path.read_text(encoding='utf-8');marker='### Dense-chain V3 paired improvement and scope (2026-10-24)'
 if marker not in text:
  text+='''

### Dense-chain V3 paired improvement and scope (2026-10-24)

V2's first full-model pair regresses95.1364->86.6998 token/s (-8.8678%)
and changes8 of17 output sequences. It is rejected, never served. Source
inspection locates a missing dependency when DSpark immediately reads state
on a different CUDA stream after queued finish. An actual SM90 regression
reproduces6 stale reads without the fence and6 exact reads with it. V3 adds
explicit external state-access fences as well as the allocator/cache and
destructor guards. The failed local repeat preflight (missing a profile
lookup, before any model intent or GPU launch) is preserved; corrected V2
operators run the unchanged predeclared campaign.

The three same-binary V3 flag0/1 pairs are93.4120->94.8655 (+1.55597%),
93.3228->94.8060 (+1.58932%), and93.3988->96.4520 (+3.26894%) token/s.
Pooled rates are93.377857->95.368418 (+2.131727%). All51 paired sequences
match; all6 engines exit0 and are reaped after102 requests. The predeclared
each-pair-positive and pooled>=2% gate passes. Separate allocator-reuse-off
and256MiB cache stress runs9 requests per side, causes2 actual pass-cache
resets per process, preserves all9 paired sequences and reaps both engines.
Its86.1235->86.3840 (+0.30246%) timing is diagnostic only.

The qualified V3 receipt is promoted as the next optimization control only.
The independent stable API continues to use the e9433050 baseline. Source
defaults remain off. Qualification covers the measured single-sequence,
ctx4096, DSpark5, short32/128-token prompt cases; it is not long-context,
multi-slot or long-soak validation. Neither300 nor500 token/s is reached.
''';path.write_text(text,encoding='utf-8')
