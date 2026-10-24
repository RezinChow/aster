"""Create one authenticated, task-owned server-side NodePort; never alter shared gateways."""
import json,time
from xolotl_serving_common import BASE,jump,observe
ip=BASE/'xolotl-server-nodeport-v1-intent.json'
if ip.exists():raise RuntimeError('server service intent exists; inspect instead')
o=observe();admission=json.loads((BASE/'xolotl-nodeport-admission-v1.json').read_text())
if o['job_uid']!='ea86cb78-5efd-472c-a4f7-d97c38a95637' or o['phase']!='Running' or admission['dry_run']['rc']!=0:raise RuntimeError('exact serving allocation/admission changed')
spec=admission['service'];spec['metadata']['ownerReferences']=[dict(apiVersion='rjob.brainpp.cn/v1alpha1',kind='RJob',name=o['job'],uid=o['job_uid'],controller=False,blockOwnerDeletion=False)]
rec=dict(unix=time.time(),phase='prepared',allocation_uid=o['job_uid'],allocation_job=o['job'],service=spec,lease_ends_unix=1792859870.529365)
ip.write_text(json.dumps(rec,indent=2)+'\n')
code='''import json,subprocess,shlex,time
r=@R@
def cli(args,data=None):
 return subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(['brainctl']+args)],input=data,capture_output=True,text=True,timeout=20)
p=cli(['get','service',r['service']['metadata']['name'],'-n','ailab-hrprdduanyan','-o','json'])
if p.returncode==0 or '(NotFound)' not in p.stderr:raise RuntimeError('new service exclusivity is not proven: '+p.stderr[-1000:])
p=cli(['get','rjob',r['allocation_job'],'-n','ailab-hrprdduanyan','-o','json'])
if p.returncode:raise RuntimeError('fresh serving identity unavailable')
j=json.loads(p.stdout)
if j['metadata']['uid']!=r['allocation_uid'] or j['status']['phase']!='Running':raise RuntimeError('fresh serving identity changed')
p=cli(['create','-f','-','-o','json'],json.dumps(r['service']))
if p.returncode:raise RuntimeError('owned service create failed: '+p.stderr[-3000:])
s=json.loads(p.stdout)
if s['metadata']['name']!=r['service']['metadata']['name'] or s['spec']['selector']!=r['service']['spec']['selector']:raise RuntimeError('created service differs')
print(json.dumps(dict(unix=time.time(),service=s)))
'''.replace('@R@',repr(rec))
compile(code,'owned-nodeport-publication','exec');rec['phase']='create_requested';ip.write_text(json.dumps(rec,indent=2)+'\n');rec['created']=jump(code,75);rec['phase']='created';ip.write_text(json.dumps(rec,indent=2)+'\n');s=rec['created']['service'];print(json.dumps(dict(phase='created',uid=s['metadata']['uid'],cluster_ip=s['spec']['clusterIP'],port=s['spec']['ports'][0]['nodePort'],windows_forwarding_required=False)))
