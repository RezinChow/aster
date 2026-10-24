"""Read only the current user's workspace ingress and available platform options."""
import json
from xolotl_serving_common import BASE,jump
code='''import json,os,subprocess,shlex,socket,time
out=dict(unix=time.time(),hostname=socket.gethostname())
commands=[
 ('workspace',['brainctl','get','workspace','yangchao-dev','-n','ailab-hrprdduanyan','-o','json']),
 ('rjob_help',['rjob','submit','--help']),
 ('get_help',['brainctl','get','--help']),
 ('tools',['sh','-c','for x in rjob wport rport socat nginx curl ss ip; do command -v "$x" || true; done']),
 ('listeners',['ss','-ltn']),
]
for name,args in commands:
 p=subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(args)],capture_output=True,text=True,timeout=20)
 if len(p.stdout)>262144:raise RuntimeError('workspace ingress inspection exceeds bound')
 if name=='workspace' and p.returncode==0:
  j=json.loads(p.stdout);m=j['metadata'];out[name]=dict(metadata=dict(name=m['name'],uid=m['uid'],labels=m.get('labels'),annotations=m.get('annotations')),spec=j.get('spec'),status=j.get('status'))
 else:out[name]=dict(rc=p.returncode,stdout=p.stdout[-18000:],stderr=p.stderr[-2000:])
print(json.dumps(out))
'''
compile(code,'server-ingress-readonly','exec');r=jump(code,100)
# Inspect before retaining: platform output may include unrelated managed auth metadata.
for name in ['rjob_help','get_help','tools','listeners']:
 print(name+': '+json.dumps(r.get(name),ensure_ascii=False))
w=r.get('workspace');print('workspace: '+json.dumps(w,ensure_ascii=False))
