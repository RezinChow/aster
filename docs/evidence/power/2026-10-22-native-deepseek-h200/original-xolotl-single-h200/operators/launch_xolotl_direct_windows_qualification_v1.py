"""Copy only the public synthetic fixture and start a finite API client, never a tunnel."""
import ctypes,hashlib,json,subprocess,sys,time
from ctypes import wintypes
from xolotl_serving_common import BASE,jump
ip=BASE/'xolotl-direct-windows-qualification-v1-intent.json'
if ip.exists():raise RuntimeError('direct client intent exists; inspect instead')
stable=json.loads((BASE/'xolotl-stable-service-v3-intent.json').read_text());q=json.loads((BASE/'xolotl-longctx-request-v1-intent.json').read_text());v=json.loads((BASE/'xolotl-server-vip-v1-qualification.json').read_text())
if v['tests'][0]['status']!=200 or v['tests'][1]['body']['max_context']!=131072:raise RuntimeError('new server VIP must already be reachable directly')
code='''from pathlib import Path
import hashlib,json
root=Path(@ROOT@);p=root/'public-fixture.txt';r=json.loads((root/'request-result.json').read_text())
if root.resolve()!=root or root.stat().st_uid!=10250 or p.is_symlink() or p.stat().st_size>262144 or r['phase']!='passed':raise RuntimeError('qualified public long-context fixture differs')
b=p.read_bytes()
if hashlib.sha256(b).hexdigest()!=r['prompt_sha256']:raise RuntimeError('qualified public fixture SHA differs')
print(json.dumps(dict(text=b.decode(),sha256=r['prompt_sha256'],tokens=r['prompt_tokens_verified'])))
'''.replace('@ROOT@',repr(q['root']))
data=jump(code);name='xolotl-public-long-context35700-v1.txt';(BASE/name).write_bytes(data['text'].encode())
plan=dict(base_url=v['base_url'],model=stable['plan']['model_name'],context_tokens=131072,credential_file=stable['credential_file'],fixture_file=name,fixture_sha256=data['sha256'],fixture_prompt_tokens=data['tokens'],no_forwarding=True)
(BASE/'xolotl-direct-windows-qualification-v1-plan.json').write_text(json.dumps(plan,indent=2)+'\n')
worker=BASE/'qualify_xolotl_direct_windows_worker_v1.py';rec=dict(unix=time.time(),phase='launch_requested',worker_sha256=hashlib.sha256(worker.read_bytes()).hexdigest(),base_url=v['base_url'],no_forwarding=True)
ip.write_text(json.dumps(rec,indent=2)+'\n')
with (BASE/'xolotl-direct-windows-qualification-v1.stdout.log').open('xb') as a,(BASE/'xolotl-direct-windows-qualification-v1.stderr.log').open('xb') as b:
 p=subprocess.Popen([sys.executable,'-X','utf8',str(worker)],cwd=BASE,stdin=subprocess.DEVNULL,stdout=a,stderr=b,creationflags=subprocess.CREATE_NO_WINDOW)
ft=[wintypes.FILETIME() for _ in range(4)];fn=ctypes.windll.kernel32.GetProcessTimes;fn.argtypes=[wintypes.HANDLE]+[ctypes.POINTER(wintypes.FILETIME)]*4
if not fn(wintypes.HANDLE(int(p._handle)),*[ctypes.byref(x) for x in ft]):raise ctypes.WinError()
rec.update(phase='launched',pid=p.pid,created_filetime=(ft[0].dwHighDateTime<<32)|ft[0].dwLowDateTime);ip.write_text(json.dumps(rec,indent=2)+'\n');print(json.dumps(rec,indent=2))
