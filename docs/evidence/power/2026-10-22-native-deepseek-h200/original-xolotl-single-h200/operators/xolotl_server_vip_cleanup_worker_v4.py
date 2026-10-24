"""Bounded server-side VIP cleanup. Never deletes a service reassigned to another allocation."""
import json,shlex,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent;P=json.loads((ROOT/'cleanup-plan.json').read_text())
STATE=dict(phase='waiting',unix=time.time(),deadline_unix=P['lease_ends_unix'])
def save():
 p=ROOT/'cleanup-result.tmp';p.write_text(json.dumps(STATE,indent=2)+'\n');p.replace(ROOT/'cleanup-result.json')
def cli(args,data=None):return subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(['brainctl']+args)],input=data,capture_output=True,text=True,timeout=20)
try:
 save()
 while time.time()<P['lease_ends_unix']+5:time.sleep(min(30,max(0.1,P['lease_ends_unix']+5-time.time())))
 p=cli(['get','service',P['service_name'],'-n',P['namespace'],'-o','json'])
 if p.returncode and '(NotFound)' in p.stderr:STATE.update(phase='already_absent',finished_unix=time.time());save()
 else:
  p.check_returncode();s=json.loads(p.stdout)
  if s['metadata']['uid']!=P['service_uid'] or s['metadata'].get('annotations',{}).get('aster.serving/allocation-uid')!=P['allocation_uid'] or s['metadata'].get('annotations',{}).get('aster.serving/lease-ends-unix')!=str(P['lease_ends_unix']):
   STATE.update(phase='reassigned_service_preserved',finished_unix=time.time());save()
  else:
   options=dict(apiVersion='v1',kind='DeleteOptions',preconditions=dict(uid=P['service_uid'],resourceVersion=s['metadata']['resourceVersion']),propagationPolicy='Background')
   p=cli(['delete','--raw=/api/v1/namespaces/'+P['namespace']+'/services/'+P['service_name'],'-f','-'],json.dumps(options));p.check_returncode()
   STATE.update(phase='deleted',uid_precondition=True,resource_version_precondition=True,finished_unix=time.time());save()
except BaseException as e:
 STATE.update(phase='failed',error=type(e).__name__+': '+str(e),finished_unix=time.time());save();raise
