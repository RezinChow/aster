"""Stop only the exact finished pair allocation, retaining every artifact."""
import json,time
from xolotl_trial_common import BASE,lease,owned,jump

path=BASE/'xolotl-cont1-retired-after-mma.json'
if path.exists():raise RuntimeError('retirement already recorded; inspect current metadata')
for name in ['single-current-mma-control','single-current-mma-candidate']:
 r=json.loads((BASE/('xolotl-'+name+'-latest.json')).read_text(encoding='utf-8'))['result.json']
 if r['phase']!='complete' or r['engine_exit']!=0 or not r['engine_reaped']:raise RuntimeError('all active trials must finish and reap before resource stop')
idle=owned("import subprocess,json; p=subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8,check=True); print(json.dumps(dict(idle=not p.stdout.strip(),active=p.stdout)))")
if not idle['idle']:raise RuntimeError('GPU workload still present; no stop')
old=lease();obs=json.loads((BASE/'xolotl-trial-resource-latest.json').read_text());replica=obs['replicas'][0]
record=dict(unix=time.time(),phase='stop_requested',job=old['submitted']['rjob'],job_uid=old['submitted']['uid'],replica=replica['name'],replica_uid=replica['uid'],idle_proof=idle,reason='all exact-code controls and full-model MMA A/B completed; retire idle allocation while original MTP sidecar downloads locally')
path.write_text(json.dumps(record,indent=2)+'\n')
code='''import subprocess,shlex,json,time
r=@RECORD@
def cli(args):return subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(args)],capture_output=True,text=True,timeout=20,check=True)
def get(kind,name):return json.loads(cli(['brainctl','get',kind,name,'-n','ailab-hrprdduanyan','-o','json']).stdout)
j=get('rjob',r['job']);p=get('replica',r['replica'])
if j['metadata']['uid']!=r['job_uid'] or p['metadata']['uid']!=r['replica_uid'] or j['status']['phase']!='Running' or p['status']['phase']!='Running':raise RuntimeError('exact running predecessor changed; no stop')
s=cli(['rjob','stop','--namespace','ailab-hrprdduanyan',r['job']])
j=get('rjob',r['job']);p=get('replica',r['replica'])
if j['metadata']['uid']!=r['job_uid'] or p['metadata']['uid']!=r['replica_uid']:raise RuntimeError('predecessor identity changed after stop')
print(json.dumps(dict(unix=time.time(),job_phase=j['status']['phase'],replica_phase=p['status']['phase'],stop_stdout=s.stdout)))
'''.replace('@RECORD@',repr(record))
record['observed']=jump(code,85);record['phase']='stop_observed';path.write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record,indent=2))
