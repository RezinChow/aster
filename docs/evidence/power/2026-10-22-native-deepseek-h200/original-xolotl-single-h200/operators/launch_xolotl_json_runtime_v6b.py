"""Launch the staged strictly tested adapter on the idle optimization H200."""
import json,time
from xolotl_trial_common import BASE,observe,owned
ip=BASE/'xolotl-json-runtime-v6b-intent.json'
if ip.exists():raise RuntimeError('V6b GPU runtime intent exists; inspect it')
r=json.loads((BASE/'xolotl-json-runtime-v6b-r2-stage.json').read_text());old=json.loads((BASE/'xolotl-prefill-shadow-v5-intent.json').read_text());o=observe()
if o['job_uid']!=r['allocation_uid'] or o['phase']!='Running':raise RuntimeError('exact V6b allocation changed')
code='''import json,os,subprocess,time
from pathlib import Path
r=@R@;old=@OLD@;root=Path(r['root'])
gate=json.loads((root/'cpu-preflight-result.json').read_text());prior=json.loads((Path(old['root'])/'service-longctx-v1-result.json').read_text())
apps=subprocess.run(['nvidia-smi','--query-compute-apps=pid','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8,check=True).stdout.strip()
if root.resolve()!=root or root.stat().st_uid!=10250 or (root/'service-process.json').exists() or gate['phase']!='passed' or prior['phase']!='stopped' or not prior.get('api_reaped') or apps:raise RuntimeError('V6b stage/CPU/idleGPU/exclusive process precondition differs')
stat=Path('/proc/'+str(old['process']['pid'])+'/stat')
if stat.exists() and int(stat.read_text().split(') ',1)[1].split()[19])==old['process']['start_ticks']:raise RuntimeError('prior exact V5 supervisor is not gone')
deadline=int(r['plan']['lease_ends_unix']-time.time()-10)
if deadline<900:raise RuntimeError('V6b GPU qualification deadline is insufficient')
with (root/'service-worker.log').open('xb') as log:
 child=subprocess.Popen(['timeout','--signal=TERM','--kill-after=30',str(deadline),'python3','-u',str(root/'service-worker.py')],cwd=root,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
p=dict(pid=child.pid,start_ticks=int(Path('/proc/'+str(child.pid)+'/stat').read_text().split(') ',1)[1].split()[19]),uid=os.getuid(),unix=time.time(),deadline_seconds=deadline)
(root/'service-process.json').write_text(json.dumps(p,indent=2)+'\\n');print(json.dumps(p))
'''.replace('@R@',repr(r)).replace('@OLD@',repr(old));compile(code,'strict-DSML-JSON-GPU-launch','exec');r['phase']='launch_requested';ip.write_text(json.dumps(r,indent=2)+'\n');r['process']=owned(code);r['phase']='launched';ip.write_text(json.dumps(r,indent=2)+'\n')
a=json.loads((BASE/'active-worktree.json').read_text());a.update(current_original_engine_trial=str(ip),current_original_engine_trial_phase='strict_tool_json_gpu_loading',current_optimization_no_active_model_worker=False);(BASE/'active-worktree.json').write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(dict(phase=r['phase'],gpu_uuid=r['gpu_uuid'],strict_native_arguments=True,prefill_chunk=128,formal_service_untouched=True)))
