"""Observe the launched confidence candidate, then a same-binary control once."""
import json,subprocess,sys,time
from xolotl_trial_common import BASE

path=BASE/'xolotl-conf300-pair-campaign.json'
if path.exists():raise RuntimeError('campaign already recorded; observe existing state')
names=['single-current-split-conf020','single-current-split-conf045-final']
state=dict(phase='running',completed=[],modes=names,started=time.time(),target_tok_s=300,goal_complete=False)
def save():path.write_text(json.dumps(state,indent=2)+'\n')
def run(script,*args):
 p=subprocess.run([sys.executable,'-X','utf8',str(BASE/script),*args],cwd=BASE,capture_output=True,text=True,timeout=100)
 if p.returncode:raise RuntimeError(script+' failed: '+p.stderr[-2000:])
 return p.stdout
save()
try:
 for name in names:
  state['current_mode']=name;save();p=BASE/('xolotl-'+name+'-intent.json')
  if not p.exists():print(run('launch_xolotl_protocol_trial.py','--mode',name),flush=True)
  intent=json.loads(p.read_text())
  if intent['plan']['binary_sha256']!='e943305094fd8612718cf817985cf232ee457e31d434c0512b32a8097e7f30b8' or intent['plan']['visible_devices']!='0':raise RuntimeError('single-device executable contract differs')
  end=min(intent['plan']['lease_ends_unix']-30,time.time()+360);phase=None
  while True:
   if time.time()>=end:raise TimeoutError('bounded confidence observation deadline')
   run('observe_xolotl_protocol_trial.py','--mode',name,'--brief')
   result=json.loads((BASE/('xolotl-'+name+'-latest.json')).read_text(encoding='utf-8')).get('result.json',{})
   if result.get('phase')!=phase:
    phase=result.get('phase');print(json.dumps(dict(mode=name,phase=phase,requests=len(result.get('requests',[])))),flush=True)
   if phase=='failed':raise RuntimeError('trial failed; retain '+name+' '+str(result.get('error')))
   if phase=='complete':
    if result.get('engine_exit')!=0 or not result.get('engine_reaped') or len(result['requests'])!=17:raise RuntimeError('trial not complete/reaped')
    state['completed'].append(name);save();break
   time.sleep(15)
 state['phase']='complete'
except Exception as e:state.update(phase='failed',error=str(e));raise
finally:state['unix']=time.time();save()
