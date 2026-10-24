"""Recover the proven missing-environment failure without restarting downloaders."""
import importlib.util,json
from pathlib import Path
out=Path('target/h200-native');intent=out/'xq-environment-recovery-intent.json'
if intent.exists():raise RuntimeError('XQ environment recovery intent exists; inspect instead of retrying')
expected=json.loads(Path('docs/evidence/power/2026-10-22-native-deepseek-h200/xq-submission-inspection-1792757891.json').read_text())
if expected['matching_jobs'] or expected['predict_only']['plain']['exit']!=1 or expected['predict_only']['initialized']['exit']!=0:raise RuntimeError('missing-environment diagnosis is not proven')
intent.write_text(json.dumps({'expected_state':expected['state'],'phase':'inspecting_for_environment_recovery'},indent=2)+'\n')
s=importlib.util.spec_from_file_location('remote',out/'remote_readonly.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
code='''from pathlib import Path
import contextlib,fcntl,hashlib,importlib.util,io,json,os,shlex,shutil,subprocess,sys,time,types
root=Path('/mnt/shared-storage-user/yangchao/Workspace/aster-h200-xq');expected=@EXPECTED@
with (root/'deferred-launch.lock').open('a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 canonical=root/'deployment-state.json'
 if json.loads(canonical.read_text())!=expected:raise RuntimeError('deployment state changed; recovery refused')
 try:
  v=Path('/proc/335316/stat').read_text().rsplit(')',1)[1].split()
  if int(v[19])==259373957 and v[0]not in('Z','X'):raise RuntimeError('original waiter is still live')
 except FileNotFoundError:pass
 p=subprocess.run(['brainctl','get','rjobs','-n','ailab-hrprdduanyan','-o','json'],capture_output=True,text=True,check=True,timeout=15)
 if any(j['metadata'].get('annotations',{}).get('kubebrain.brainpp.cn/showname')==expected['showname'] for j in json.loads(p.stdout)['items']):raise RuntimeError('original submission exists; do not submit again')
 log=root/'logs/model-fetch-network-retry-workers8.log'
 if log.stat().st_size>16*1024**2 or 'MODEL_PARTS_VERIFIED' not in log.read_text().splitlines():raise RuntimeError('original downloader has not completed verification')
 operators=json.loads((root/'operator-files.json').read_text());entry=[x for x in operators if x['file']=='deferred_launch.py']
 if len(entry)!=1 or hashlib.sha256((root/'deferred_launch.py').read_bytes()).hexdigest()!=entry[0]['sha256']:raise RuntimeError('verified launcher source changed')
 recovery=root/('xq-environment-recovery-'+str(int(time.time())));recovery.mkdir(mode=0o700)
 receipt={'unix':time.time(),'phase':'recovering_missing_cluster_environment','prior_state':expected,'recovery_directory':str(recovery),'downloaders_restarted':False,'original_cli_failure_reproduced_without_initialization':True,'initialized_predict_exit':0}
 (recovery/'receipt.json').write_text(json.dumps(receipt,indent=2))
 sys.path.insert(0,str(root));spec=importlib.util.spec_from_file_location('owned_xq_launcher',root/'deferred_launch.py');launcher=importlib.util.module_from_spec(spec);spec.loader.exec_module(launcher)
 actual_run=subprocess.run;attempts=[]
 def initialized_run(command,*args,**kwargs):
  if command[:2]==['rjob','submit']:
   if '--gpu=8' not in command or '--charged-group=hrprda3s_gpu_pool' not in command or '--restart-policy=never' not in command:raise RuntimeError('recovery may only use the already authorized eight-card XQ command')
   attempts.append(command);(recovery/'submission-command.json').write_text(json.dumps(command,indent=2))
   p=actual_run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(command)],*args,**kwargs)
   (recovery/'submission.stdout.log').write_text(p.stdout);(recovery/'submission.stderr.log').write_text(p.stderr)
   return p
  return actual_run(command,*args,**kwargs)
 launcher.subprocess=types.SimpleNamespace(run=initialized_run)
 canonical.rename(recovery/'original-failed-deployment-state.json')
 try:
  with (recovery/'launcher.log').open('w') as output,contextlib.redirect_stdout(output):launcher.launch_if_ready()
  receipt['phase']='submitted';receipt['new_state']=json.loads(canonical.read_text())
 except Exception as error:
  receipt.update(phase='needs_inspection',error_type=type(error).__name__,error=str(error))
  if not canonical.exists() and not attempts:shutil.copy2(recovery/'original-failed-deployment-state.json',canonical)
  if canonical.exists():receipt['new_state']=json.loads(canonical.read_text())
 receipt['submission_attempts']=len(attempts)
 state=receipt.get('new_state',{})
 if state.get('rjob'):
  p=actual_run(['brainctl','get','rjob',state['rjob'],'-n','ailab-hrprdduanyan','-o','json'],capture_output=True,text=True,check=True,timeout=15);job=json.loads(p.stdout)
  if job['metadata'].get('annotations',{}).get('kubebrain.brainpp.cn/showname')!=state['showname']:raise RuntimeError('recovered RJob ownership mismatch')
  receipt.update(rjob=job['metadata']['name'],uid=job['metadata']['uid'],job_phase=job.get('status',{}).get('phase'))
 (recovery/'receipt.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
'''.replace('@EXPECTED@',repr(expected['state']))
result=m.inspect_jump(code,timeout=100)
intent.write_text(json.dumps(result,indent=2)+'\n');Path('docs/evidence/power/2026-10-22-native-deepseek-h200/xq-environment-submission-recovery.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
