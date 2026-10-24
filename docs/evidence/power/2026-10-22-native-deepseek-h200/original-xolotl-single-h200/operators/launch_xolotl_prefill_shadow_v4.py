"""Qualify upstream-sized prefill batches and bounded RAM KV pool on the separate optimization H200."""
import ast,base64,hashlib,json,time
from pathlib import PurePosixPath
from xolotl_longctx_common import BASE,observe,owned,jump
ip=BASE/'xolotl-prefill-shadow-v4-intent.json'
if ip.exists():raise RuntimeError('prefill V4 intent exists; inspect instead')
o=observe();stable=json.loads((BASE/'xolotl-stable-service-v3-intent.json').read_text());shadow=json.loads((BASE/'xolotl-longctx-shadow-v1-intent.json').read_text())
if o['job_uid']!=shadow['allocation_uid'] or o['phase']!='Running' or o.get('resource-result.json',{}).get('phase')!='passed' or o['resource-result.json']['gpus'][0]['uuid']==stable['gpu_uuid']:raise RuntimeError('separate qualification GPU is not proven')
code='''import json,subprocess
from pathlib import Path
stable=@S@;old=@OLD@
q=json.loads((Path(old['root'])/'service-longctx-v1-result.json').read_text())
apps=subprocess.run(['nvidia-smi','--query-compute-apps=pid','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8,check=True).stdout.strip()
if q['phase']!='stopped' or not q.get('api_reaped') or apps:raise RuntimeError('optimization H200 must be idle after the earlier shadow was drained')
print(json.dumps(json.loads((Path(stable['root'])/'server-config.json').read_text())))
'''.replace('@S@',repr(stable)).replace('@OLD@',repr(shadow))
config=owned(code);root=str(PurePosixPath(shadow['root']).parent)+'/serve-prefill-cache-v4'
plan=dict(stable['plan']);plan.update(schema='aster-xolotl-prefill-cache-plan-v4',lease_ends_unix=o['resource-result.json']['leaseEndsUnix'],optimization_gpu_uuid=stable['gpu_uuid'],prefill_batch_tokens=8192,conversation_cache_mib=8192,conversation_cache_slots=8)
plan['engine_env']=dict(plan['engine_env']);plan['engine_env']['STRATA_TEXT_LOG']='0'
for flag,value in [('--prompt-batch','8192'),('--conversation-cache-mib','8192'),('--prompt-cache','1')]:config['args'][config['args'].index(flag)+1]=value
config['args']+=['--conversation-cache-slots','8'];config.update(cwd=root,tokenizer=root+'/tokenizer',log=root+'/engine.log')
worker=(BASE/'xolotl_longctx_shadow_worker_v1.frozen.py').read_bytes();(BASE/'xolotl_prefill_shadow_worker_v4.frozen.py').write_bytes(worker)
payload={'service-worker.py':worker,'service-plan.json':(json.dumps(plan,indent=2)+'\n').encode(),'server-config.json':(json.dumps(config,indent=2)+'\n').encode(),'prompt-id-controls.json':(BASE/'xolotl-trial-prompt-ids.json').read_bytes()}
r=dict(unix=time.time(),phase='prepared',root=root,source_public_root=stable['root'],allocation_job=o['job'],allocation_uid=o['job_uid'],replica=o['replicas'][0]['name'],replica_uid=o['replicas'][0]['uid'],gpu_uuid=o['resource-result.json']['gpus'][0]['uuid'],pod_ip=o['replicas'][0]['status']['podIP'],host_ip=o['replicas'][0]['status']['hostIP'],plan=plan,credential_file=stable['credential_file'],purpose='Fix Workbuddy cold-prefill latency and preserve long-context KV across side requests; no weights/math/binary changes',files=[dict(file=n,bytes=len(b),sha256=hashlib.sha256(b).hexdigest()) for n,b in payload.items()]);ip.write_text(json.dumps(r,indent=2)+'\n')
tree=ast.parse((BASE/'launch_xolotl_longctx_shadow_v1.py').read_text());body=[x.value for x in ast.walk(tree) if isinstance(x,ast.Constant) and isinstance(x.value,str) and "root=Path(r['root']);src=Path(r['source_public_root'])" in x.value]
if len(body)!=1:raise RuntimeError('bounded shadow staging bootstrap structure differs')
code=body[0].replace('@R@',repr(r)).replace('@DATA@',repr({n:base64.b64encode(b).decode() for n,b in payload.items()}));compile(code,'prefill-cache-v4-bootstrap','exec');r['phase']='launch_requested';ip.write_text(json.dumps(r,indent=2)+'\n');r['process']=owned(code);r['phase']='launched';ip.write_text(json.dumps(r,indent=2)+'\n')
active=json.loads((BASE/'active-worktree.json').read_text());active.update(current_original_engine_trial=str(ip),current_original_engine_trial_phase='shadow_prefill_qualification',current_optimization_no_active_model_worker=False);(BASE/'active-worktree.json').write_text(json.dumps(active,indent=2)+'\n')
print(json.dumps(dict(phase=r['phase'],gpu_uuid=r['gpu_uuid'],prefill_batch=8192,conversation_cache_mib=8192,conversation_cache_slots=8,context_tokens=131072,live_server_kept=True)))
