"""Launch CPU-only statistics once, after the current diagnostic target reaps."""
import json,hashlib
from xolotl_trial_common import BASE,owned
intent=json.loads((BASE/'xolotl-single-current-qsum-v2-profile-intent.json').read_text())
worker='''import json,subprocess,time,hashlib,sqlite3
from pathlib import Path
root=Path(__file__).resolve().parent;out=dict(phase='running',unix=time.time(),cuda_visible_devices='',commands=[])
try:
 trace=root/'warm-prose.nsys-rep'
 if trace.is_symlink() or trace.stat().st_uid!=10250 or not 0<trace.stat().st_size<512*1024**2:raise RuntimeError('profile trace bound differs')
 out['trace_bytes']=trace.stat().st_size;out['trace_sha256']=hashlib.sha256(trace.read_bytes()).hexdigest()
 args=['/usr/local/cuda/bin/nsys','stats','--report=cuda_api_sum,cuda_gpu_kern_sum,cuda_gpu_mem_time_sum,cuda_gpu_mem_size_sum','--format=csv','--output='+str(root/'statistics'),str(trace)]
 p=subprocess.run(args,capture_output=True,text=True,timeout=180)
 if len(p.stdout)>2*1024**2 or len(p.stderr)>2*1024**2:raise RuntimeError('statistics log bound exceeded')
 (root/'stats.stdout.log').write_text(p.stdout);(root/'stats.stderr.log').write_text(p.stderr);out['commands'].append(dict(args=args,exit=p.returncode))
 if p.returncode:raise RuntimeError('statistics failed')
 sql=root/'warm-prose.sqlite'
 if sql.is_symlink() or sql.stat().st_uid!=10250 or not 0<sql.stat().st_size<512*1024**2:raise RuntimeError('statistics SQLite bound differs')
 c=sqlite3.connect(sql.as_uri()+'?mode=ro',uri=True)
 if c.execute('pragma quick_check').fetchone()[0]!='ok':raise RuntimeError('profile SQLite integrity refused')
 out.update(phase='complete',sqlite_bytes=sql.stat().st_size,sqlite_integrity='ok')
except Exception as e:out.update(phase='failed',error=str(e))
out['finished_unix']=time.time();(root/'statistics-result.json').write_text(json.dumps(out,indent=2)+'\\n')
'''
compile(worker,'current-profile-statistics-worker','exec')
code='''from pathlib import Path
import os,json,subprocess,time,hashlib
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=os.getuid() or os.getuid()!=10250:raise RuntimeError('statistics owner differs')
r=json.loads((root/'result.json').read_text())
if r['phase']!='complete' or not r.get('engine_reaped') or len(r['requests'])!=4:raise RuntimeError('diagnostic must complete4 requests and reap')
proof=json.loads((root.parent.parent/'resource-result.json').read_text())
if time.time()+240>proof['leaseEndsUnix']:raise RuntimeError('immutable statistics deadline insufficient')
if (root/'statistics-launch.json').exists():raise RuntimeError('statistics intent already exists; observe instead')
worker=@WORKER@;p=root/'statistics-worker.py';p.write_text(worker)
env=os.environ.copy();env['CUDA_VISIBLE_DEVICES']=''
with (root/'statistics-worker.log').open('xb') as log:
 child=subprocess.Popen(['timeout','--signal=TERM','--kill-after=15','210','python3','-u',str(p)],cwd=root,stdin=subprocess.DEVNULL,stdout=log,stderr=log,env=env,start_new_session=True)
out=dict(pid=child.pid,start_ticks=int(Path('/proc/'+str(child.pid)+'/stat').read_text().split(') ',1)[1].split()[19]),uid=os.getuid(),unix=time.time(),worker_sha256=hashlib.sha256(p.read_bytes()).hexdigest(),deadline_seconds=210)
(root/'statistics-launch.json').write_text(json.dumps(out,indent=2)+'\\n');print(json.dumps(out))
'''.replace('@ROOT@',repr(intent['root'])).replace('@WORKER@',repr(worker))
compile(code,'current-profile-statistics-launch','exec');r=owned(code);(BASE/'xolotl-current-profile-v3-statistics-launch.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
