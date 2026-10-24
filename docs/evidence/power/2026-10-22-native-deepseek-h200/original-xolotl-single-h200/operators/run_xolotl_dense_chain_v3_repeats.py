"""Finish the frozen ABBAAB campaign sequentially; never re-submit an existing intent."""
import json,subprocess,sys,time
from xolotl_trial_common import BASE,lease
campaign=json.loads((BASE/'xolotl-dense-chain-v3-repeat-campaign.json').read_text());r=lease()
if r['submitted']['uid']!='b226d64c-28cc-4f38-94d0-a02688df6133':raise RuntimeError('repeat lease identity differs')
state=dict(unix=time.time(),phase='running',order=campaign['order'],completed=[],current=None,adopted=False)
path=BASE/'xolotl-dense-chain-v3-repeat-progress.json'
if path.exists():raise RuntimeError('repeat coordinator record exists; inspect it before any new coordinator')
def save():path.write_text(json.dumps(state,indent=2)+'\n')
def result(mode):return json.loads((BASE/('xolotl-'+mode+'-latest.json')).read_text())['result.json']
def require_complete(mode):
 q=result(mode)
 if q['phase']!='complete' or q.get('engine_exit')!=0 or not q.get('engine_reaped') or len(q['requests'])!=17:raise RuntimeError('previous trial is not cleanly complete: '+mode)
def command(name,args):
 p=subprocess.run([sys.executable,'-X','utf8',str(BASE/name)]+args,capture_output=True,text=True,encoding='utf-8',timeout=65)
 if p.returncode:raise RuntimeError(name+' failed: '+(p.stderr+p.stdout)[-1800:])
 return json.loads(p.stdout)
save()
try:
 for mode in campaign['order'][:2]:require_complete(mode);state['completed'].append(mode)
 for mode in campaign['order'][2:]:
  state['current']=mode;save();intent=BASE/('xolotl-'+mode+'-intent.json')
  if not intent.exists():
   require_complete(state['completed'][-1]);proof=json.loads((BASE/'xolotl-trial-resource-latest.json').read_text())
   if proof['job_uid']!=r['submitted']['uid'] or time.time()+370>proof['resource-result.json']['leaseEndsUnix']:raise RuntimeError('remaining immutable lease cannot fit a new300-second trial')
   state['last_launch']=command('launch_xolotl_dense_chain_v3_repeat.frozen.py',['--mode',mode]);save()
  else:
   current=json.loads(intent.read_text())
   if current.get('job_uid')!=r['submitted']['uid']:raise RuntimeError('existing repeat belongs to another allocation')
  last=None
  while True:
   o=command('observe_xolotl_dense_chain_v3_repeat.frozen.py',['--mode',mode,'--brief']);q=result(mode)
   marker=(q['phase'],len(q['requests']))
   if marker!=last:print(json.dumps(dict(mode=mode,phase=marker[0],requests=marker[1],unix=time.time())),flush=True);last=marker
   state['observed_phase']=q['phase'];state['observed_requests']=len(q['requests']);save()
   if q['phase'] in ['complete','failed']:
    require_complete(mode);command('inspect_xolotl_dense_chain_v3_repeat_runtime.py',['--mode',mode]);state['completed'].append(mode);save();break
   if time.time()>json.loads(intent.read_text())['process']['unix']+390:raise RuntimeError('trial observation exceeds its immutable worker deadline; inspect exact process')
   time.sleep(20)
 state['comparison']=command('compare_xolotl_dense_chain_v3_repeats.py',[]);state.update(phase='complete',current=None,finished_unix=time.time());save();print(json.dumps(state['comparison']),flush=True)
except Exception as e:
 state.update(phase='failed',error=str(e),finished_unix=time.time());save();raise
