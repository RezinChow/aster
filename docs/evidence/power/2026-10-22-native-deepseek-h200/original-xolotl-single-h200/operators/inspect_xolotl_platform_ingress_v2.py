"""Bounded read-only discovery of the exact service pod and platform service API."""
import json
from xolotl_serving_common import jump
code='''import json,subprocess,shlex,os,socket,time
out=dict(unix=time.time(),hostname=socket.gethostname(),identity_env={k:os.environ[k] for k in ['HOSTNAME','WORKSPACE_NAME','POD_NAME','POD_NAMESPACE','NAMESPACE','SSH_CONNECTION'] if k in os.environ})
commands=[('addresses',['ip','-j','addr']),('api',['brainctl','api-resources']),('services',['brainctl','get','services','-n','ailab-hrprdduanyan','-o','json']),('pod',['brainctl','get','pods','-n','ailab-hrprdduanyan','--field-selector=status.podIP=100.97.24.7','-o','json'])]
for name,args in commands:
 p=subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(args)],capture_output=True,text=True,timeout=20)
 if len(p.stdout)>4*1024**2:raise RuntimeError('ingress observation exceeded bound')
 if p.returncode==0 and name=='services':
  v=json.loads(p.stdout);out[name]=[dict(name=x['metadata']['name'],uid=x['metadata']['uid'],type=x.get('spec',{}).get('type'),ports=x.get('spec',{}).get('ports'),externalIPs=x.get('spec',{}).get('externalIPs'),ingress=x.get('status',{})) for x in v.get('items',[])]
 elif p.returncode==0 and name=='pod':
  v=json.loads(p.stdout);out[name]=[dict(metadata={k:x['metadata'].get(k) for k in ['name','namespace','uid','labels','ownerReferences']},hostNetwork=x.get('spec',{}).get('hostNetwork'),nodeName=x.get('spec',{}).get('nodeName'),status={k:x.get('status',{}).get(k) for k in ['phase','podIP','hostIP']}) for x in v.get('items',[])]
 elif p.returncode==0 and name=='addresses':
  out[name]=[dict(ifname=x['ifname'],addr_info=x.get('addr_info')) for x in json.loads(p.stdout)]
 else:out[name]=dict(rc=p.returncode,stdout=p.stdout[-18000:],stderr=p.stderr[-3000:])
print(json.dumps(out))
'''
compile(code,'platform-ingress-inspection','exec');print(json.dumps(jump(code,105),ensure_ascii=False,indent=2))
