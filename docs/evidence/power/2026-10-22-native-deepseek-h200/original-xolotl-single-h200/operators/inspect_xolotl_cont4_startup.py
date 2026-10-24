"""Inspect only the exact scheduled replica and its events; no restart or new job."""
import json
from xolotl_trial_common import BASE,lease,jump
r=lease();o=json.loads((BASE/'xolotl-trial-resource-latest.json').read_text())
if r['submitted']['uid']!='b226d64c-28cc-4f38-94d0-a02688df6133' or o['job_uid']!=r['submitted']['uid'] or len(o['replicas'])!=1:raise RuntimeError('startup identity differs')
replica=o['replicas'][0]
code='''import subprocess,shlex,json,time
def cli(args):return subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(args)],capture_output=True,text=True,timeout=25)
p=cli(['brainctl','get','replica',@NAME@,'-n','ailab-hrprdduanyan','-o','json'])
if p.returncode:raise RuntimeError('exact replica inspection failed')
v=json.loads(p.stdout)
if v['metadata']['uid']!=@UID@:raise RuntimeError('replica UID differs')
out=dict(unix=time.time(),replica_uid=@UID@,phase=v['status']['phase'],container_statuses=v['status'].get('containerStatuses',[]))
p=cli(['brainctl','get','events','-n','ailab-hrprdduanyan','--field-selector','involvedObject.uid='+@UID@,'-o','json'])
if len(p.stdout)>1048576:raise RuntimeError('event output bound exceeded')
if p.returncode:out['event_query_exit']=p.returncode
else:
 events=json.loads(p.stdout).get('items',[])
 out['events']=[dict(reason=x.get('reason'),message=x.get('message','')[:1000],count=x.get('count'),first=x.get('firstTimestamp'),last=x.get('lastTimestamp')) for x in events[-20:]]
print(json.dumps(out))
'''.replace('@NAME@',repr(replica['name'])).replace('@UID@',repr(replica['uid']))
v=jump(code,65);(BASE/'xolotl-cont4-startup-latest.json').write_text(json.dumps(v,indent=2)+'\n');print(json.dumps(v,indent=2))
