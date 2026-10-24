"""Prepare a fresh effective public-source overlay and CPU gate while V5 remains available for diagnostics."""
import ast,base64,hashlib,json,time
from xolotl_trial_common import BASE,observe,lease,owned
ip=BASE/'xolotl-json-runtime-v6b-stage.json'
if ip.exists():raise RuntimeError('V6b stage exists; inspect its CPU gate')
o=observe();stable=json.loads((BASE/'xolotl-stable-service-v4-intent.json').read_text());fix=json.loads((BASE/'xolotl-dsml-json-fix-v6b-plan.json').read_text())
if o['phase']!='Running' or o['job_uid']!='ea86cb78-5efd-472c-a4f7-d97c38a95637':raise RuntimeError('exact optimization GPU identity differs')
code='''import json
from pathlib import Path
r=@R@
print(json.dumps(json.loads((Path(r['root'])/'server-config.json').read_text())))
'''.replace('@R@',repr(stable));config=owned(code);root=lease()['remote']+'/serve-tool-json-v6b'
plan=dict(stable['plan']);plan.update(schema='aster-xolotl-strict-tool-json-v6b',lease_ends_unix=o['resource-result.json']['leaseEndsUnix'],optimization_gpu_uuid=stable['gpu_uuid'],source_overlay=fix,prefill_chunk_tokens=128)
plan['engine_env']=dict(plan['engine_env']);plan['engine_env']['STRATA_TEXT_LOG']='0'
config.update(cwd=root,tokenizer=root+'/tokenizer',log=root+'/engine.log')
worker=(BASE/'xolotl_prefill_shadow_worker_v4.frozen.py').read_text();anchor=" STATE.update(context_tokens=PLAN['context_tokens'],phase='starting_api',"
if worker.count(anchor)!=1:raise RuntimeError('strict JSON CPU gate insertion anchor differs')
worker=worker.replace(anchor," run([sys.executable,str(ROOT/'test-dsml-json.py'),str(ROOT/'source')],'strict-json-tests-v6b',30,env)\n"+anchor);ast.parse(worker);(BASE/'xolotl_strict_json_worker_v6b.frozen.py').write_text(worker)
patched=(BASE/'serve_ds41_dsml_json_v6b.frozen.py').read_bytes();tests=(BASE/'test_xolotl_dsml_json_v6b.frozen.py').read_bytes()
plan['inputs']=list(plan['inputs'])+[dict(path=root+'/source/tools/v41/serve/serve_ds41.py',bytes=len(patched),sha256=fix['patched_sha256'],verify_small_sha256=True),dict(path=root+'/test-dsml-json.py',bytes=len(tests),sha256=hashlib.sha256(tests).hexdigest(),verify_small_sha256=True)]
payload={'service-worker.py':worker.encode(),'service-plan.json':(json.dumps(plan,indent=2)+'\n').encode(),'server-config.json':(json.dumps(config,indent=2)+'\n').encode(),'prompt-id-controls.json':(BASE/'xolotl-trial-prompt-ids.json').read_bytes(),'overlay/serve_ds41.py':patched,'test-dsml-json.py':tests,'preflight-worker.py':(BASE/'xolotl_json_preflight_worker_v6b.py').read_bytes()}
r=dict(unix=time.time(),phase='prepared',root=root,source_public_root=stable['root'],allocation_job=o['job'],allocation_uid=o['job_uid'],replica=o['replicas'][0]['name'],replica_uid=o['replicas'][0]['uid'],gpu_uuid=o['resource-result.json']['gpus'][0]['uuid'],pod_ip=o['replicas'][0]['status']['podIP'],host_ip=o['replicas'][0]['status']['hostIP'],plan=plan,credential_file=stable['credential_file'],files=[dict(file=n,bytes=len(b),sha256=hashlib.sha256(b).hexdigest()) for n,b in payload.items()]);ip.write_text(json.dumps(r,indent=2)+'\n')
tree=ast.parse((BASE/'launch_xolotl_longctx_shadow_v1.py').read_text());body=[x.value for x in ast.walk(tree) if isinstance(x,ast.Constant) and isinstance(x.value,str) and "root=Path(r['root']);src=Path(r['source_public_root'])" in x.value]
if len(body)!=1:raise RuntimeError('bounded public overlay staging template differs')
template=body[0];template=template[:template.index('# Carry the existing authorized service credential')]
# Overlay destinations have one controlled parent, created before the exact frozen-file write.
anchor=" with (root/row['file']).open('xb') as f:f.write(raw)"
if template.count(anchor)!=1:raise RuntimeError('effective overlay payload staging anchor differs')
template=template.replace(anchor," (root/row['file']).parent.mkdir(mode=0o700,parents=True,exist_ok=True)\n"+anchor)
template+='''
target=root/'source/tools/v41/serve/serve_ds41.py';overlay=root/'overlay/serve_ds41.py'
if hashlib.sha256(target.read_bytes()).hexdigest()!=r['plan']['source_overlay']['upstream_sha256']:raise RuntimeError('exact upstream adapter overlay base differs')
new=overlay.read_bytes()
if hashlib.sha256(new).hexdigest()!=r['plan']['source_overlay']['patched_sha256']:raise RuntimeError('strict adapter overlay SHA differs')
target.write_bytes(new)
manifest['base_archive_sha256']=manifest.pop('archive_sha256');manifest['base_archive_bytes']=manifest.pop('archive_bytes');manifest['schema']='aster-public-serving-effective-overlay-v6b';manifest['overlay']=r['plan']['source_overlay']
rows=[x for x in manifest['files'] if x['file']=='source/tools/v41/serve/serve_ds41.py']
if len(rows)!=1:raise RuntimeError('exact effective adapter manifest row differs')
rows[0].update(bytes=len(new),sha256=hashlib.sha256(new).hexdigest());(root/'public-manifest.json').write_text(json.dumps(manifest,indent=2)+'\\n')
secret=(src/'credentials/api-key.txt').read_bytes()
if hashlib.sha256(secret).hexdigest()!=r['plan']['credential_file_sha256']:raise RuntimeError('authorized private credential differs')
(root/'credentials').mkdir(mode=0o700)
with (root/'credentials/api-key.txt').open('xb') as f:f.write(secret)
(root/'credentials/api-key.txt').chmod(0o600)
with (root/'cpu-preflight-worker.log').open('xb') as log:
 p=subprocess.Popen(['timeout','--signal=TERM','--kill-after=15','200','python3','-u',str(root/'preflight-worker.py')],cwd=root,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
process=dict(pid=p.pid,start_ticks=int(Path('/proc/'+str(p.pid)+'/stat').read_text().split(') ',1)[1].split()[19]),uid=os.getuid(),unix=time.time(),budget_seconds=200)
(root/'cpu-preflight-process.json').write_text(json.dumps(process,indent=2)+'\\n');print(json.dumps(process))
'''
code=template.replace('@R@',repr(r)).replace('@DATA@',repr({n:base64.b64encode(b).decode() for n,b in payload.items()}));compile(code,'strict-native-argument-overlay-staging','exec');r['phase']='stage_requested';ip.write_text(json.dumps(r,indent=2)+'\n');r['cpu_process']=owned(code);r['phase']='cpu_preflight_running';ip.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(dict(phase=r['phase'],root=root,old_gpu_model_kept_running=True,formal_serving_unchanged=True)))
