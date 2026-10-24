"""Read the exact owned replica labels, then ask server dry-run to validate a new owned service."""
import json,time
from xolotl_serving_common import BASE,jump,observe
o=observe()
if o['phase']!='Running' or o['job_uid']!='ea86cb78-5efd-472c-a4f7-d97c38a95637':raise RuntimeError('stable allocation changed')
code='''import json,subprocess,shlex,time
o=@O@
def cli(args,data=None):
 p=subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(['brainctl']+args)],input=data,capture_output=True,text=True,timeout=20)
 if len(p.stdout)>1048576:raise RuntimeError('service admission result exceeds bound')
 return p
p=cli(['get','replica',o['replicas'][0]['name'],'-n','ailab-hrprdduanyan','-o','json'])
if p.returncode:raise RuntimeError('exact owned replica metadata unavailable: '+p.stderr[-1000:])
r=json.loads(p.stdout)
if r['metadata']['uid']!=o['replicas'][0]['uid']:raise RuntimeError('exact owned replica UID changed')
labels=r['metadata'].get('labels',{})
if labels.get('rjob.brainpp.cn/rjob-name')!=o['job']:raise RuntimeError('exact job selector is absent on the owned replica')
spec=dict(apiVersion='v1',kind='Service',metadata=dict(name='aster-xolotl-serving-20261024',namespace='ailab-hrprdduanyan',labels={'app.kubernetes.io/managed-by':'aster-h200-deployment','aster-task':'xolotl-single-h200'},annotations={'aster.serving/allocation-uid':o['job_uid'],'aster.serving/lease-ends-unix':'1792859870.529365'}),spec=dict(type='NodePort',externalTrafficPolicy='Cluster',selector={'rjob.brainpp.cn/rjob-name':o['job']},ports=[dict(name='openai-http',protocol='TCP',port=30003,targetPort=30003,nodePort=30003)]))
p=cli(['create','--dry-run=server','-f','-','-o','json'],json.dumps(spec))
print(json.dumps(dict(unix=time.time(),replica_api_version=r.get('apiVersion'),replica_kind=r.get('kind'),replica_metadata={k:r['metadata'].get(k) for k in ['name','namespace','uid','labels','ownerReferences']},replica_spec_keys=list(r.get('spec',{})),service=spec,dry_run=dict(rc=p.returncode,stdout=p.stdout[-12000:],stderr=p.stderr[-6000:]))))
'''.replace('@O@',repr(o))
compile(code,'owned-service-server-dry-run','exec');r=jump(code,80);(BASE/'xolotl-nodeport-admission-v1.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
