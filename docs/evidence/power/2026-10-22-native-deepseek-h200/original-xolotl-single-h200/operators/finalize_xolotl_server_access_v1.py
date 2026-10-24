"""Verify cluster generation, free the shadow GPU, and retire only the two superseded owned ingress services."""
import hashlib,json,time
from pathlib import Path
from xolotl_longctx_common import BASE,observe,owned,jump
ip=BASE/'xolotl-server-access-finalization-v1.json'
if ip.exists():raise RuntimeError('access finalization receipt exists; inspect it')
stable=json.loads((BASE/'xolotl-stable-service-v3-intent.json').read_text());shadow=json.loads((BASE/'xolotl-longctx-shadow-v1-intent.json').read_text());client=json.loads((BASE/'xolotl-direct-windows-qualification-v1-result.json').read_text());o=observe()
if client['phase']!='passed' or any(not x['passed'] for x in client['tests']) or o['job_uid']!=shadow['allocation_uid'] or o['phase']!='Running':raise RuntimeError('formal Windows generation/owned optimization role is unqualified')
code='''import json,subprocess,time,socket,urllib.request
from pathlib import Path
stable=@STABLE@;shadow=@SHADOW@
q=json.loads((Path(shadow['root'])/'service-longctx-v1-result.json').read_text())
gpu=subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8,check=True).stdout.strip()
if q['phase']!='stopped' or not q.get('api_reaped') or gpu:raise RuntimeError('shadow API must be gracefully reaped and optimization GPU idle')
p=Path('/proc/'+str(shadow['process']['pid'])+'/stat')
if p.exists() and int(p.read_text().split(') ',1)[1].split()[19])==shadow['process']['start_ticks']:raise RuntimeError('exact shadow timeout supervisor still exists')
key=(Path(stable['root'])/'credentials/api-key.txt').read_text().strip();url='http://10.102.93.68/v1';opener=urllib.request.build_opener(urllib.request.ProxyHandler({}));tests=[]
for path,data in [('/models',None),('/chat/completions',dict(model=stable['plan']['model_name'],messages=[dict(role='user',content='Calculate 17 + 25. Reply with only the integer answer.')],max_tokens=16,temperature=0,seed=1,reasoning_effort='none'))]:
 req=urllib.request.Request(url+path,data=None if data is None else json.dumps(data).encode(),headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
 t=time.time()
 with opener.open(req,timeout=18) as response:body=json.load(response);status=response.status
 if status!=200 or (data and '42' not in body['choices'][0]['message']['content']):raise RuntimeError('independent cluster generation failed')
 tests.append(dict(path=path,status=status,body=body,seconds=time.time()-t))
print(json.dumps(dict(unix=time.time(),source_hostname=socket.gethostname(),source_pod_ip='100.97.136.42',source_host_ip='10.102.214.86',destination=url,tests=tests,shadow_result=q,optimization_gpu_apps=gpu,shadow_supervisor_gone=True)))
'''.replace('@STABLE@',repr(stable)).replace('@SHADOW@',repr(shadow))
compile(code,'independent-cluster-serving-validation','exec');cluster=owned(code)
rec=dict(unix=time.time(),phase='cluster_verified',base_url=client['base_url'],cluster=cluster,superseded_services=[]);ip.write_text(json.dumps(rec,indent=2)+'\n')
# Preserve the shadow reservation and now pin the active serving allocation against optimization.
reservation=BASE/'xolotl-active-serving-reservation.json';previous=reservation.read_bytes()
if json.loads(previous)['allocation_uid']!=shadow['allocation_uid']:raise RuntimeError('shadow reservation identity changed')
archive=BASE/'xolotl-shadow-serving-reservation-v1.frozen.json'
with archive.open('xb') as f:f.write(previous)
reservation.write_text(json.dumps(dict(schema='aster-serving-reservation-v1',unix=time.time(),allocation_uid=stable['allocation_uid'],gpu_uuid=stable['gpu_uuid'],purpose='active authenticated131072-context stable serving; prohibit optimization on this exact allocation',released_shadow_allocation_uid=shadow['allocation_uid'],prior_reservation_sha256=hashlib.sha256(previous).hexdigest(),shadow_reaped_receipt=ip.name),indent=2)+'\n')
rows=[]
for name in ['xolotl-server-nodeport-v1-intent.json','xolotl-server-loadbalancer-v1-intent.json']:
 r=json.loads((BASE/name).read_text());s=r['created']['service'];rows.append(dict(name=s['metadata']['name'],uid=s['metadata']['uid'],allocation_uid=r['allocation_uid']))
code='''import json,shlex,subprocess,time
rows=@ROWS@
def cli(args,data=None):
 return subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(['brainctl']+args)],input=data,capture_output=True,text=True,timeout=20)
out=[]
for row in rows:
 p=cli(['get','service',row['name'],'-n','ailab-hrprdduanyan','-o','json'])
 if p.returncode:raise RuntimeError('superseded exact service is unavailable')
 s=json.loads(p.stdout)
 if s['metadata']['uid']!=row['uid'] or s['metadata'].get('annotations',{}).get('aster.serving/allocation-uid')!=row['allocation_uid'] or s['metadata'].get('labels',{}).get('aster-task')!='xolotl-single-h200':raise RuntimeError('superseded owned service identity changed')
 options=dict(apiVersion='v1',kind='DeleteOptions',preconditions=dict(uid=row['uid']),propagationPolicy='Background')
 uri='/api/v1/namespaces/ailab-hrprdduanyan/services/'+row['name']
 p=cli(['delete','--raw='+uri,'-f','-'],json.dumps(options))
 if p.returncode:raise RuntimeError('UID-precondition service cleanup failed: '+p.stderr[-2000:])
 out.append(dict(name=row['name'],uid=row['uid'],deleted=True,uid_precondition=True))
print(json.dumps(dict(unix=time.time(),removed=out)))
'''.replace('@ROWS@',repr(rows))
compile(code,'uid-precondition-superseded-service-cleanup','exec');rec['superseded_services']=jump(code,95);rec.update(phase='passed',optimization_role_restored=True,active_serving_allocation_uid=stable['allocation_uid'],finished_unix=time.time());ip.write_text(json.dumps(rec,indent=2)+'\n');print(json.dumps(dict(phase=rec['phase'],base_url=rec['base_url'],cluster_generation_status=cluster['tests'][1]['status'],shadow_reaped=True,optimization_role_restored=True,superseded_services=rec['superseded_services']),indent=2))
