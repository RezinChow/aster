"""Preserve bounded public synthetic measurements, resource proof and operators."""
import hashlib,json,shutil,time
from xolotl_trial_common import BASE,WORK,lease
dest=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200'
dest.mkdir(exist_ok=True)
files=['h200-owned-allocation-release-audit.json','xolotl-eight-pending-superseded.json','xolotl-b345-stage-result.json','xolotl-trial-inputs-result.json','xolotl-trial-prompt-ids.json','xolotl-trial-resource-latest.json']
modes=['single-base','single-dspark','pair-base','single-resident-base','single-resident-dspark','single-resident-warm-d4','single-resident-warm-d5','single-resident-warm-d5-pf0','single-resident-warm-d5-pf0-conf06','single-resident-warm-d5-pf0-conf045','single-current-warm-control','single-current-warm-cache1024','single-current-warm-cache1024-async']
for name in ['xolotl-h200-graph-experiments.patch','xolotl-h200-graph-experiments-plan.json','xolotl-h200-current-build-intent.json','xolotl-current-build-latest.json','xolotl-current-build-hardware-controls.json','xolotl-engine-source-comparison.json']:
 if (BASE/name).is_file():files.append(name)
for mode in modes:
 for kind in ['intent','latest','summary']:
  p=BASE/('xolotl-'+mode+'-'+kind+'.json')
  if p.is_file():files.append(p.name)
extra_modes=['single-current-profile-prose','single-current-profile-prose-v2','single-current-warm-cache1024-r2','single-current-warm-cache1024-r4','single-current-split-control','single-current-split-both','single-current-split-control-b2','single-current-split-hybrid','single-current-split-control-b3','single-current-split-hybrid-b2','single-current-split-control-b4','single-current-split-hybrid-b3']
extra_modes+=['single-current-q8-control','single-current-q8-mmq','single-current-split-conf020','single-current-split-conf045-final']
extra_modes+=['single-current-device-control','single-current-device-direct','single-current-device-cpu-control','single-current-device-cpu-direct','single-current-rows-control','single-current-rows-r2','single-current-rows-r4']
extra_modes+=['single-current-mma-control','single-current-mma-candidate']
extra_modes+=['single-current-mma-v2-control','single-current-mma-v2-candidate','single-current-mma-v2-diagnostic','single-current-mma-v2-original-mtp','single-current-mma-v3-diagnostic','single-current-hostthreads-1','single-current-hostthreads-4']
extra_modes+=['single-current-qsum-control','single-current-qsum-gu','single-current-qsum-both','single-current-qsum-v2-control','single-current-qsum-v2-gu','single-current-qsum-v2-both','single-current-qsum-v2-gu-b2','single-current-qsum-v2-control-b2','single-current-qsum-v2-control-b3','single-current-qsum-v2-gu-b3']
extra_modes+=['single-current-qsum-v2-profile']
extra_modes+=['single-current-dense-chain-control','single-current-dense-chain-candidate','single-current-dense-chain-stress-control','single-current-dense-chain-stress-candidate']
extra_modes+=['single-current-dense-chain-v3-control','single-current-dense-chain-v3-candidate','single-current-dense-chain-v3-stress-control','single-current-dense-chain-v3-stress-candidate','single-current-dense-chain-v3-candidate-b2','single-current-dense-chain-v3-control-b2','single-current-dense-chain-v3-control-b3','single-current-dense-chain-v3-candidate-b3']
for mode in extra_modes:
 for kind in ['intent','latest','summary']:
  p=BASE/('xolotl-'+mode+'-'+kind+'.json')
  if p.is_file():files.append(p.name)
for name in ['xolotl-profile-summary.json','xolotl-profile-schema.json','xolotl-profile-statistics-launch.json','xolotl-profile-statistics-latest.json','xolotl-profile-first-failure.json','xolotl-nsys-stdio-check.json','xolotl-nsys-start-help.json','xolotl-current-round-comparison.json']:
 if (BASE/name).is_file():files.append(name)
for name in ['xolotl-alternating-campaign.json','xolotl-split-round-comparison.json','xolotl-trial-cleanup-controls.json','xolotl-q8-pair-campaign.json','xolotl-q8-round-comparison.json','xolotl-conf300-pair-campaign.json','xolotl-conf300-round-comparison.json','xolotl-trial-cleanup-conf300-controls.json','xolotl-trial-cleanup-q8-controls.json','xolotl-current-milestone.json','xolotl-original-mtp-local-inventory.json','xolotl-hf-mtp-candidate-metadata.json']:
 if (BASE/name).is_file():files.append(name)
for name in files:
 p=BASE/name
 if p.stat().st_size>2*1024**2:raise RuntimeError('trial evidence exceeds bound')
 shutil.copy2(p,dest/name)
operators=dest/'operators';operators.mkdir(exist_ok=True)
shutil.copy2(BASE/'retain_xolotl_trial_evidence.py',operators/'retain_xolotl_trial_evidence.py')
for name in ['xolotl_trial_common.py','xolotl_protocol_trial_worker.py','launch_xolotl_protocol_trial.py','observe_xolotl_protocol_trial.py','summarize_xolotl_trial.py','prepare_xolotl_prompt_ids.py','prepare_xolotl_pair_lease.py','stage_existing_xolotl_trial.py','prepare_xolotl_trial_inputs.py','audit_owned_h200_allocations.py','submit_xolotl_pair_lease.frozen.py','xolotl-pair-resource-probe.frozen.py']:
 shutil.copy2(BASE/name,operators/name)
for name in ['prepare_xolotl_h200_patch.py','xolotl_current_build_worker.py','stage_xolotl_current_build.py','launch_xolotl_current_build.py','observe_xolotl_current_build.py','qualify_xolotl_current_build.py']:
 shutil.copy2(BASE/name,operators/name)
for name in ['xolotl_nsys_protocol_worker.frozen.py','xolotl_nsys_protocol_worker_v2.frozen.py','prepare_xolotl_nsys_worker.py','prepare_xolotl_nsys_worker_v2.py','analyze_xolotl_nsys.py','read_xolotl_profile_schema.py','summarize_xolotl_profile.py','prepare_xolotl_rows_trials.py']:
 if (BASE/name).is_file():shutil.copy2(BASE/name,operators/name)
for name in ['run_xolotl_alternating.py','compare_xolotl_split_rounds.py','prepare_xolotl_hybrid_trials.py','prepare_xolotl_bounded_trials.py','check_xolotl_trial_cleanup.py','run_xolotl_q8_pair.py','prepare_xolotl_conf_300_trials.py','run_xolotl_conf300_pair.py','check_xolotl_conf300_cleanup.frozen.py','compare_xolotl_conf300.py']:
 if not (BASE/name).is_file():continue
 shutil.copy2(BASE/name,operators/name)
shutil.copy2(BASE/'xolotl-trial-source-e9d0826d71c5/source/LICENSE',dest/'Xolotl-MIT-LICENSE.txt')
out=dict(unix=time.time(),target_single_gpu_decode_tok_s=500,user_goal='深度完成单张H200的三值量化DeepSeek v4.1 Flash模型推理加速，至少达到500 tok/s',goal_complete=False,engine_revision='b3452666e07a6374d06bb8c2185dffa271e8f65f',actual_context_tokens=4096,requested_context_tokens=256,native_comparison_limits='Different engines, GPU placement, reserved context, prefix/OS cache histories; do not claim isolated kernel speedup',dspark_limit='Count output agrees; code output differs, so no bitwise/lossless claim; one sequential cold/warm block per profile',pair_failure='Wrong --split-device 1 put both stages on CUDA1; engine exited during first request; no valid pair rate or asserted exit cause',files=[dict(file=p.relative_to(dest).as_posix(),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in dest.rglob('*') if p.is_file() and p.name!='manifest.json'])
out.update(baseline_engine_revision='b3452666e07a6374d06bb8c2185dffa271e8f65f',engine_revision='e9d0826d71c59072cbff77d2a31dd51f27ab7a12',qualified_following_trial_baseline='qualified-xolotl-single-h200-baseline.json' if (dest/'qualified-xolotl-single-h200-baseline.json').exists() else None)
milestone=json.loads((BASE/'xolotl-current-milestone.json').read_text(encoding='utf-8')) if (BASE/'xolotl-current-milestone.json').exists() else None
if milestone:out.update(target_single_gpu_decode_tok_s=milestone['target_single_gpu_single_request_decode_tok_s'],user_goal=milestone['user_instruction'])
(dest/'manifest.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
activepath=BASE/'active-worktree.json';a=json.loads(activepath.read_text())
latest=next(mode for mode in reversed(modes+extra_modes) if (BASE/('xolotl-'+mode+'-intent.json')).exists())
a.update(current_owned_allocation_intent=str(BASE/'xolotl-pair-lease-pending.json'),current_owned_allocation_phase='Running',current_service_available=False,current_service_role='Original Xolotl single-visible-H200 protocol optimization; no HTTP listener/key delivered',current_original_engine_trial=str(BASE/('xolotl-'+latest+'-intent.json')),single_request_requirement_tok_s=500,single_request_requirement_met=False)
if milestone:a['single_request_requirement_tok_s']=milestone['target_single_gpu_single_request_decode_tok_s']
current_lease=lease()
a['current_owned_allocation_intent']=str(BASE/('xolotl-single300-lease-pending.json' if current_lease['expected_gpus']==1 else 'xolotl-pair-lease-pending.json'))
if (BASE/'xolotl-single500-cont1-lease-pending.json').exists():
 continuation=json.loads((BASE/'xolotl-single500-cont1-lease-pending.json').read_text())
 if continuation.get('submitted',{}).get('uid')==current_lease['submitted']['uid']:a['current_owned_allocation_intent']=str(BASE/'xolotl-single500-cont1-lease-pending.json')
a['current_owned_allocation_phase']=json.loads((BASE/'xolotl-trial-resource-latest.json').read_text()).get('phase')
a['current_owned_allocation_resources_reserved']=a['current_owned_allocation_phase']=='Running'
mma_comparison=BASE/'xolotl-mma-model-comparison.json'
if mma_comparison.exists():
 a['current_original_engine_trial_phase']=json.loads((BASE/'xolotl-single-current-mma-candidate-latest.json').read_text(encoding='utf-8'))['result.json']['phase']
 a['current_original_engine_candidate_adopted']=False
 a['current_selected_qualified_baseline']=str(BASE/'qualified-xolotl-single-h200-baseline.json')
 a['current_mma_model_comparison']=str(mma_comparison)
 a['next_iteration_record']=str(BASE/'xolotl-300-next-iteration.json')
 a['local_original_mtp_download_record']=str(BASE/'xolotl-original-mtp-windows-resume1-latest.json')
activepath.write_text(json.dumps(a,indent=2)+'\n')
# Current recovery state supersedes historical per-round pointers above.
recovery=BASE/'xolotl-500-next-iteration.json'
if recovery.exists():
 record=json.loads(recovery.read_text(encoding='utf-8'))
 if record['allocation']['job_uid']==current_lease['submitted']['uid']:a.update(record['active_worktree_updates'])
 activepath.write_text(json.dumps(a,indent=2)+'\n')
qsum=BASE/'xolotl-qsum-next-iteration.json'
if qsum.exists():
 record=json.loads(qsum.read_text())
 if record['allocation']['job_uid']==current_lease['submitted']['uid']:
  a.update(record['active_worktree_updates']);activepath.write_text(json.dumps(a,indent=2)+'\n')
dense=BASE/'xolotl-dense-chain-next-iteration.json'
if dense.exists():
 record=json.loads(dense.read_text())
 if record['allocation']['job_uid']==current_lease['submitted']['uid']:
  a.update(record['active_worktree_updates']);activepath.write_text(json.dumps(a,indent=2)+'\n')
serving=BASE/'xolotl-serving-active-state-updates.json'
if serving.exists():
 state=json.loads(serving.read_text())
 if time.time()<state['current_service_lease_ends_unix']:
  a.update(state);activepath.write_text(json.dumps(a,indent=2)+'\n')
roles=BASE/'xolotl-serving-and-optimization-next-iteration.json'
if roles.exists():
 record=json.loads(roles.read_text())
 if record['optimization']['job_uid']==current_lease['submitted']['uid']:
  a.update(record['active_worktree_updates']);activepath.write_text(json.dumps(a,indent=2)+'\n')
print(json.dumps(dict(path=str(dest),files=len(out['files']),target=out['target_single_gpu_decode_tok_s'],goal_complete=False),indent=2))
