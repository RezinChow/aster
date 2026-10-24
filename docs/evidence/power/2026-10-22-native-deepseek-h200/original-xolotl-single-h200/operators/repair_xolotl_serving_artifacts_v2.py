"""Preserve the failed first attempt and supply its missing upstream test template."""
import ast,base64,hashlib,json,time
from xolotl_serving_common import BASE,owned
r=json.loads((BASE/'xolotl-stable-service-intent.json').read_text());ip=BASE/'xolotl-stable-service-v2-intent.json'
if ip.exists():raise RuntimeError('V2 service intent exists; inspect instead')
source=BASE/'xolotl-trial-source-e9d0826d71c5/source';payload={}
for n in ['serve/chat_template.jinja','serve/chat_golden.json']:payload['source/'+n]=(source/n).read_bytes()
s=(BASE/'xolotl_stable_service_worker.py').read_text()
for a,b in [('service-result','service-v2-result'),("ROOT/'python-deps'","ROOT/'python-deps-v2'"),("'security-tests'","'security-tests-v2'"),("'ds41-api-tests'","'ds41-api-tests-v2'"),("'prompt-id-tests'","'prompt-id-tests-v2'"),("'api-attempt'","'api-v2-attempt'")]:
 if a not in s:raise RuntimeError('V2 service worker anchor differs: '+a)
 s=s.replace(a,b)
rows=[dict(file=n,bytes=len(b),sha256=hashlib.sha256(b).hexdigest()) for n,b in payload.items()]
a=" for m in PLAN['inputs']:"
if s.count(a)!=1:raise RuntimeError('V2 supplemental source verification anchor differs')
s=s.replace(a," for r in "+repr(rows)+":\n  p=ROOT/r['file']\n  if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size!=r['bytes'] or digest(p)!=r['sha256']:raise RuntimeError('supplemental upstream test template differs')\n"+a)
ast.parse(s);(BASE/'xolotl_stable_service_worker_v2.frozen.py').write_text(s);payload['service-worker-v2.py']=s.encode()
r.update(phase='prepared',supersedes='xolotl-stable-service-intent.json',reason='Initial CPU security tests failed before GPU startup because the public bundle omitted upstream serve/chat_template.jinja',unix=time.time(),supplemental_files=[dict(file=n,bytes=len(b),sha256=hashlib.sha256(b).hexdigest()) for n,b in payload.items()]);ip.write_text(json.dumps(r,indent=2)+'\n')
code='''from pathlib import Path
import os,json,hashlib,base64,subprocess,time
r=@R@;root=Path(r['root']);q=json.loads((root/'service-result.json').read_text());old=json.loads((root/'service-process.json').read_text())
if root.resolve()!=root or root.stat().st_uid!=10250 or q['phase']!='failed' or not q.get('api_reaped') or q.get('error')!='RuntimeError: security-tests exit 1':raise RuntimeError('initial failed service receipt differs')
p=Path('/proc/'+str(old['pid'])+'/stat')
if p.exists() and int(p.read_text().split(') ',1)[1].split()[19])==old['start_ticks']:raise RuntimeError('old exact service supervisor still exists')
active=subprocess.run(['nvidia-smi','--query-compute-apps=pid','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8,check=True)
if active.stdout.strip():raise RuntimeError('serving repair requires no GPU workload')
data=@DATA@
for m in r['supplemental_files']:
 raw=base64.b64decode(data[m['file']])
 if len(raw)!=m['bytes'] or hashlib.sha256(raw).hexdigest()!=m['sha256']:raise RuntimeError('V2 source supplement differs')
 with (root/m['file']).open('xb') as f:f.write(raw)
deadline=int(r['plan']['lease_ends_unix']-time.time()-10)
if deadline<600:raise RuntimeError('V2 service deadline insufficient')
with (root/'service-worker-v2.log').open('xb') as log:
 child=subprocess.Popen(['timeout','--signal=TERM','--kill-after=30',str(deadline),'python3','-u',str(root/'service-worker-v2.py')],cwd=root,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
process=dict(pid=child.pid,start_ticks=int(Path('/proc/'+str(child.pid)+'/stat').read_text().split(') ',1)[1].split()[19]),uid=os.getuid(),unix=time.time(),deadline_seconds=deadline)
(root/'service-v2-process.json').write_text(json.dumps(process,indent=2)+'\\n');print(json.dumps(process))
'''.replace('@R@',repr(r)).replace('@DATA@',repr({n:base64.b64encode(b).decode() for n,b in payload.items()}));compile(code,'stable-service-v2-bootstrap','exec');r['phase']='launch_requested';ip.write_text(json.dumps(r,indent=2)+'\n');r['process']=owned(code);r['phase']='launched';ip.write_text(json.dumps(r,indent=2)+'\n')
obs=(BASE/'observe_xolotl_stable_service.py').read_text()
for a,b in [('xolotl-stable-service-intent.json','xolotl-stable-service-v2-intent.json'),('xolotl-stable-service-latest.json','xolotl-stable-service-v2-latest.json'),('service-result.json','service-v2-result.json'),('service-process.json','service-v2-process.json'),('service-worker.log','service-worker-v2.log'),('security-tests.stderr.log','security-tests-v2.stderr.log'),('ds41-api-tests.stdout.log','ds41-api-tests-v2.stdout.log'),('ds41-api-tests.stderr.log','ds41-api-tests-v2.stderr.log'),('prompt-id-tests.stdout.log','prompt-id-tests-v2.stdout.log'),('prompt-id-tests.stderr.log','prompt-id-tests-v2.stderr.log'),('api-attempt1','api-v2-attempt1')]:obs=obs.replace(a,b)
ast.parse(obs);(BASE/'observe_xolotl_stable_service_v2.frozen.py').write_text(obs)
print(json.dumps(dict(phase='launched',failed_v1_preserved=True,supplemental_public_files=2,process=r['process'])))
