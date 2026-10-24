"""Launch the bounded public V4 qualification on the cluster jump workspace."""
import base64,hashlib,json,time
from xolotl_longctx_common import BASE,jump,observe
ip=BASE/'xolotl-prefill-cache-qualification-v4-intent.json'
if ip.exists():raise RuntimeError('V4 qualification intent exists; inspect instead')
r=json.loads((BASE/'xolotl-prefill-shadow-v4-intent.json').read_text());old=json.loads((BASE/'xolotl-longctx-request-v1-intent.json').read_text());o=observe()
if o['phase']!='Running' or o['job_uid']!=r['allocation_uid']:raise RuntimeError('exact V4 allocation changed')
root=r['root']+'/qualification-v4';plan=dict(base_url='http://'+r['pod_ip']+':30003/v1',service_root=r['root'],public_fixture=old['root']+'/public-fixture.txt',fixture_sha256='8612db6d8a2201190388ee524d88dcb04dada6721f9e983f6389aaf722fbc808')
payload={'request-worker.py':(BASE/'xolotl_prefill_cache_worker_v4.py').read_bytes(),'request-plan.json':(json.dumps(plan,indent=2)+'\n').encode()}
rec=dict(unix=time.time(),phase='prepared',root=root,allocation_uid=r['allocation_uid'],files=[dict(file=n,bytes=len(b),sha256=hashlib.sha256(b).hexdigest()) for n,b in payload.items()]);ip.write_text(json.dumps(rec,indent=2)+'\n')
code='''import base64,hashlib,json,os,subprocess,time
from pathlib import Path
r=@R@;root=Path(r['root']);q=json.loads((root.parent/'service-longctx-v1-result.json').read_text())
if root.parent.resolve()!=root.parent or root.parent.stat().st_uid!=10250 or root.exists() or q['phase']!='serving':raise RuntimeError('V4 service must be ready and client stage exclusive')
root.mkdir(mode=0o700);data=@DATA@
for row in r['files']:
 raw=base64.b64decode(data[row['file']])
 if len(raw)!=row['bytes'] or hashlib.sha256(raw).hexdigest()!=row['sha256']:raise RuntimeError('frozen V4 public client differs')
 with (root/row['file']).open('xb') as f:f.write(raw)
with (root/'request-worker.log').open('xb') as log:
 child=subprocess.Popen(['timeout','--signal=TERM','--kill-after=15','1000','python3','-u',str(root/'request-worker.py')],cwd=root,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
p=dict(pid=child.pid,start_ticks=int(Path('/proc/'+str(child.pid)+'/stat').read_text().split(') ',1)[1].split()[19]),uid=os.getuid(),unix=time.time(),budget_seconds=1000)
(root/'request-process.json').write_text(json.dumps(p,indent=2)+'\\n');print(json.dumps(p))
'''.replace('@R@',repr(rec)).replace('@DATA@',repr({n:base64.b64encode(b).decode() for n,b in payload.items()}))
compile(code,'V4-prefill-cache-public-client-bootstrap','exec');rec['phase']='launch_requested';ip.write_text(json.dumps(rec,indent=2)+'\n');rec['process']=jump(code);rec['phase']='launched';ip.write_text(json.dumps(rec,indent=2)+'\n');print(json.dumps(dict(phase=rec['phase'],root=root)))
