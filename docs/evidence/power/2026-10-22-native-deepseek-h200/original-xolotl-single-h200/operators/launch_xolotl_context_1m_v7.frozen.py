"""Test larger dense prefill chunks on the idle optimization H200; serving continues on the other GPU."""
import ast,base64,hashlib,json,time
from pathlib import PurePosixPath
from xolotl_trial_common import BASE,observe,lease,owned
ip=BASE/'xolotl-context-1m-v7-intent.json'
if ip.exists():raise RuntimeError('V5 prefill intent exists; inspect instead')
o=observe();stable=json.loads((BASE/'xolotl-stable-service-v4-intent.json').read_text());previous=json.loads((BASE/'xolotl-stable-service-v3-intent.json').read_text())
if o['job_uid']!=previous['allocation_uid'] or o['phase']!='Running' or o.get('resource-result.json',{}).get('phase')!='passed' or o['resource-result.json']['gpus'][0]['uuid']==stable['gpu_uuid']:raise RuntimeError('separate idle optimization role differs')
code='''import json,subprocess
from pathlib import Path
s=@STABLE@
old=json.loads(Path('/mnt/shared-storage-user/yangchao/Workspace/aster-h200-xq/aster-xolotl-serving-9c996c5a434b/serve-tool-json-v6b/service-longctx-v1-result.json').read_text())
if old['phase']!='stopped' or not old.get('api_reaped'):raise RuntimeError('previous exact validation API must be stopped and reaped')
p=subprocess.run(['nvidia-smi','--query-compute-apps=pid','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8,check=True)
if p.stdout.strip():raise RuntimeError('optimization GPU is already busy')
print(json.dumps(json.loads((Path(s['root'])/'server-config.json').read_text())))
'''.replace('@STABLE@',repr(stable));config=owned(code);root=lease()['remote']+'/serve-context-1m-v7'
plan=dict(stable['plan']);plan.update(schema='aster-xolotl-context-1m-plan-v7',lease_ends_unix=o['resource-result.json']['leaseEndsUnix'],optimization_gpu_uuid=stable['gpu_uuid'],prefill_chunk_tokens=128,context_tokens=1048576)
config['args'][config['args'].index('--ctx')+1]='1048576';config['args'][config['args'].index('--prefill-chunk')+1]='128';config.update(cwd=root,tokenizer=root+'/tokenizer',log=root+'/engine.log')
worker=(BASE/'xolotl_prefill_shadow_worker_v4.frozen.py').read_bytes();(BASE/'xolotl_context_1m_worker_v7.frozen.py').write_bytes(worker)
payload={'service-worker.py':worker,'service-plan.json':(json.dumps(plan,indent=2)+'\n').encode(),'server-config.json':(json.dumps(config,indent=2)+'\n').encode(),'prompt-id-controls.json':(BASE/'xolotl-trial-prompt-ids.json').read_bytes()}
r=dict(unix=time.time(),phase='prepared',root=root,source_public_root=stable['root'],allocation_job=o['job'],allocation_uid=o['job_uid'],replica=o['replicas'][0]['name'],replica_uid=o['replicas'][0]['uid'],gpu_uuid=o['resource-result.json']['gpus'][0]['uuid'],pod_ip=o['replicas'][0]['status']['podIP'],host_ip=o['replicas'][0]['status']['hostIP'],plan=plan,credential_file=stable['credential_file'],purpose='User-requested1048576 context; same stable engine, exact routing and weights; validate startup, beyond128K and generation before promotion; full1M length separately qualified',files=[dict(file=n,bytes=len(b),sha256=hashlib.sha256(b).hexdigest()) for n,b in payload.items()]);ip.write_text(json.dumps(r,indent=2)+'\n')
tree=ast.parse((BASE/'launch_xolotl_longctx_shadow_v1.py').read_text());body=[x.value for x in ast.walk(tree) if isinstance(x,ast.Constant) and isinstance(x.value,str) and "root=Path(r['root']);src=Path(r['source_public_root'])" in x.value]
if len(body)!=1:raise RuntimeError('bounded public staging bootstrap structure differs')
code=body[0].replace('@R@',repr(r)).replace('@DATA@',repr({n:base64.b64encode(b).decode() for n,b in payload.items()}));compile(code,'prefill-chunk-v5-bootstrap','exec');r['phase']='launch_requested';ip.write_text(json.dumps(r,indent=2)+'\n');r['process']=owned(code);r['phase']='launched';ip.write_text(json.dumps(r,indent=2)+'\n')
a=json.loads((BASE/'active-worktree.json').read_text());a.update(current_original_engine_trial=str(ip),current_original_engine_trial_phase='context1048576_shadow_loading',current_optimization_no_active_model_worker=False);(BASE/'active-worktree.json').write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(dict(phase='launched',context_tokens=1048576,prefill_chunk=128,prefill_batch=8192,gpu_uuid=r['gpu_uuid'],formal_serving_unchanged=True)))
