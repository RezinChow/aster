"""One closed six-run campaign; existing intents are observed, never restarted."""
import json,subprocess,sys,time
from xolotl_trial_common import BASE,lease
names=['single-current-split-control-b2','single-current-split-hybrid','single-current-split-control-b3','single-current-split-hybrid-b2','single-current-split-control-b4','single-current-split-hybrid-b3']
record=BASE/'xolotl-alternating-campaign.json'
if record.exists():raise RuntimeError('campaign controller already recorded; inspect its exact state')
state=dict(phase='running',modes=names,completed=[],started=time.time(),target_single_request_tok_s=500,goal_complete=False)
deadline=json.loads((BASE/'xolotl-trial-resource-latest.json').read_text())['resource-result.json']['leaseEndsUnix']-60
state['immutable_deadline']=deadline
def save():
 p=record.with_suffix('.tmp');p.write_text(json.dumps(state,indent=2)+'\n');p.replace(record)
def run(script,*args):
 p=subprocess.run([sys.executable,'-X','utf8',str(BASE/script),*args],cwd=BASE,capture_output=True,text=True,timeout=100)
 if p.returncode:raise RuntimeError(script+' failed: '+p.stderr[-3000:]+p.stdout[-1000:])
 return p.stdout
save()
try:
 for mode in names:
  state['current_mode']=mode;save()
  intentpath=BASE/('xolotl-'+mode+'-intent.json')
  if not intentpath.exists():print(run('launch_xolotl_protocol_trial.py','--mode',mode),flush=True)
  intent=json.loads(intentpath.read_text())
  if intent['plan']['visible_devices']!='0' or intent['plan']['binary_sha256']!='e943305094fd8612718cf817985cf232ee457e31d434c0512b32a8097e7f30b8':raise RuntimeError('alternating single-device executable contract differs')
  last_phase=None
  while True:
   if time.time()>=deadline:raise TimeoutError('immutable campaign deadline reached')
   run('observe_xolotl_protocol_trial.py','--mode',mode,'--brief')
   r=json.loads((BASE/('xolotl-'+mode+'-latest.json')).read_text(encoding='utf-8')).get('result.json',{})
   phase=r.get('phase')
   if phase!=last_phase:print(json.dumps(dict(mode=mode,phase=phase,requests=len(r.get('requests',[])))),flush=True);last_phase=phase
   if phase=='failed':raise RuntimeError('trial failed; preserve and inspect: '+mode+' '+str(r.get('error')))
   if phase=='complete':
    if r.get('engine_exit')!=0 or not r.get('engine_reaped') or len(r['requests'])!=17:raise RuntimeError('trial not orderly complete')
    state['completed'].append(mode);save();print(json.dumps(dict(completed=mode)),flush=True);break
   time.sleep(15)
 state['phase']='complete'
except Exception as e:state.update(phase='failed',error=str(e));raise
finally:state['unix']=time.time();save()
