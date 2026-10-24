"""Launch the qualified baseline on the separate serving H200; never stage secrets as evidence."""
import base64,hashlib,json,os,secrets,subprocess,time
from pathlib import Path
from xolotl_serving_common import BASE,lease,observe,owned
p=BASE/'xolotl-stable-service-intent.json'
if p.exists():raise RuntimeError('stable service intent already exists; inspect it')
o=observe();r=lease();stage=json.loads((BASE/'xolotl-stable-service-stage.json').read_text());baseline=json.loads((BASE/'qualified-xolotl-single-h200-baseline.json').read_text());bp=baseline['plan'];roles=json.loads((BASE/'xolotl-two-role-deployment-plan.json').read_text())
if o['phase']!='Running' or o.get('resource-result.json',{}).get('phase')!='passed' or stage['allocation_uid']!=o['job_uid'] or o['resource-result.json']['gpus'][0]['uuid']==roles['optimization_gpu_uuid']:raise RuntimeError('separate serving allocation differs')
root=stage['root'];private=BASE/('access-private-xolotl-'+r['showname'].removeprefix('aster-xolotl-serving-'));private.mkdir()
principal=os.environ['USERDOMAIN']+'\\'+os.environ['USERNAME']
subprocess.run(['icacls',str(private),'/inheritance:r','/grant:r',principal+':(OI)(CI)F','SYSTEM:(OI)(CI)F'],capture_output=True,text=True,check=True,timeout=10)
key='sk-aster-'+secrets.token_urlsafe(36);keyfile=private/'api-key.txt';keybytes=(key+'\n').encode();keyfile.write_bytes(keybytes)
plan=dict(schema='aster-xolotl-stable-serving-plan-v1',binary=bp['binary'],binary_sha256=bp['binary_sha256'],model_name='deepseek-v4.1-flash-1017-xq',lease_ends_unix=o['resource-result.json']['leaseEndsUnix'],optimization_gpu_uuid=roles['optimization_gpu_uuid'],credential_file_sha256=hashlib.sha256(keybytes).hexdigest(),selected_qualified_baseline=str(BASE/'qualified-xolotl-single-h200-baseline.json'),inputs=[dict(path=bp['model'],bytes=162954903552,sha256=bp['model_sha256'],verify_small_sha256=False),dict(path=bp['rank'],bytes=122880,verify_small_sha256=False),dict(path=bp['sidecar'],bytes=5661492320,verify_small_sha256=False)],engine_env=dict(STRATA_NO_LARGEPAGES='1',STRATA_SERVE_DSPARK=bp['sidecar'],STRATA_DSPARK_DEPTH='5',STRATA_DSPARK_CONF='0.45',STRATA_D3_PF='0',STRATA_EXP_MODE_T143='4',STRATA_EXP_MODE_T11='0',ASTER_XQ_SPLIT_MMVQ='11',ASTER_XQ_PASS_GRAPH_MIB='1024',ASTER_XQ_DENSE_ASYNC_CHAIN='0',DS41_GRAPH_REUSE='1'))
args=['-m',bp['model'],'--backend','cuda','--experts','gpu','--engram',bp['engram'],'--rank',bp['rank'],'--ctx','4096','--threads','16','--prompt-batch','256','--prefill-chunk','128','--arena-gib','160','--arena-skip-resident','--pcie','1','--route-bias','0','--route-bias-file','0','--skip-miss','0','--skip-file','0','--temp','0','--seed','1','--conversation-cache-mib','0','--prompt-cache','0','--stop','1']
config=dict(exe=plan['binary'],args=args,cwd=root,tokenizer=root+'/tokenizer',model_name=plan['model_name'],log=root+'/engine.log',gpu=0,host='0.0.0.0',port=30003,reasoning_effort='none',sampling=dict(temperature=0,seed=1),api_monitor=False,open_browser=False,idle_unload_s=0,engine_silence_s=300,lazy_load=False)
payload={'service-worker.py':(BASE/'xolotl_stable_service_worker.py').read_bytes(),'service-plan.json':(json.dumps(plan,indent=2)+'\n').encode(),'server-config.json':(json.dumps(config,indent=2)+'\n').encode(),'prompt-id-controls.json':(BASE/'xolotl-trial-prompt-ids.json').read_bytes()}
record=dict(unix=time.time(),phase='prepared',root=root,allocation_job=o['job'],allocation_uid=o['job_uid'],replica=o['replicas'][0]['name'],replica_uid=o['replicas'][0]['uid'],gpu_uuid=o['resource-result.json']['gpus'][0]['uuid'],pod_ip=o['replicas'][0]['status']['podIP'],host_ip=o['replicas'][0]['status']['hostIP'],plan=plan,credential_file=str(keyfile),files=[dict(file=n,bytes=len(b),sha256=hashlib.sha256(b).hexdigest()) for n,b in payload.items()]);p.write_text(json.dumps(record,indent=2)+'\n')
code='''from pathlib import Path
import base64,hashlib,json,os,subprocess,time
r=@R@;root=Path(r['root']);data=@DATA@
if root.resolve()!=root or root.stat().st_uid!=10250 or (root/'service-process.json').exists():raise RuntimeError('stable service stage/process differs')
for row in r['files']:
 raw=base64.b64decode(data[row['file']])
 if len(raw)!=row['bytes'] or hashlib.sha256(raw).hexdigest()!=row['sha256']:raise RuntimeError('stable service frozen worker differs')
 with (root/row['file']).open('xb') as f:f.write(raw)
private=root/'credentials';private.mkdir(mode=0o700);secret=base64.b64decode(@SECRET@)
if hashlib.sha256(secret).hexdigest()!=r['plan']['credential_file_sha256']:raise RuntimeError('stable service private credential differs')
with (private/'api-key.txt').open('xb') as f:f.write(secret)
(private/'api-key.txt').chmod(0o600)
proof=json.loads((root.parent/'resource-result.json').read_text());deadline=int(proof['leaseEndsUnix']-time.time()-10)
if deadline<600 or proof['leaseEndsUnix']!=r['plan']['lease_ends_unix']:raise RuntimeError('stable service immutable deadline differs')
with (root/'service-worker.log').open('xb') as log:
 child=subprocess.Popen(['timeout','--signal=TERM','--kill-after=30',str(deadline),'python3','-u',str(root/'service-worker.py')],cwd=root,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
process=dict(pid=child.pid,start_ticks=int(Path('/proc/'+str(child.pid)+'/stat').read_text().split(') ',1)[1].split()[19]),uid=os.getuid(),unix=time.time(),deadline_seconds=deadline)
(root/'service-process.json').write_text(json.dumps(process,indent=2)+'\\n');print(json.dumps(process))
'''.replace('@R@',repr(record)).replace('@DATA@',repr({n:base64.b64encode(b).decode() for n,b in payload.items()})).replace('@SECRET@',repr(base64.b64encode(keybytes).decode()))
compile(code,'stable-service-bootstrap','exec');record['phase']='launch_requested';p.write_text(json.dumps(record,indent=2)+'\n');record['process']=owned(code);record['phase']='launched';p.write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(dict(phase='launched',root=root,gpu_uuid=record['gpu_uuid'],pod_ip=record['pod_ip'],host_ip=record['host_ip'],credential_saved_privately=True,lease_ends_unix=plan['lease_ends_unix'])))
