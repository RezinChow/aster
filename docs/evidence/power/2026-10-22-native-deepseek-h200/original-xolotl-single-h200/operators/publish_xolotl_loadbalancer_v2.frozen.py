"""Publish an independently owned server VIP; no Windows process or shared gateway mutation."""
import json,time
from xolotl_serving_common import BASE,jump,observe
ip=BASE/'xolotl-server-loadbalancer-v2-intent.json'
if ip.exists():raise RuntimeError('LoadBalancer intent exists; inspect instead')
o=observe()
if o['job_uid']!='ea86cb78-5efd-472c-a4f7-d97c38a95637' or o['phase']!='Running':raise RuntimeError('exact live allocation changed')
spec=dict(apiVersion='v1',kind='Service',metadata=dict(name='aster-xolotl-api-v3pool-20261024',namespace='ailab-hrprdduanyan',labels={'app.kubernetes.io/managed-by':'aster-h200-deployment','aster-task':'xolotl-single-h200'},annotations={'aster.serving/allocation-uid':o['job_uid'],'aster.serving/lease-ends-unix':'1792859870.529365'},ownerReferences=[dict(apiVersion='rjob.brainpp.cn/v1alpha1',kind='RJob',name=o['job'],uid=o['job_uid'],controller=False,blockOwnerDeletion=False)]),spec=dict(type='LoadBalancer',allocateLoadBalancerNodePorts=False,externalTrafficPolicy='Cluster',selector={'rjob.brainpp.cn/rjob-name':o['job']},ports=[dict(name='openai-http',appProtocol='http',protocol='TCP',port=80,targetPort=30003)]))
spec['metadata']['annotations']['metallb.universe.tf/address-pool']='bgp-pool-v3'
rec=dict(unix=time.time(),phase='prepared',allocation_uid=o['job_uid'],service=spec,lease_ends_unix=1792859870.529365);ip.write_text(json.dumps(rec,indent=2)+'\n')
code='''import json,subprocess,shlex,time
r=@R@
def cli(args,data=None):
 return subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(['brainctl']+args)],input=data,capture_output=True,text=True,timeout=20)
p=cli(['get','service',r['service']['metadata']['name'],'-n','ailab-hrprdduanyan','-o','json'])
if p.returncode==0 or '(NotFound)' not in p.stderr:raise RuntimeError('new VIP service exclusivity is unproven')
p=cli(['create','--dry-run=server','-f','-','-o','json'],json.dumps(r['service']))
if p.returncode:raise RuntimeError('VIP service admission failed: '+p.stderr[-3000:])
p=cli(['create','-f','-','-o','json'],json.dumps(r['service']))
if p.returncode:raise RuntimeError('VIP service create failed: '+p.stderr[-3000:])
s=json.loads(p.stdout)
if s['spec']['selector']!=r['service']['spec']['selector'] or s['metadata']['name']!=r['service']['metadata']['name']:raise RuntimeError('created owned VIP service differs')
print(json.dumps(dict(unix=time.time(),service=s)))
'''.replace('@R@',repr(rec))
compile(code,'owned-server-vip-publication','exec');rec['phase']='create_requested';ip.write_text(json.dumps(rec,indent=2)+'\n');rec['created']=jump(code,85);rec['phase']='created';ip.write_text(json.dumps(rec,indent=2)+'\n');print(json.dumps(rec['created'],indent=2))
