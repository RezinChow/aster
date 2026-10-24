"""Keep the unmet milestone, exact live lease, and next research boundary recoverable."""
import json,time
from xolotl_trial_common import BASE,lease,owned
r=lease();observation=json.loads((BASE/'xolotl-trial-resource-latest.json').read_text());replica=observation['replicas'][0]
retirement=BASE/'xolotl-cont1-retired-after-mma.json'
if retirement.exists():
 stop=json.loads(retirement.read_text())
 if stop['job_uid']!=r['submitted']['uid'] or not stop['idle_proof']['idle']:raise RuntimeError('retirement allocation proof differs')
 state=dict(unix=stop['unix'],gpu_idle=True,active='',idle_sample_was_before_resource_stop=True,allocation_phase=observation['phase'],stop_receipt=str(retirement))
else:
 state=owned("import subprocess,json,time; p=subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8,check=True); print(json.dumps(dict(unix=time.time(),gpu_idle=not p.stdout.strip(),active=p.stdout)))")
out=dict(unix=time.time(),current_target_tok_s=300,current_target_scope='single physical H200, one request, real generated/decode tokens per second',achieved=False,broader_goal_tool_objective_tok_s=500,current_user_instruction='先做到单卡300 token/s',allocation=dict(job=r['submitted']['rjob'],job_uid=r['submitted']['uid'],replica=replica['name'],replica_uid=replica['uid'],root=r['remote'],lease_ends_unix=observation['resource-result.json']['leaseEndsUnix'],expected_gpus=1,host_cpu_limit=20,host_memory_gib=220,requires_new_terminal_guard_before_any_replacement=True),current_gpu_state=state,selected_qualified_baseline=str(BASE/'qualified-xolotl-single-h200-baseline.json'),current_single_card_control_mixed_tok_s=94.99748615090984,device_input_single_pair_tok_s=96.26501970404489,device_input_single_pair_gain_percent=1.334281152578587,device_input_speed_qualified=False,device_input_output_pairs_equal=21,row2_regression_tok_s=85.51605607112458,row2_adopted=False,row4_full_model_launched=False,new_build_binary_sha256='72e53b0d3b2652ab8721ac0fbeb89d46d50e854ccf2ab1416bd731a7e37ffa7b',new_build_root=r['remote']+'/xolotl-split-rows-h200',no_http_service_or_key=True,next_research=dict(direction='Prototype H200 TensorCore expert dot products rather than further scalar row-layout tuning; validate before any integration',prototype_written=False,prototype_built=False,hardware_result_claimed=False,primary_ptx_reference='https://docs.nvidia.com/cuda/parallel-thread-execution/index.html#matrix-multiply-accumulate-operation-using-mma-instruction',primary_pinned_mma_helper='xolotl-trial-source-e9d0826d71c5/llama-source/ggml/src/ggml-cuda/mma.cuh',basis='FP16 can exactly encode the integer ternary weight codes and q8 activation codes; keep scales in the original float arithmetic. This does not establish final accumulation equality, model quality or performance.',required_gates='Paired synthetic finite/equivalence controls, preserve old flags/defaults, exact same-input full-model comparison and quality review; no microbench-to-model-speed substitution'),original_mtp=dict(pinned_revision='c66fada630aba9123bd6011731fa83c267027122',bytes=8421868640,sha256='6f3d5b8611ddb3954bb89c09e8890806225715fea90868a6d7ec0ffee5c72082',present=False,download_started=False,network_heads='timed out; exact known public-cache blob absent'))
out['new_build_root']=json.loads((BASE/'xolotl-h200-split-rows-build-intent.json').read_text())['root']
out['last_full_model_allocation']='aster-xolotl-300-0b1716ac50e0-15462982'
out['model_benchmark_on_current_allocation']=(BASE/'xolotl-mma-model-comparison.json').exists()
out['allocation']['phase']=observation['phase']
versions=['prototype','v2','v3','v4','v5','v6','v7','v8','v9','v10','v11','v12','v13','v14','v15']
prototypes={}
for v in versions:
 p=BASE/('xolotl-ptq-mma-'+v+'-latest.json')
 if p.exists():
  result=json.loads(p.read_text()).get('result.json',{})
  prototypes[v]=dict(phase=result.get('phase'),passed=result.get('passed'),cases=result.get('cases',[]))
out['next_research']=dict(direction='Exact-code TensorCore expert GU prototype; no integration until memory, cold-cache and full-model gates pass',prototype_written=True,prototype_built=True,hardware_result_claimed=True,versions=prototypes,integrated_into_engine=False,model_speed_qualified=False,auxiliary_memory_scope='V6/V7 use expanded FP16 synthetic codes; V8+ use lossless 34/28 PTQ GU bytes and retain original half scales. Warm timing excludes reported preparation and extra storage; no all-model expansion claim.',required_gates='All written GU floats bitwise equal, post-SwiGLU q8 bytes equal, finite, untouched sentinels; then cold-cache realistic working set and same-input full-model comparisons before adoption',primary_ptx_reference='https://docs.nvidia.com/cuda/parallel-thread-execution/index.html#matrix-multiply-accumulate-operation-using-mma-instruction')
comparison=BASE/'xolotl-mma-model-comparison.json'
if comparison.exists():
 c=json.loads(comparison.read_text(encoding='utf-8'));out['mma_full_model_round']=c
 out['last_full_model_allocation']=r['submitted']['rjob'];out['current_single_card_control_mixed_tok_s']=c['control']['mixed_tok_s']
 out['next_research']['integrated_into_engine']=True;out['next_research']['adopted']=False
 out['next_research']['direction']='The two-kernel hybrid regresses0.508%; keep it off. Investigate single-kernel uniform group dispatch and real small-group distribution, then original-precision MTP acceptance. Do not infer model gains from uniform synthetic windows.'
 download=BASE/'xolotl-original-mtp-windows-resume1-latest.json'
 if download.exists():out['original_mtp']['windows_download']=json.loads(download.read_text())
(BASE/'xolotl-300-next-iteration.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(saved=True,target_300_met=False,lease_ends_unix=out['allocation']['lease_ends_unix'],gpu_idle=state['gpu_idle']),indent=2))
