"""Use preinstalled WorkBuddy node/CLI with its real approved custom provider; keep raw logs private."""
import ctypes,hashlib,json,subprocess,sys,time
from ctypes import wintypes
from pathlib import Path
BASE=Path(__file__).resolve().parent
ip=BASE/'workbuddy-builtin-e2e-v1-intent.json'
if ip.exists():raise RuntimeError('WorkBuddy client E2E intent exists; inspect it')
r=json.loads((BASE/'xolotl-stable-service-v4-intent.json').read_text());private=Path(r['credential_file']).parent/'workbuddy-e2e-v1';private.mkdir()
plan=dict(base_url='http://10.102.93.68/v1',model='deepseek-v4.1-flash-1017-xq',model_configuration='C:/Users/admin/.workbuddy/models.json',credential_file=r['credential_file'],node='C:/Users/admin/.workbuddy/binaries/node/versions/22.22.2-6/node.exe',entry='C:/Users/admin/AppData/Local/Programs/WorkBuddy/resources/app.asar.unpacked/cli/bin/codebuddy',cwd='D:/code/aster',private_output=str(private))
for p in [plan['node'],plan['entry'],plan['model_configuration']]:
 if not Path(p).is_file():raise RuntimeError('observed preinstalled WorkBuddy client/config file is missing')
(BASE/'workbuddy-builtin-e2e-v1-plan.json').write_text(json.dumps(plan,indent=2)+'\n')
worker=BASE/'workbuddy_builtin_e2e_worker_v1.py';rec=dict(unix=time.time(),phase='launch_requested',worker_sha256=hashlib.sha256(worker.read_bytes()).hexdigest(),client='existing WorkBuddy bundled client; no UI automation',no_forwarding=True)
ip.write_text(json.dumps(rec,indent=2)+'\n')
with (private/'supervisor.stdout.log').open('xb') as a,(private/'supervisor.stderr.log').open('xb') as b:
 p=subprocess.Popen([sys.executable,'-X','utf8',str(worker)],cwd=BASE,stdin=subprocess.DEVNULL,stdout=a,stderr=b,creationflags=subprocess.CREATE_NO_WINDOW)
ft=[wintypes.FILETIME() for _ in range(4)];fn=ctypes.windll.kernel32.GetProcessTimes;fn.argtypes=[wintypes.HANDLE]+[ctypes.POINTER(wintypes.FILETIME)]*4
if not fn(wintypes.HANDLE(int(p._handle)),*[ctypes.byref(x) for x in ft]):raise ctypes.WinError()
rec.update(phase='launched',pid=p.pid,created_filetime=(ft[0].dwHighDateTime<<32)|ft[0].dwLowDateTime);ip.write_text(json.dumps(rec,indent=2)+'\n');print(json.dumps(rec,indent=2))
