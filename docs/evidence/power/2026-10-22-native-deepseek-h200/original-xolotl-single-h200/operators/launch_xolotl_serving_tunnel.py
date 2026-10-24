"""Bind the verified task-owned API to Windows loopback; keep the key out of arguments."""
import ctypes,hashlib,json,os,socket,subprocess,sys,time
from ctypes import wintypes
from xolotl_serving_common import BASE,SSH,observe
p=BASE/'xolotl-stable-access-tunnel-intent.json'
if p.exists():raise RuntimeError('local access tunnel intent exists; inspect it')
r=json.loads((BASE/'xolotl-stable-service-v2-intent.json').read_text());o=observe();latest=json.loads((BASE/'xolotl-stable-service-v2-latest.json').read_text())['service-v2-result.json']
if o['job_uid']!=r['allocation_uid'] or o['phase']!='Running' or latest['phase']!='serving' or latest['last_health_status']!=200:raise RuntimeError('stable service is not verified ready')
with socket.socket() as s:s.bind(('127.0.0.1',30003))
command=SSH[:-1]+['-N','-T','-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3','-o','LogLevel=ERROR','-L','127.0.0.1:30003:'+r['pod_ip']+':30003',SSH[-1]]
plan=dict(command=command,lease_ends_unix=r['plan']['lease_ends_unix'],allocation_uid=r['allocation_uid'],replica_uid=r['replica_uid'],gpu_uuid=r['gpu_uuid'],target=r['pod_ip']+':30003',base_url='http://127.0.0.1:30003/v1')
(BASE/'xolotl-stable-access-tunnel-plan.json').write_text(json.dumps(plan,indent=2)+'\n')
record=dict(phase='launch_requested',unix=time.time(),plan=plan,source_sha256=hashlib.sha256((BASE/'xolotl_serving_tunnel_worker.py').read_bytes()).hexdigest());p.write_text(json.dumps(record,indent=2)+'\n')
with (BASE/'xolotl-stable-access-tunnel-worker.stdout.log').open('xb') as a,(BASE/'xolotl-stable-access-tunnel-worker.stderr.log').open('xb') as b:
 child=subprocess.Popen([sys.executable,'-X','utf8',str(BASE/'xolotl_serving_tunnel_worker.py')],cwd=BASE,stdin=subprocess.DEVNULL,stdout=a,stderr=b,creationflags=subprocess.CREATE_NO_WINDOW)
ft=[wintypes.FILETIME() for _ in range(4)];fn=ctypes.windll.kernel32.GetProcessTimes;fn.argtypes=[wintypes.HANDLE]+[ctypes.POINTER(wintypes.FILETIME)]*4
if not fn(wintypes.HANDLE(int(child._handle)),*[ctypes.byref(v) for v in ft]):raise ctypes.WinError()
record.update(phase='launched',supervisor_pid=child.pid,supervisor_created_filetime=(ft[0].dwHighDateTime<<32)|ft[0].dwLowDateTime);p.write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(dict(phase='launched',base_url=plan['base_url'],supervisor_pid=child.pid,auto_reconnect=True)))
