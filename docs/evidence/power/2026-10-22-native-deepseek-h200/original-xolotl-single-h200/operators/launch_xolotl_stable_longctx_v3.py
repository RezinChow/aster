"""Keep the same serving pod and key, replacing its drained 4096-context runtime with qualified131072."""
import ast,base64,hashlib,json,time
from xolotl_serving_common import BASE,lease,observe,owned,jump
ip=BASE/'xolotl-stable-service-v3-intent.json'
if ip.exists():raise RuntimeError('stable V3 intent exists; inspect it')
o=observe();old=json.loads((BASE/'xolotl-stable-service-v2-intent.json').read_text());shadow=json.loads((BASE/'xolotl-longctx-shadow-v1-intent.json').read_text())
if o['job_uid']!=old['allocation_uid'] or o['phase']!='Running':raise RuntimeError('original stable allocation changed')
code='''from pathlib import Path
import json,subprocess
old=@OLD@;s=@SHADOW@
q=json.loads((Path(old['root'])/'service-v2-result.json').read_text())
gpu=subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,check=True,timeout=8).stdout.strip()
if q['phase']!='stopped' or not q.get('api_reaped') or gpu:raise RuntimeError('original service must be gracefully reaped and GPU idle before replacement: '+repr((q.get('phase'),gpu)))
config=json.loads((Path(s['root'])/'server-config.json').read_text())
if config['args'][config['args'].index('--ctx')+1]!='131072':raise RuntimeError('qualified shadow context differs')
print(json.dumps(dict(old_result=q,config=config)))
'''.replace('@OLD@',repr(old)).replace('@SHADOW@',repr(shadow))
pre=owned(code)
root=lease()['remote']+'/serve-long-context-v3'
plan=dict(shadow['plan']);plan.update(schema='aster-xolotl-stable-serving-plan-v3',lease_ends_unix=old['plan']['lease_ends_unix'],optimization_gpu_uuid=shadow['gpu_uuid'])
config=pre['config'];config.update(cwd=root,tokenizer=root+'/tokenizer',log=root+'/engine.log')
worker=(BASE/'xolotl_longctx_shadow_worker_v1.frozen.py').read_bytes();(BASE/'xolotl_stable_service_worker_v3.frozen.py').write_bytes(worker)
payload={'service-worker.py':worker,'service-plan.json':(json.dumps(plan,indent=2)+'\n').encode(),'server-config.json':(json.dumps(config,indent=2)+'\n').encode(),'prompt-id-controls.json':(BASE/'xolotl-trial-prompt-ids.json').read_bytes()}
r=dict(unix=time.time(),phase='prepared',root=root,source_public_root=shadow['root'],allocation_job=o['job'],allocation_uid=o['job_uid'],replica=o['replicas'][0]['name'],replica_uid=o['replicas'][0]['uid'],gpu_uuid=old['gpu_uuid'],pod_ip=old['pod_ip'],host_ip=old['host_ip'],plan=plan,credential_file=old['credential_file'],supersedes='xolotl-stable-service-v2-intent.json',shadow_qualification='xolotl-longctx-request-v1-intent.json',old_service_gracefully_reaped=pre['old_result'],files=[dict(file=n,bytes=len(b),sha256=hashlib.sha256(b).hexdigest()) for n,b in payload.items()])
ip.write_text(json.dumps(r,indent=2)+'\n')
# Reuse the exact bounded public-only staging bootstrap, checked structurally and compiled anew.
tree=ast.parse((BASE/'launch_xolotl_longctx_shadow_v1.py').read_text())
body=[x.value for x in ast.walk(tree) if isinstance(x,ast.Constant) and isinstance(x.value,str) and "root=Path(r['root']);src=Path(r['source_public_root'])" in x.value]
if len(body)!=1:raise RuntimeError('shadow staging bootstrap structure differs')
code=body[0].replace('@R@',repr(r)).replace('@DATA@',repr({n:base64.b64encode(b).decode() for n,b in payload.items()}))
compile(code,'stable-long-context-v3-bootstrap','exec');r['phase']='launch_requested';ip.write_text(json.dumps(r,indent=2)+'\n');r['process']=owned(code);r['phase']='launched';ip.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(dict(phase=r['phase'],context_tokens=131072,pod_ip=r['pod_ip'],gpu_uuid=r['gpu_uuid'],same_authorized_key=True,old_4k_service_reaped=True)))
