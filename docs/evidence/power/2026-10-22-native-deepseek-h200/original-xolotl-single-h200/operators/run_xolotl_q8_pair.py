"""Observe existing Q8 control, then launch its candidate once after clean exit."""
import json,subprocess,sys,time
from xolotl_trial_common import BASE
path=BASE/'xolotl-q8-pair-campaign.json'
if path.exists():raise RuntimeError('Q8 pair already recorded; inspect existing state')
names=['single-current-q8-control','single-current-q8-mmq'];s=dict(phase='running',completed=[],modes=names,started=time.time(),goal_complete=False)
def save():path.write_text(json.dumps(s,indent=2)+'\n')
def run(script,*args):
 p=subprocess.run([sys.executable,'-X','utf8',str(BASE/script),*args],cwd=BASE,capture_output=True,text=True,timeout=100)
 if p.returncode:raise RuntimeError(script+' failed: '+p.stderr[-2000:])
 return p.stdout
save()
try:
 for name in names:
  s['current_mode']=name;save();p=BASE/('xolotl-'+name+'-intent.json')
  if not p.exists():print(run('launch_xolotl_protocol_trial.py','--mode',name),flush=True)
  intent=json.loads(p.read_text())
  if intent['plan']['binary_sha256']!='860c23449c843a67cb34534725a908bbba5323f8a58e9153f6e4ef6b91f1bbe4' or intent['plan']['visible_devices']!='0':raise RuntimeError('Q8 single-device executable contract differs')
  end=min(intent['plan']['lease_ends_unix']-60,time.time()+660);phase=None
  while True:
   if time.time()>=end:raise TimeoutError('bounded Q8 observation deadline')
   run('observe_xolotl_protocol_trial.py','--mode',name,'--brief');r=json.loads((BASE/('xolotl-'+name+'-latest.json')).read_text(encoding='utf-8')).get('result.json',{})
   if r.get('phase')!=phase:phase=r.get('phase');print(json.dumps(dict(mode=name,phase=phase,requests=len(r.get('requests',[])))),flush=True)
   if phase=='failed':raise RuntimeError('Q8 trial failed; preserve '+name+' '+str(r.get('error')))
   if phase=='complete':
    if r.get('engine_exit')!=0 or not r.get('engine_reaped') or len(r['requests'])!=17:raise RuntimeError('Q8 trial not complete/reaped')
    s['completed'].append(name);save();break
   time.sleep(15)
 s['phase']='complete'
except Exception as e:s.update(phase='failed',error=str(e));raise
finally:s['unix']=time.time();save()
